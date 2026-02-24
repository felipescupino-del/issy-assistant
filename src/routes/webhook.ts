// Phase 1: Receive Z-API webhooks, acknowledge immediately, log parsed payload.
// Message processing logic is added in Phase 2.

import { Router } from 'express';
import { parseZApiPayload, ZApiWebhookPayload } from '../types/zapi';

const router = Router();

router.post('/', (req, res) => {
  // Acknowledge immediately — Z-API expects a fast 2xx response
  res.json({ status: 'received' });

  // Async processing (currently just logging — Phase 2 adds pipeline)
  processMessage(req.body as ZApiWebhookPayload).catch((err) =>
    console.error('[webhook] Erro ao processar mensagem:', err.message),
  );
});

async function processMessage(body: ZApiWebhookPayload): Promise<void> {
  const parsed = parseZApiPayload(body);

  if (!parsed) {
    // fromMe or group message — silently ignore
    return;
  }

  // Phase 1: Log the received message for verification
  console.log('[webhook] Mensagem recebida:', {
    phone:      parsed.phone,
    senderName: parsed.senderName,
    text:       parsed.text,
    messageId:  parsed.messageId,
    timestamp:  parsed.timestamp.toISOString(),
  });

  // Phase 2 will add: contact upsert, conversation lookup, intent detection, AI response
}

export default router;
