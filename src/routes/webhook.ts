// src/routes/webhook.ts
// Full message pipeline — Luna / Grupo Futura União

import { Router } from 'express';
import { parseZApiPayload, ZApiWebhookPayload } from '../types/zapi';
import { upsertContact, isFirstMessage } from '../services/contact';
import { getOrCreateConversation, isHumanMode, isSessionExpired, touchConversation } from '../services/conversation';
import { loadHistory, saveMessage } from '../services/history';
import { classifyIntent } from '../services/intent';
import { generateResponse } from '../services/ai';
import { sendTextMessage, computeDelaySeconds } from '../services/whatsapp';
import { detectProductType } from '../data/insuranceFacts';
import { isAdminCommand, isAdminPhone, handleAdminCommand } from '../services/admin';
import { executeHandoff } from '../services/handoff';
import { handleQuoteMessage, getQuoteState } from '../services/quoteService';
import { parseResponseMarkers } from '../services/responseParser';
import { WELCOME_MESSAGE } from '../data/welcomeMessage';

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
  if (!parsed || !parsed.text) return;

  const { phone, text, senderName } = parsed;

  // Step 1: Persist contact — upsert by phone, sync senderName
  const contact = await upsertContact(phone, senderName);
  const firstMsg = isFirstMessage(contact);

  // Step 2: Classify intent (supports menu numbers 1/2/3 and keywords)
  const intent = classifyIntent(text);

  // Step 3: Admin command check — BEFORE human mode gate
  if (isAdminCommand(text)) {
    if (isAdminPhone(phone)) {
      await handleAdminCommand(phone, text);
    }
    return;
  }

  // Step 4: Get conversation + human mode gate
  const conversation = await getOrCreateConversation(phone);
  if (isHumanMode(conversation)) {
    console.log(`[webhook] Human mode active for ${phone} — skipping bot response`);
    return;
  }

  // Step 5: Touch session timestamp (keep session alive)
  await touchConversation(phone);

  // Step 6: Welcome flow — send menu after 30min inactivity or first message
  const sessionExpired = isSessionExpired(conversation);
  if ((firstMsg || sessionExpired) && intent !== 'handoff') {
    await sendTextMessage(phone, WELCOME_MESSAGE, 1);
    await saveMessage(phone, 'assistant', WELCOME_MESSAGE);
    console.log(`[webhook] Welcome sent to ${phone} (firstMsg=${firstMsg}, sessionExpired=${sessionExpired})`);
    // Don't return — continue processing the user's actual message below
    // Unless the message was just a greeting, in which case the welcome is enough
    if (intent === 'greeting' || intent === 'unknown') return;
  }

  // Step 7: Handoff branch — exit pipeline, bot goes silent
  if (intent === 'handoff') {
    const handoffHistory = await loadHistory(phone);
    await saveMessage(phone, 'user', text);
    await executeHandoff(phone, contact, handoffHistory);
    return;
  }

  // Step 8: Read active quote session
  const quoteState = await getQuoteState(phone);

  // Step 9: Route to quote flow if active session OR new quote intent
  if (quoteState?.status === 'collecting' || quoteState?.status === 'confirming' || intent === 'quote') {
    await saveMessage(phone, 'user', text);
    const stateToPass = intent === 'quote' ? null : quoteState;
    await handleQuoteMessage(phone, text, stateToPass);
    console.log(`[webhook] Quote flow for ${phone} (step=${quoteState?.currentStep ?? 'new'}, intent=${intent})`);
    return;
  }

  // Step 10: Load history BEFORE saving current user message — prevents doubling
  const history = await loadHistory(phone);

  // Step 11: Save the incoming user message
  await saveMessage(phone, 'user', text);

  // Step 12: Detect product type for facts injection
  const productType = detectProductType(text);

  // Step 13: Generate AI response
  // Expand menu numbers into meaningful text so the AI understands context
  const aiText = expandMenuNumber(text) ?? text;
  const nameToUse = firstMsg ? senderName : contact.name;
  const rawResponse = await generateResponse(nameToUse, history, aiText, intent, productType, {
    isNewSession: sessionExpired,
  });

  // Step 14: Parse response markers ([TRANSFER], [QUOTATION_COMPLETE])
  const { cleanText, shouldTransfer } = parseResponseMarkers(rawResponse);

  // Step 15: Send response with typing indicator
  const delaySeconds = computeDelaySeconds();
  await sendTextMessage(phone, cleanText, delaySeconds);

  // Step 16: Save assistant response AFTER send succeeds
  await saveMessage(phone, 'assistant', cleanText);

  // Step 17: If AI flagged transfer, execute handoff after sending response
  if (shouldTransfer) {
    const handoffHistory = await loadHistory(phone);
    await executeHandoff(phone, contact, handoffHistory);
    console.log(`[webhook] AI-triggered transfer for ${phone}`);
    return;
  }

  console.log(`[webhook] Responded to ${phone} (intent=${intent}, product=${productType ?? 'none'}, delay=${delaySeconds}s)`);
}

/**
 * Expand menu number into meaningful text so the AI understands what the broker wants.
 * Returns null if the text is not a menu number.
 */
function expandMenuNumber(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '1') return 'Quero tirar dúvidas sobre seguros';
  if (trimmed === '2') return 'Quero fazer uma cotação';
  if (trimmed === '3') return 'Quero falar com um atendente';
  return null;
}

export default router;
