// src/routes/webhook.ts
// Phase 2: Full message pipeline — receive → respond end-to-end (CORE-01)

import { Router } from 'express';
import { parseZApiPayload, ZApiWebhookPayload } from '../types/zapi';
import { upsertContact, isFirstMessage } from '../services/contact';
import { getOrCreateConversation, isHumanMode } from '../services/conversation';
import { loadHistory, saveMessage } from '../services/history';
import { classifyIntent } from '../services/intent';
import { generateResponse } from '../services/ai';
import { sendTextMessage, computeDelaySeconds } from '../services/whatsapp';
import { detectProductType } from '../data/insuranceFacts';

const router = Router();

router.post('/', (req, res) => {
  // Acknowledge immediately — Z-API expects a fast 2xx response
  res.json({ status: 'received' });

  // Async processing — fire-and-forget; errors logged, never crash the server
  processMessage(req.body as ZApiWebhookPayload).catch((err) =>
    console.error('[webhook] Erro ao processar mensagem:', err.message),
  );
});

async function processMessage(body: ZApiWebhookPayload): Promise<void> {
  const parsed = parseZApiPayload(body);

  // Guard: ignore non-text messages (image, audio, sticker, etc.)
  // parsed is null for fromMe/group (handled in parseZApiPayload)
  if (!parsed || !parsed.text) return;

  const { phone, text, senderName } = parsed;

  // Step 1: Persist contact — upsert by phone, sync senderName (CORE-02)
  const contact = await upsertContact(phone, senderName);
  const firstMsg = isFirstMessage(contact);

  // Step 2: Human mode gate — check BEFORE any OpenAI call (CORE-04)
  // If humanMode is true, a human agent has taken over. Do not respond.
  const conversation = await getOrCreateConversation(phone);
  if (isHumanMode(conversation)) {
    console.log(`[webhook] Human mode active for ${phone} — skipping bot response`);
    return;
  }

  // Step 3: Classify intent (CORE-03)
  const intent = classifyIntent(text);

  // Step 4: Load history BEFORE saving current user message — prevents doubling (CORE-04)
  const history = await loadHistory(phone);

  // Step 5: Save the incoming user message
  await saveMessage(phone, 'user', text);

  // Step 6: Detect product type for facts injection (KNOW-01)
  const productType = detectProductType(text);

  // Step 7: Generate AI response (CORE-05 — fallback handled inside generateResponse)
  const nameToUse = firstMsg ? senderName : contact.name;
  const responseText = await generateResponse(nameToUse, history, text, intent, productType);

  // Step 8: Send response with typing indicator (UX-01)
  // computeDelaySeconds() returns a random int between HUMAN_DELAY_MIN_MS/1000 and HUMAN_DELAY_MAX_MS/1000
  const delaySeconds = computeDelaySeconds();
  await sendTextMessage(phone, responseText, delaySeconds);

  // Step 9: Save assistant response AFTER send succeeds — no phantom messages in history
  await saveMessage(phone, 'assistant', responseText);

  console.log(`[webhook] Responded to ${phone} (intent=${intent}, product=${productType ?? 'none'}, delay=${delaySeconds}s, firstMsg=${firstMsg})`);
}

export default router;
