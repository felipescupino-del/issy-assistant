// src/services/quoteService.ts
// Health insurance quote flow state machine — Phase 4
// Entry point: handleQuoteMessage()
// State is persisted to Conversation.state (JSONB) via Prisma on every step transition.

import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { Prisma } from '../generated/prisma/client';
import { QuoteState, QuoteStep } from '../types/index';
import { HEALTH_PLAN, ALLOWED_CITIES } from '../data/healthQuoteMock';
import { sendTextMessage, computeDelaySeconds } from './whatsapp';
import { saveMessage } from './history';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

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

// ─── Step prompts ─────────────────────────────────────────────────────────────

const STEP_PROMPTS: Record<QuoteStep, string> = {
  lives:
    '🏥 *Cotacao de Plano de Saude*\n\nOla! Vou te ajudar a montar uma cotacao rapidinho. 😊\n\nPrimeiro, *quantas vidas* (pessoas) serao incluidas no plano?\n\n_(Ex: 1, 3, 10)_',
  age_range:
    'Perfeito! Agora me diz a *faixa etaria* dos beneficiarios.\n\n_(Ex: 20-30, 35-45, 50-60)_',
  city:
    'Otimo! Qual a *cidade* para a cotacao?\n\nCidades disponiveis:\n• Sao Paulo\n• Rio de Janeiro\n• Belo Horizonte\n• Curitiba\n• Porto Alegre',
  plan_type:
    'Entendido! Qual o *tipo de acomodacao* desejado?\n\n1️⃣ *Enfermaria*\n2️⃣ *Apartamento*\n\n_(Responda com 1, 2 ou o nome)_',
  confirm: '',  // built dynamically
  done: '',     // built dynamically
};

// ─── Retry messages ───────────────────────────────────────────────────────────

function getRetryMessage(field: QuoteStep, attempt: number): string {
  const messages: Record<QuoteStep, string[]> = {
    lives: [
      'Hmm, nao entendi bem. Quantas pessoas serao incluidas no plano? _(Ex: 2)_',
      'Me diz somente o numero de vidas, por exemplo: *4*',
      'Nao consegui identificar o numero de vidas. Quer pular essa pergunta e falar com um consultor?',
    ],
    age_range: [
      'Nao entendi a faixa etaria. Qual a faixa de idade dos beneficiarios? _(Ex: 25-35)_',
      'Me diz somente a faixa etaria no formato *XX-YY*, por exemplo: *30-40*',
      'Tive dificuldade em identificar a faixa etaria. Quer pular e falar com um consultor?',
    ],
    city: [
      'Essa cidade nao esta disponivel para cotacao. As opcoes sao:\n• Sao Paulo\n• Rio de Janeiro\n• Belo Horizonte\n• Curitiba\n• Porto Alegre',
      'Por favor, escolha uma das cidades listadas acima. Qual delas e mais proxima?',
      'Nao consegui identificar a cidade. Quer pular e falar com um consultor?',
    ],
    plan_type: [
      'Nao entendi o tipo de acomodacao. Responda *1* para Enfermaria ou *2* para Apartamento.',
      'Escolha somente *1* (Enfermaria) ou *2* (Apartamento).',
      'Nao consegui identificar o tipo de plano. Quer pular e falar com um consultor?',
    ],
    confirm: [
      'Nao entendi sua resposta. Responda *sim* para confirmar ou *nao* para corrigir os dados.',
      'Por favor, responda somente *sim* ou *nao*.',
      'Tive dificuldade em interpretar sua resposta. Quer falar com um consultor?',
    ],
    done: [],
  };

  const list = messages[field];
  const index = Math.min(attempt - 1, list.length - 1);
  return list[index] ?? list[list.length - 1] ?? 'Nao entendi. Pode repetir?';
}

// ─── Value extraction ─────────────────────────────────────────────────────────

async function extractLivesCount(text: string): Promise<number | null> {
  // Fast path: pure numeric
  const fastMatch = text.trim().match(/^\s*(\d+)\s*$/);
  if (fastMatch) {
    const n = parseInt(fastMatch[1], 10);
    return n >= 1 && n <= 100 ? n : null;
  }

  // Inline numeric in text
  const inlineMatch = text.match(/\b(\d{1,3})\b/);
  if (inlineMatch) {
    const n = parseInt(inlineMatch[1], 10);
    if (n >= 1 && n <= 100) return n;
  }

  // Slow path: GPT extraction
  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'Voce extrai o numero de vidas de um texto em portugues. Responda APENAS com um numero inteiro ou NENHUM.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 10,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    if (raw === 'NENHUM' || raw === '') return null;
    const n = parseInt(raw, 10);
    return !isNaN(n) && n >= 1 && n <= 100 ? n : null;
  } catch (err) {
    console.error('[quoteService] GPT lives extraction error:', err);
    return null;
  }
}

async function extractAgeRange(text: string): Promise<string | null> {
  // Fast path: explicit range patterns
  const patterns = [
    /\b(\d{1,3})\s*[-–]\s*(\d{1,3})\b/,              // "20-30" or "20–30"
    /\b(\d{1,3})\s+a\s+(\d{1,3})\b/i,                 // "20 a 30"
    /entre\s+(\d{1,3})\s+e\s+(\d{1,3})\b/i,           // "entre 20 e 30"
    /de\s+(\d{1,3})\s+a\s+(\d{1,3})\b/i,              // "de 20 a 30"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      if (min >= 0 && max <= 120 && min < max) {
        return `${min}-${max}`;
      }
    }
  }

  // Slow path: GPT extraction
  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'Voce extrai faixa etaria de um texto em portugues. Responda APENAS no formato "XX-YY" (ex: "25-35") ou NENHUMA.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 15,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    if (raw === 'NENHUMA' || raw === '') return null;
    const rangeMatch = raw.match(/^(\d{1,3})-(\d{1,3})$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      if (min >= 0 && max <= 120 && min < max) return `${min}-${max}`;
    }
    return null;
  } catch (err) {
    console.error('[quoteService] GPT age range extraction error:', err);
    return null;
  }
}

// City alias map — accent-stripped, lowercase -> canonical city name
const CITY_ALIASES: Record<string, string> = {
  'sp':             'Sao Paulo',
  'sao paulo':      'Sao Paulo',
  'sampa':          'Sao Paulo',
  'rio':            'Rio de Janeiro',
  'rj':             'Rio de Janeiro',
  'rio de janeiro': 'Rio de Janeiro',
  'bh':             'Belo Horizonte',
  'belo horizonte': 'Belo Horizonte',
  'cwb':            'Curitiba',
  'curitiba':       'Curitiba',
  'poa':            'Porto Alegre',
  'porto alegre':   'Porto Alegre',
};

function normalizeText(input: string): string {
  return input.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveCity(input: string): string | null {
  const normalized = normalizeText(input);
  return CITY_ALIASES[normalized] ?? null;
}

function resolvePlanType(input: string): 'enfermaria' | 'apartamento' | null {
  const lower = input.toLowerCase().trim();
  if (lower === '1' || lower === 'enfermaria') return 'enfermaria';
  if (lower === '2' || lower === 'apartamento' || lower === 'apto') return 'apartamento';
  return null;
}

// ─── Confirmation / quote builders ───────────────────────────────────────────

function buildConfirmationMessage(state: QuoteState): string {
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

function findAgeBandMultiplier(ageRange: string): number {
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

function buildQuoteMessage(state: QuoteState): string {
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

// ─── Step handlers ────────────────────────────────────────────────────────────

async function handleLivesStep(phone: string, text: string, state: QuoteState): Promise<void> {
  const lives = await extractLivesCount(text);

  if (lives !== null) {
    state.lives = lives;
    state.currentStep = 'age_range';
    state.retryCount = 0;
    await persistQuoteState(phone, state);
    const prompt = STEP_PROMPTS.age_range;
    await sendTextMessage(phone, prompt, computeDelaySeconds());
    await saveMessage(phone, 'assistant', prompt);
  } else {
    state.retryCount += 1;
    await persistQuoteState(phone, state);
    const retryMsg = getRetryMessage('lives', state.retryCount);
    await sendTextMessage(phone, retryMsg, computeDelaySeconds());
    await saveMessage(phone, 'assistant', retryMsg);
  }
}

async function handleAgeRangeStep(phone: string, text: string, state: QuoteState): Promise<void> {
  const ageRange = await extractAgeRange(text);

  if (ageRange !== null) {
    state.ageRange = ageRange;
    state.currentStep = 'city';
    state.retryCount = 0;
    await persistQuoteState(phone, state);
    const prompt = STEP_PROMPTS.city;
    await sendTextMessage(phone, prompt, computeDelaySeconds());
    await saveMessage(phone, 'assistant', prompt);
  } else {
    state.retryCount += 1;
    await persistQuoteState(phone, state);
    const retryMsg = getRetryMessage('age_range', state.retryCount);
    await sendTextMessage(phone, retryMsg, computeDelaySeconds());
    await saveMessage(phone, 'assistant', retryMsg);
  }
}

async function handleCityStep(phone: string, text: string, state: QuoteState): Promise<void> {
  const city = resolveCity(text);

  if (city !== null) {
    state.city = city;
    state.currentStep = 'plan_type';
    state.retryCount = 0;
    await persistQuoteState(phone, state);
    const prompt = STEP_PROMPTS.plan_type;
    await sendTextMessage(phone, prompt, computeDelaySeconds());
    await saveMessage(phone, 'assistant', prompt);
  } else {
    state.retryCount += 1;
    await persistQuoteState(phone, state);
    const retryMsg = getRetryMessage('city', state.retryCount);
    await sendTextMessage(phone, retryMsg, computeDelaySeconds());
    await saveMessage(phone, 'assistant', retryMsg);
  }
}

async function handlePlanTypeStep(phone: string, text: string, state: QuoteState): Promise<void> {
  const planType = resolvePlanType(text);

  if (planType !== null) {
    state.planType = planType;
    state.currentStep = 'confirm';
    state.status = 'confirming';
    state.retryCount = 0;
    await persistQuoteState(phone, state);
    const confirmMsg = buildConfirmationMessage(state);
    await sendTextMessage(phone, confirmMsg, computeDelaySeconds());
    await saveMessage(phone, 'assistant', confirmMsg);
  } else {
    state.retryCount += 1;
    await persistQuoteState(phone, state);
    const retryMsg = getRetryMessage('plan_type', state.retryCount);
    await sendTextMessage(phone, retryMsg, computeDelaySeconds());
    await saveMessage(phone, 'assistant', retryMsg);
  }
}

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
    // Check if user specifies which field to correct — preserve other fields
    if (normalized.includes('vidas') || normalized.includes('vida') || normalized.includes('quantidade')) {
      state.currentStep = 'lives';
      state.lives = null;
      state.retryCount = 0;
      state.status = 'collecting';
    } else if (normalized.includes('idade') || normalized.includes('faixa') || normalized.includes('etaria')) {
      state.currentStep = 'age_range';
      state.ageRange = null;
      state.retryCount = 0;
      state.status = 'collecting';
    } else if (normalized.includes('cidade') || normalized.includes('local') || normalized.includes('regiao')) {
      state.currentStep = 'city';
      state.city = null;
      state.retryCount = 0;
      state.status = 'collecting';
    } else if (normalized.includes('acomodacao') || normalized.includes('plano') || normalized.includes('tipo') || normalized.includes('apartamento') || normalized.includes('enfermaria')) {
      state.currentStep = 'plan_type';
      state.planType = null;
      state.retryCount = 0;
      state.status = 'collecting';
    } else {
      // Ambiguous rejection — restart from beginning
      const fresh = createFreshQuoteState();
      fresh.startedAt = state.startedAt; // keep original start time
      Object.assign(state, fresh);
    }

    await persistQuoteState(phone, state);
    const nextStepPrompt = state.currentStep === 'confirm'
      ? buildConfirmationMessage(state)
      : STEP_PROMPTS[state.currentStep];
    await sendTextMessage(phone, nextStepPrompt, computeDelaySeconds());
    await saveMessage(phone, 'assistant', nextStepPrompt);
    return;
  }

  // Neither approval nor rejection — retry
  state.retryCount += 1;
  await persistQuoteState(phone, state);
  const retryMsg = getRetryMessage('confirm', state.retryCount);
  await sendTextMessage(phone, retryMsg, computeDelaySeconds());
  await saveMessage(phone, 'assistant', retryMsg);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Main entry point for all quote flow interactions.
 * Dispatches to the appropriate step handler based on current state.
 * Starts a fresh quote if existingState is null or a previous quote is complete/abandoned.
 */
export async function handleQuoteMessage(
  phone: string,
  text: string,
  existingState: QuoteState | null,
): Promise<void> {
  console.log(`[quoteService] handleQuoteMessage phone=${phone} step=${existingState?.currentStep ?? 'new'} status=${existingState?.status ?? 'new'}`);

  // Start fresh if no state or previous quote is finished
  if (existingState === null || existingState.status === 'complete' || existingState.status === 'abandoned') {
    const freshState = createFreshQuoteState();
    await persistQuoteState(phone, freshState);
    const prompt = STEP_PROMPTS.lives;
    await sendTextMessage(phone, prompt, computeDelaySeconds());
    await saveMessage(phone, 'assistant', prompt);
    return;
  }

  if (existingState.status === 'collecting') {
    switch (existingState.currentStep) {
      case 'lives':
        await handleLivesStep(phone, text, existingState);
        break;
      case 'age_range':
        await handleAgeRangeStep(phone, text, existingState);
        break;
      case 'city':
        await handleCityStep(phone, text, existingState);
        break;
      case 'plan_type':
        await handlePlanTypeStep(phone, text, existingState);
        break;
      default:
        console.log(`[quoteService] Unexpected step in collecting status: ${existingState.currentStep}`);
    }
    return;
  }

  if (existingState.status === 'confirming') {
    await handleConfirmStep(phone, text, existingState);
    return;
  }

  console.log(`[quoteService] Unhandled state status: ${existingState.status}`);
}
