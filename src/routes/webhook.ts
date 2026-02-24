// src/routes/webhook.ts
// Phase 4: Full message pipeline with insurance knowledge layer, human handoff, admin commands, and quote flow routing

import { Router } from 'express';
import { parseZApiPayload, ZApiWebhookPayload } from '../types/zapi';
import { upsertContact, isFirstMessage } from '../services/contact';
import { getOrCreateConversation, isHumanMode } from '../services/conversation';
import { loadHistory, saveMessage } from '../services/history';
import { classifyIntent } from '../services/intent';
import { generateResponse } from '../services/ai';
import { sendTextMessage, computeDelaySeconds } from '../services/whatsapp';
import { detectProductType } from '../data/insuranceFacts';
import { isAdminCommand, isAdminPhone, handleAdminCommand } from '../services/admin';
import { executeHandoff } from '../services/handoff';
import { handleQuoteMessage, getQuoteState } from '../services/quoteService';

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

  // Step 2: Classify intent (CORE-03)
  // Must run BEFORE admin check to allow /humano to flow through normal pipeline.
  // Must run BEFORE humanMode gate so handoff intent is captured even if broker re-sends /humano.
  const intent = classifyIntent(text);

  // Step 3: Admin command check — BEFORE human mode gate (HAND-03)
  // /bot must work even when humanMode=true (otherwise deadlock — can't restore bot).
  // Only /bot and /status are admin commands. /humano flows through normal intent pipeline.
  if (isAdminCommand(text)) {
    if (isAdminPhone(phone)) {
      await handleAdminCommand(phone, text);
    }
    // Non-admin sending /bot or /status: silently ignore (no response, no processing)
    return;
  }

  // Step 4: Human mode gate — check BEFORE any OpenAI call (CORE-04)
  // If humanMode is true, a human agent has taken over. Do not respond.
  const conversation = await getOrCreateConversation(phone);
  if (isHumanMode(conversation)) {
    console.log(`[webhook] Human mode active for ${phone} — skipping bot response`);
    return;
  }

  // Step 5: Handoff branch — exit pipeline, bot goes silent (HAND-01, HAND-02)
  // Runs after humanMode gate: a second /humano while already in human mode is silenced at Step 4.
  if (intent === 'handoff') {
    const handoffHistory = await loadHistory(phone);
    await saveMessage(phone, 'user', text);  // save the /humano message before handoff
    await executeHandoff(phone, contact, handoffHistory);
    return;  // pipeline ends — bot is now in human mode
  }

  // Step 6: Read active quote session (QUOT-04)
  const quoteState = await getQuoteState(phone);

  // Step 7: Route to quote flow if active session OR new quote intent (QUOT-01, QUOT-02, QUOT-04)
  // CRITICAL: Active session check comes FIRST — mid-flow messages won't have quote keywords.
  // Research pitfall #1: "Sao Paulo" mid-flow must route to quote, not Q&A.
  if (quoteState?.status === 'collecting' || quoteState?.status === 'confirming' || intent === 'quote') {
    // Save user message BEFORE processing (project invariant — prevents history gaps; Research pitfall #4)
    await saveMessage(phone, 'user', text);
    // If new quote intent arrives while collecting/confirming, reset session (CONTEXT: "nova cotacao substitui")
    const stateToPass = intent === 'quote' ? null : quoteState;
    await handleQuoteMessage(phone, text, stateToPass);
    console.log(`[webhook] Quote flow for ${phone} (step=${quoteState?.currentStep ?? 'new'}, intent=${intent})`);
    return;  // short-circuit — do NOT fall through to AI response
  }

  // Step 8: Load history BEFORE saving current user message — prevents doubling (CORE-04)
  const history = await loadHistory(phone);

  // Step 9: Save the incoming user message
  await saveMessage(phone, 'user', text);

  // Step 10: Detect product type for facts injection (KNOW-01)
  const productType = detectProductType(text);

  // Step 11: Generate AI response (CORE-05 — fallback handled inside generateResponse)
  const nameToUse = firstMsg ? senderName : contact.name;
  const responseText = await generateResponse(nameToUse, history, text, intent, productType);

  // Step 12: Send response with typing indicator (UX-01)
  // computeDelaySeconds() returns a random int between HUMAN_DELAY_MIN_MS/1000 and HUMAN_DELAY_MAX_MS/1000
  const delaySeconds = computeDelaySeconds();
  await sendTextMessage(phone, responseText, delaySeconds);

  // Step 13: Save assistant response AFTER send succeeds — no phantom messages in history
  await saveMessage(phone, 'assistant', responseText);

  console.log(`[webhook] Responded to ${phone} (intent=${intent}, product=${productType ?? 'none'}, delay=${delaySeconds}s, firstMsg=${firstMsg})`);
}

export default router;
