// src/services/handoff.ts
// Human handoff orchestration — HAND-01, HAND-02
// Sends structured briefing to admin, sets humanMode=true, confirms to broker — in strict order.

import OpenAI from 'openai';
import { config } from '../config';
import { sendTextMessage } from './whatsapp';
import { setHumanMode } from './conversation';
import { saveMessage } from './history';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Use AI to generate a concise summary of the conversation for the admin briefing.
 * Fallback: bullet points of last 3 user messages if AI call fails.
 */
async function generateConversationSummary(
  history: Array<{ role: string; content: string }>,
): Promise<string> {
  const userMessages = history.filter((m) => m.role === 'user');

  if (userMessages.length === 0) {
    return '(sem mensagens anteriores)';
  }

  // Build a compact transcript for the AI
  const transcript = history
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Corretor' : 'Luna'}: ${m.content.slice(0, 200)}`)
    .join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: 0.3,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente interno. Resuma em 2-3 frases objetivas o que esse corretor de seguros precisa, baseado na conversa abaixo. Seja direto e claro. Responda apenas com o resumo, sem prefixos.',
        },
        { role: 'user', content: transcript },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    if (summary) return summary;
  } catch (err) {
    console.error('[handoff] Falha ao gerar resumo via IA, usando fallback:', (err as Error).message);
  }

  // Fallback: last 3 user messages as bullet points
  return userMessages
    .slice(-3)
    .map((m) => `- ${m.content.slice(0, 120)}`)
    .join('\n');
}

/**
 * Build a deterministic WhatsApp-formatted briefing message for the admin.
 * Pure function — no side effects, no GPT calls.
 */
export function buildHandoffBriefing(
  contact: { name: string; phone: string },
  history: Array<{ role: string; content: string }>,
  summary: string,
): string {
  const userMessages = history.filter((m) => m.role === 'user').slice(-3);

  const bulletLines = userMessages.length > 0
    ? userMessages
        .map((m) => `- ${m.content.slice(0, 120)}`)
        .join('\n')
    : '- (sem mensagens anteriores)';

  return (
    `🔔 *TRANSFERÊNCIA — ATENDIMENTO HUMANO*\n\n` +
    `*Corretor:* ${contact.name} (${contact.phone})\n` +
    `*Msgs na conversa:* ${history.length}\n\n` +
    `*Resumo:*\n${summary}\n\n` +
    `*Últimas msgs do corretor:*\n` +
    `${bulletLines}`
  );
}

/**
 * Orchestrate the full handoff sequence in strict order:
 * 1. Generate AI summary of conversation
 * 2. Build briefing (pure, no side effects)
 * 3. Send briefing to admin (not the broker)
 * 4. Set humanMode=true (AFTER send succeeds)
 * 5. Build confirmation message
 * 6. Send confirmation to broker
 * 7. Save briefing to history (AFTER send)
 * 8. Save confirmation to history (AFTER send)
 *
 * CRITICAL: Step 3 before 4 ensures briefing is sent before bot goes silent.
 * CRITICAL: Steps 7-8 after sends — same pattern as webhook.ts (no phantom messages).
 */
export async function executeHandoff(
  phone: string,
  contact: { name: string; phone: string },
  history: Array<{ role: string; content: string }>,
  adminPhone: string,
): Promise<void> {
  // Step 1: Generate AI summary
  const summary = await generateConversationSummary(history);

  // Step 2: Build briefing (pure)
  const briefing = buildHandoffBriefing(contact, history, summary);

  // Step 3: Send briefing to ADMIN — no typing delay (system message)
  await sendTextMessage(adminPhone, briefing, 0);

  // Step 4: Set humanMode=true — AFTER briefing is delivered, bot now goes silent
  await setHumanMode(phone, true);

  // Step 5: Build confirmation for the broker
  const confirmation = `Entendido, ${contact.name}! Estou transferindo para um especialista da assessoria. Eles vão ver todo o contexto da conversa e entrar em contato em breve.`;

  // Step 6: Send confirmation to broker with short delay
  await sendTextMessage(phone, confirmation, 1);

  // Step 7: Save briefing to history AFTER send succeeds
  await saveMessage(phone, 'assistant', briefing);

  // Step 8: Save confirmation to history AFTER send succeeds
  await saveMessage(phone, 'assistant', confirmation);
}
