// src/services/quoteService.ts
// Health insurance quote flow — AI-driven extraction
// Entry point: handleQuoteMessage()
// Strategy: Extract → Merge → Ask Missing (single GPT call extracts all fields at once)

import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { Prisma } from '../generated/prisma/client';
import { QuoteState } from '../types/index';
import { HEALTH_PLAN, ALLOWED_CITIES } from '../data/healthQuoteMock';
import { sendTextMessage, computeDelaySeconds } from './whatsapp';
import { saveMessage } from './history';
import { config } from '../config';
import { OpenAIError } from '../errors';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ─── Result type ─────────────────────────────────────────────────────────────

export interface QuoteFlowResult {
  handled: boolean; // true = message was processed as quote data
}

// ─── Cancel keywords ─────────────────────────────────────────────────────────

const CANCEL_KEYWORDS = ['cancelar', 'cancela', 'parar', 'sair', 'desistir', 'nao quero mais'];

// ─── Type guard ───────────────────────────────────────────────────────────────

/**
 * Type guard — verifies that value is a valid QuoteState object.
 * Checks for required primitive fields; does not validate all nullable fields.
 */
export function isQuoteState(value: unknown): value is QuoteState {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['status'] === 'string' &&
    typeof obj['currentStep'] === 'string' &&
    typeof obj['retryCount'] === 'number'
  );
}

// ─── State helpers ────────────────────────────────────────────────────────────

function createFreshQuoteState(): QuoteState {
  const now = new Date().toISOString();
  return {
    status: 'collecting',
    currentStep: 'lives',
    retryCount: 0,
    lives: null,
    ageRange: null,
    city: null,
    planType: null,
    startedAt: now,
    updatedAt: now,
  };
}

/**
 * Read the current QuoteState for a phone number from the database.
 * Returns null if no conversation exists or if state is not a valid QuoteState.
 */
export async function getQuoteState(phone: string): Promise<QuoteState | null> {
  const conv = await prisma.conversation.findUnique({ where: { phone } });
  return isQuoteState(conv?.state) ? (conv!.state as unknown as QuoteState) : null;
}

async function persistQuoteState(phone: string, state: QuoteState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await prisma.conversation.update({
    where: { phone },
    data: { state: state as unknown as Prisma.InputJsonObject },
  });
}

// ─── Value helpers ────────────────────────────────────────────────────────────

/**
 * Converts a single age into the corresponding ANS age band string.
 * Bands align with healthQuoteMock.ts ageMultipliers keys.
 */
export function ageToAgeBand(age: number): string | null {
  if (age < 0 || age > 120) return null;
  const bands: [number, number, string][] = [
    [0, 18, '0-18'],
    [19, 23, '19-23'],
    [24, 28, '24-28'],
    [29, 33, '29-33'],
    [34, 38, '34-38'],
    [39, 43, '39-43'],
    [44, 48, '44-48'],
    [49, 53, '49-53'],
    [54, 58, '54-58'],
  ];
  for (const [min, max, label] of bands) {
    if (age >= min && age <= max) return label;
  }
  return '59+';
}

// City alias map — accent-stripped, lowercase -> canonical city name
const CITY_ALIASES: Record<string, string> = {
  'sp':               'Sao Paulo',
  'sp capital':       'Sao Paulo',
  'sao paulo':        'Sao Paulo',
  'sampa':            'Sao Paulo',
  'são paulo':        'Sao Paulo',
  'rio':              'Rio de Janeiro',
  'rj':               'Rio de Janeiro',
  'rio de janeiro':   'Rio de Janeiro',
  'rio de janeiro rj':'Rio de Janeiro',
  'bh':               'Belo Horizonte',
  'belo horizonte':   'Belo Horizonte',
  'beaga':            'Belo Horizonte',
  'belzonte':         'Belo Horizonte',
  'cwb':              'Curitiba',
  'curitiba':         'Curitiba',
  'ctba':             'Curitiba',
  'poa':              'Porto Alegre',
  'porto alegre':     'Porto Alegre',
  'portoalegre':      'Porto Alegre',
};

// Substring keywords for each city — used when exact alias match fails
const CITY_SUBSTRINGS: [string, string][] = [
  ['paulo',       'Sao Paulo'],
  ['sampa',       'Sao Paulo'],
  ['janeiro',     'Rio de Janeiro'],
  ['horizonte',   'Belo Horizonte'],
  ['beaga',       'Belo Horizonte'],
  ['curitiba',    'Curitiba'],
  ['alegre',      'Porto Alegre'],
];

export function normalizeText(input: string): string {
  return input.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function resolveCity(input: string): string | null {
  const normalized = normalizeText(input);

  // Exact alias match
  const exact = CITY_ALIASES[normalized];
  if (exact) return exact;

  // Substring search — handles "moro em curitiba", "cidade: sp capital", etc.
  for (const [keyword, city] of CITY_SUBSTRINGS) {
    if (normalized.includes(keyword)) return city;
  }

  return null;
}

export function resolvePlanType(input: string): 'enfermaria' | 'apartamento' | null {
  const lower = input.toLowerCase().trim();

  // Enfermaria matches
  const enfTerms = ['1', 'enfermaria', 'enf', 'enfermeira'];
  if (enfTerms.includes(lower) || lower.includes('enferm')) return 'enfermaria';

  // Apartamento matches
  const aptTerms = ['2', 'apartamento', 'apto', 'apart', 'apt'];
  if (aptTerms.includes(lower) || lower.includes('aparta') || lower.includes('apart')) return 'apartamento';

  return null;
}

// ─── AI-driven extraction ─────────────────────────────────────────────────────

interface ExtractedFields {
  lives: number | null;
  ageRange: string | null;
  city: string | null;
  planType: 'enfermaria' | 'apartamento' | null;
}

/**
 * Single GPT call to extract all 4 quote fields from user text.
 * Uses JSON mode with temp=0 for deterministic extraction.
 * Post-processes with local helpers for validation.
 */
async function extractAllQuoteFields(text: string): Promise<ExtractedFields> {
  const result: ExtractedFields = { lives: null, ageRange: null, city: null, planType: null };

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Voce extrai dados de cotacao de plano de saude de mensagens em portugues.
Extraia os seguintes campos se presentes na mensagem:
- lives: numero de pessoas/vidas (inteiro, 1-100)
- age: idade ou faixa etaria (numero unico como 35, ou faixa como "29-33")
- city: cidade mencionada (ex: SP, Sao Paulo, Rio, BH, Curitiba, Porto Alegre)
- planType: tipo de acomodacao ("enfermaria" ou "apartamento")

Responda APENAS com JSON valido no formato:
{"lives": <number|null>, "age": <number|string|null>, "city": <string|null>, "planType": <string|null>}

Se um campo nao estiver presente na mensagem, use null.
Exemplos:
- "Quero cotar pra 3 pessoas de 30 anos em SP" → {"lives":3,"age":30,"city":"SP","planType":null}
- "2 vidas apartamento" → {"lives":2,"age":null,"city":null,"planType":"apartamento"}
- "enfermaria" → {"lives":null,"age":null,"city":null,"planType":"enfermaria"}
- "quero um plano de saude" → {"lives":null,"age":null,"city":null,"planType":null}`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    const parsed = JSON.parse(raw);

    // Post-process lives
    if (typeof parsed.lives === 'number' && parsed.lives >= 1 && parsed.lives <= 100) {
      result.lives = Math.round(parsed.lives);
    }

    // Post-process age → ageRange (convert single age to ANS band)
    if (parsed.age !== null && parsed.age !== undefined) {
      if (typeof parsed.age === 'number') {
        result.ageRange = ageToAgeBand(parsed.age);
      } else if (typeof parsed.age === 'string') {
        // Try range format "XX-YY"
        const rangeMatch = parsed.age.match(/^(\d{1,3})-(\d{1,3})$/);
        if (rangeMatch) {
          const min = parseInt(rangeMatch[1], 10);
          const max = parseInt(rangeMatch[2], 10);
          if (min >= 0 && max <= 120 && min < max) {
            result.ageRange = `${min}-${max}`;
          }
        } else {
          // Try single age as string
          const age = parseInt(parsed.age, 10);
          if (!isNaN(age)) {
            result.ageRange = ageToAgeBand(age);
          }
        }
      }
    }

    // Post-process city with local resolver
    if (typeof parsed.city === 'string' && parsed.city.trim() !== '') {
      result.city = resolveCity(parsed.city);
    }

    // Post-process planType with local resolver
    if (typeof parsed.planType === 'string' && parsed.planType.trim() !== '') {
      result.planType = resolvePlanType(parsed.planType);
    }
  } catch (err) {
    const wrappedErr = new OpenAIError('GPT field extraction failed', err);
    console.error('[quoteService] GPT field extraction error:', wrappedErr.message);
  }

  return result;
}

/**
 * Merge extracted fields into state — only fills null fields (never overwrites).
 */
export function mergeExtractedFields(state: QuoteState, extracted: ExtractedFields): void {
  if (state.lives === null && extracted.lives !== null) state.lives = extracted.lives;
  if (state.ageRange === null && extracted.ageRange !== null) state.ageRange = extracted.ageRange;
  if (state.city === null && extracted.city !== null) state.city = extracted.city;
  if (state.planType === null && extracted.planType !== null) state.planType = extracted.planType;
}

/**
 * Returns the list of field names that are still missing from state.
 */
export function getMissingFields(state: QuoteState): string[] {
  const missing: string[] = [];
  if (state.lives === null) missing.push('lives');
  if (state.ageRange === null) missing.push('ageRange');
  if (state.city === null) missing.push('city');
  if (state.planType === null) missing.push('planType');
  return missing;
}

/**
 * GPT generates a natural question asking for the missing fields.
 * Mentions what was already collected to feel conversational.
 */
async function generateMissingFieldsQuestion(
  state: QuoteState,
  missingFields: string[],
): Promise<string> {
  // Fallback in case GPT fails
  const fallback = buildFallbackQuestion(missingFields);

  try {
    const collectedParts: string[] = [];
    if (state.lives !== null) collectedParts.push(`${state.lives} vida(s)`);
    if (state.ageRange !== null) collectedParts.push(`faixa etaria ${state.ageRange} anos`);
    if (state.city !== null) collectedParts.push(state.city);
    if (state.planType !== null) collectedParts.push(state.planType === 'apartamento' ? 'Apartamento' : 'Enfermaria');

    const fieldDescriptions: Record<string, string> = {
      lives: 'numero de vidas/pessoas',
      ageRange: 'idade ou faixa etaria dos beneficiarios',
      city: `cidade (temos: ${ALLOWED_CITIES.join(', ')})`,
      planType: 'tipo de acomodacao (enfermaria ou apartamento)',
    };

    const missingDesc = missingFields.map((f) => fieldDescriptions[f] ?? f).join(', ');
    const collectedText = collectedParts.length > 0
      ? `Ja tenho: ${collectedParts.join(', ')}.`
      : 'Nenhum dado coletado ainda.';

    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Voce e a Luna, assistente de cotacao de plano de saude no WhatsApp.
Gere UMA mensagem curta e natural pedindo os dados que faltam pro corretor.
Tom: informal-profissional, WhatsApp (use "pra", "ta", "beleza").
Use emojis com moderacao (1-2 max).
Nao repita dados ja coletados, apenas mencione brevemente o que ja tem pra dar contexto.
Se so falta 1 campo, faca uma pergunta direta.
Se faltam todos os 4 campos, e a primeira interacao — seja acolhedora e peca os dados.
Maximo 3 linhas.`,
        },
        {
          role: 'user',
          content: `${collectedText}\nFalta: ${missingDesc}`,
        },
      ],
      temperature: 0.8,
      max_tokens: 150,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    return response && response.length > 0 ? response : fallback;
  } catch (err) {
    const wrappedErr = new OpenAIError('GPT missing fields question failed', err);
    console.error('[quoteService] GPT missing fields question error:', wrappedErr.message);
    return fallback;
  }
}

/**
 * Deterministic fallback if GPT fails to generate the question.
 */
export function buildFallbackQuestion(missingFields: string[]): string {
  const fieldLabels: Record<string, string> = {
    lives: 'numero de vidas',
    ageRange: 'faixa etaria',
    city: 'cidade',
    planType: 'acomodacao (enfermaria ou apartamento)',
  };
  const labels = missingFields.map((f) => fieldLabels[f] ?? f);

  if (labels.length === 4) {
    return '🏥 *Cotacao de Plano de Saude*\n\nBora montar sua cotacao! Me passa: quantas vidas, idade, cidade e se prefere enfermaria ou apartamento 😊';
  }

  return `Pra continuar, preciso de: ${labels.join(', ')}. Pode mandar tudo junto! 😊`;
}

// ─── Confirmation / quote builders ───────────────────────────────────────────

export function buildConfirmationMessage(state: QuoteState): string {
  const planTypeDisplay = state.planType === 'apartamento' ? 'Apartamento' : 'Enfermaria';
  return (
    'Vou confirmar os dados da cotacao:\n\n' +
    `*Vidas:* ${state.lives}\n` +
    `*Faixa etaria:* ${state.ageRange} anos\n` +
    `*Cidade:* ${state.city}\n` +
    `*Acomodacao:* ${planTypeDisplay}\n\n` +
    'Esta tudo correto? Responda *sim* para gerar a cotacao ou *nao* para corrigir.'
  );
}

export function findAgeBandMultiplier(ageRange: string): number {
  const match = ageRange.match(/^(\d+)-(\d+)$/);
  if (!match) return 1.0;
  const midpoint = (parseInt(match[1], 10) + parseInt(match[2], 10)) / 2;

  const bands = [
    { max: 18,  key: '0-18' },
    { max: 23,  key: '19-23' },
    { max: 28,  key: '24-28' },
    { max: 33,  key: '29-33' },
    { max: 38,  key: '34-38' },
    { max: 43,  key: '39-43' },
    { max: 48,  key: '44-48' },
    { max: 53,  key: '49-53' },
    { max: 58,  key: '54-58' },
    { max: Infinity, key: '59+' },
  ];

  const band = bands.find((b) => midpoint <= b.max);
  const key = band?.key ?? '59+';
  return HEALTH_PLAN.ageMultipliers[key] ?? 1.0;
}

export function buildQuoteMessage(state: QuoteState): string {
  const lives = state.lives ?? 1;
  const ageRange = state.ageRange ?? '29-33';
  const city = state.city ?? 'Sao Paulo';
  const planType = state.planType ?? 'enfermaria';

  const ageMultiplier = findAgeBandMultiplier(ageRange);
  const tierMultiplier = planType === 'apartamento' ? HEALTH_PLAN.apartamentoMultiplier : 1.0;
  const totalMonthly = Math.round(
    HEALTH_PLAN.baseMonthlyPrice * lives * ageMultiplier * tierMultiplier,
  );
  const planTypeDisplay = planType === 'apartamento' ? 'Apartamento' : 'Enfermaria';
  const coverageLines = HEALTH_PLAN.coverages.map((c) => `- ${c}`).join('\n');

  return (
    `🏥 *Plano de Saude — Cotacao*\n\n` +
    `*Operadora:* ${HEALTH_PLAN.operator}\n` +
    `*Plano:* ${HEALTH_PLAN.planName}\n` +
    `*Acomodacao:* ${planTypeDisplay}\n\n` +
    `✅ *Coberturas incluidas:*\n${coverageLines}\n\n` +
    `⏳ *Carencias:*\n` +
    `- 30 dias: urgencias e emergencias\n` +
    `- 180 dias: cirurgias eletivas\n` +
    `- 300 dias: partos\n\n` +
    `💰 *Valor estimado:* R$ ${totalMonthly}/mes\n` +
    `_(${lives} vida(s) | faixa ${ageRange} anos | ${city} | ${planTypeDisplay})_\n\n` +
    `---\n` +
    `Quer cotar outro plano? Ou prefere falar com um consultor?`
  );
}

// ─── Confirm step handler ────────────────────────────────────────────────────

async function handleConfirmStep(phone: string, text: string, state: QuoteState): Promise<void> {
  const normalized = normalizeText(text);

  const isApproval = ['sim', 'correto', 'ok', 'yes', 'isso', 'certo', '1', 'confirmar', 'confirma'].some(
    (kw) => normalized.includes(kw),
  );
  const isRejection = ['nao', 'errado', 'corrigir', 'erro', '2', 'mudar', 'alterar'].some(
    (kw) => normalized.includes(kw),
  );

  if (isApproval) {
    state.status = 'complete';
    state.currentStep = 'done';
    await persistQuoteState(phone, state);
    const quoteMsg = buildQuoteMessage(state);
    await sendTextMessage(phone, quoteMsg, computeDelaySeconds());
    await saveMessage(phone, 'assistant', quoteMsg);
    return;
  }

  if (isRejection) {
    // Check if user specifies which field to correct — null that field and go back to collecting
    if (normalized.includes('vidas') || normalized.includes('vida') || normalized.includes('quantidade')) {
      state.lives = null;
    } else if (normalized.includes('idade') || normalized.includes('faixa') || normalized.includes('etaria')) {
      state.ageRange = null;
    } else if (normalized.includes('cidade') || normalized.includes('local') || normalized.includes('regiao')) {
      state.city = null;
    } else if (normalized.includes('acomodacao') || normalized.includes('plano') || normalized.includes('tipo') || normalized.includes('apartamento') || normalized.includes('enfermaria')) {
      state.planType = null;
    } else {
      // Ambiguous rejection — restart from beginning
      const fresh = createFreshQuoteState();
      fresh.startedAt = state.startedAt;
      Object.assign(state, fresh);
    }

    state.status = 'collecting';
    state.currentStep = 'lives'; // currentStep is less relevant now but keep valid
    state.retryCount = 0;
    await persistQuoteState(phone, state);

    const missing = getMissingFields(state);
    if (missing.length === 0) {
      // All fields still filled (shouldn't happen, but safety)
      state.status = 'confirming';
      state.currentStep = 'confirm';
      await persistQuoteState(phone, state);
      const confirmMsg = buildConfirmationMessage(state);
      await sendTextMessage(phone, confirmMsg, computeDelaySeconds());
      await saveMessage(phone, 'assistant', confirmMsg);
    } else {
      const question = await generateMissingFieldsQuestion(state, missing);
      await sendTextMessage(phone, question, computeDelaySeconds());
      await saveMessage(phone, 'assistant', question);
    }
    return;
  }

  // Neither approval nor rejection — retry
  state.retryCount += 1;
  await persistQuoteState(phone, state);
  const retryMsg = 'Nao entendi 😅 Manda *sim* pra confirmar ou *nao* pra corrigir algum dado.';
  await sendTextMessage(phone, retryMsg, computeDelaySeconds());
  await saveMessage(phone, 'assistant', retryMsg);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Main entry point for all quote flow interactions.
 * AI-driven: extracts all fields from user text in a single GPT call,
 * merges into state, and only asks for what's missing.
 */
export async function handleQuoteMessage(
  phone: string,
  text: string,
  existingState: QuoteState | null,
): Promise<QuoteFlowResult> {
  console.log(`[quoteService] handleQuoteMessage phone=${phone} step=${existingState?.currentStep ?? 'new'} status=${existingState?.status ?? 'new'}`);

  // 1. Start fresh if no state or previous quote is finished
  let state: QuoteState;
  if (existingState === null || existingState.status === 'complete' || existingState.status === 'abandoned') {
    state = createFreshQuoteState();
    await persistQuoteState(phone, state);
  } else {
    state = existingState;
  }

  // 2. Confirming — delegate to confirm handler
  if (state.status === 'confirming') {
    await handleConfirmStep(phone, text, state);
    return { handled: true };
  }

  // 3. Collecting — Extract → Merge → Ask Missing
  if (state.status === 'collecting') {
    // Check for explicit cancel keywords before AI extraction
    const normalizedInput = normalizeText(text);
    if (CANCEL_KEYWORDS.some((kw) => normalizedInput.includes(kw))) {
      state.status = 'abandoned';
      await persistQuoteState(phone, state);
      const cancelMsg = 'Cotação cancelada! Como posso te ajudar? 😊';
      await sendTextMessage(phone, cancelMsg, computeDelaySeconds());
      await saveMessage(phone, 'assistant', cancelMsg);
      return { handled: true };
    }

    // Extract all fields from user text
    const extracted = await extractAllQuoteFields(text);
    console.log(`[quoteService] extracted:`, JSON.stringify(extracted));

    // Merge into state (only fills nulls)
    mergeExtractedFields(state, extracted);

    // Check progress
    const missing = getMissingFields(state);
    const extractedNothing = extracted.lives === null && extracted.ageRange === null && extracted.city === null && extracted.planType === null;

    if (extractedNothing) {
      state.retryCount += 1;

      // 2nd consecutive message with no quote data — user likely changed subject
      if (state.retryCount >= 2) {
        state.status = 'abandoned';
        await persistQuoteState(phone, state);
        console.log(`[quoteService] Abandoning quote for ${phone} — no data extracted for ${state.retryCount} rounds`);
        return { handled: false };
      }
    } else {
      state.retryCount = 0;
    }

    if (missing.length === 0) {
      // All 4 fields collected — move to confirmation
      state.status = 'confirming';
      state.currentStep = 'confirm';
      state.retryCount = 0;
      await persistQuoteState(phone, state);
      const confirmMsg = buildConfirmationMessage(state);
      await sendTextMessage(phone, confirmMsg, computeDelaySeconds());
      await saveMessage(phone, 'assistant', confirmMsg);
    } else {
      // Still missing fields — ask naturally
      await persistQuoteState(phone, state);
      const question = await generateMissingFieldsQuestion(state, missing);
      await sendTextMessage(phone, question, computeDelaySeconds());
      await saveMessage(phone, 'assistant', question);
    }
    return { handled: true };
  }

  console.log(`[quoteService] Unhandled state status: ${state.status}`);
  return { handled: true };
}
