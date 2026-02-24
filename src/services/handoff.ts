// src/services/handoff.ts
// Human handoff orchestration — HAND-01, HAND-02
// Sends structured briefing, sets humanMode=true, confirms to broker — in strict order.

import { sendTextMessage } from './whatsapp';
import { setHumanMode } from './conversation';
import { saveMessage } from './history';

/**
 * Build a deterministic WhatsApp-formatted briefing message for the human agent.
 * Pure function — no side effects, no GPT calls.
 *
 * @param contact - Broker contact record with name and phone
 * @param history - Full conversation history array from loadHistory()
 */
export function buildHandoffBriefing(
  contact: { name: string; phone: string },
  history: Array<{ role: string; content: string }>,
): string {
  const userMessages = history.filter((m) => m.role === 'user').slice(-3);

  const bulletLines = userMessages.length > 0
    ? userMessages
        .map((m) => `- ${m.content.slice(0, 120)}`)
        .join('\n')
    : '- (sem mensagens anteriores)';

  return (
    `*TRANSFERENCIA PARA ATENDIMENTO HUMANO*\n\n` +
    `*Corretor:* ${contact.name} (${contact.phone})\n` +
    `*Mensagens anteriores:* ${history.length}\n\n` +
    `*Ultimas mensagens do corretor:*\n` +
    `${bulletLines}\n\n` +
    `Para retornar ao bot: envie */bot* neste chat`
  );
}

/**
 * Orchestrate the full handoff sequence in strict order:
 * 1. Build briefing (pure, no side effects)
 * 2. Send briefing (no typing delay — system message)
 * 3. Set humanMode=true (AFTER send succeeds)
 * 4. Build confirmation message
 * 5. Send confirmation (short 1s delay)
 * 6. Save briefing to history (AFTER send)
 * 7. Save confirmation to history (AFTER send)
 *
 * CRITICAL: Step 2 before 3 ensures briefing is sent before bot goes silent.
 * CRITICAL: Steps 6-7 after sends — same pattern as Phase 2 webhook.ts (no phantom messages).
 *
 * @param phone - Broker phone in E.164 digits-only format
 * @param contact - Broker contact record
 * @param history - Conversation history loaded BEFORE /humano message was saved
 */
export async function executeHandoff(
  phone: string,
  contact: { name: string; phone: string },
  history: Array<{ role: string; content: string }>,
): Promise<void> {
  // Step 1: Build briefing (pure)
  const briefing = buildHandoffBriefing(contact, history);

  // Step 2: Send briefing — no typing delay (system message, not a conversational reply)
  await sendTextMessage(phone, briefing, 0);

  // Step 3: Set humanMode=true — AFTER briefing is delivered, bot now goes silent
  await setHumanMode(phone, true);

  // Step 4: Build confirmation for the broker
  const confirmation = `Entendido, ${contact.name}! Estou transferindo para um especialista da assessoria. Eles vao ver todo o contexto da conversa e entrar em contato em breve.`;

  // Step 5: Send confirmation with short delay
  await sendTextMessage(phone, confirmation, 1);

  // Step 6: Save briefing to history AFTER send succeeds
  await saveMessage(phone, 'assistant', briefing);

  // Step 7: Save confirmation to history AFTER send succeeds
  await saveMessage(phone, 'assistant', confirmation);
}
