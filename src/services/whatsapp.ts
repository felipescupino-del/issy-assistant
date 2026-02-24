// src/services/whatsapp.ts
// Z-API send-text service with native typing indicator — UX-01
// Source: https://developer.z-api.io/en/message/send-message-text

import axios from 'axios';
import { config } from '../config';

/**
 * Send a plain text message via Z-API with a typing indicator.
 * delayTypingSeconds (1-15): Z-API shows "typing..." to recipient for this duration
 * BEFORE delivering the message. This is the only way to show a typing indicator in Z-API
 * (there is no standalone presence-send endpoint).
 *
 * IMPORTANT: axios timeout must exceed delayTyping to avoid ETIMEDOUT.
 * Set to (delayTypingSeconds + 10) * 1000 as a flat safe ceiling of 20_000ms.
 *
 * @param phone - E.164 digits-only format, e.g. "5511999999999"
 * @param message - Plain text message body
 * @param delayTypingSeconds - Seconds to show typing indicator before delivery (default 2)
 */
export async function sendTextMessage(
  phone: string,
  message: string,
  delayTypingSeconds = 2,
): Promise<void> {
  const { instanceId, instanceToken, clientToken } = config.zapi;

  await axios.post(
    `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`,
    {
      phone,
      message,
      delayTyping: delayTypingSeconds,
    },
    {
      headers: { 'Client-Token': clientToken },
      timeout: 20_000,   // must exceed delayTyping; was 10_000 (insufficient for delays >= 2s)
    },
  );
}

/**
 * Compute a randomized delay in integer seconds from the configured ms bounds.
 * Used by the webhook pipeline to vary response timing naturally.
 */
export function computeDelaySeconds(): number {
  const minSec = Math.floor(config.app.humanDelayMinMs / 1000);
  const maxSec = Math.ceil(config.app.humanDelayMaxMs / 1000);
  return Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
}
