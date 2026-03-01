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

export interface WelcomeButton {
  id: string;
  label: string;
}

/**
 * Send a button list message via Z-API.
 * Z-API supports up to 3 buttons — perfect for our welcome menu.
 * Falls back to plain text if the button API fails.
 *
 * @param phone - E.164 digits-only format
 * @param message - Header text displayed above the buttons
 * @param buttons - Array of {id, label} (max 3)
 */
export async function sendButtonListMessage(
  phone: string,
  message: string,
  buttons: WelcomeButton[],
): Promise<void> {
  const { instanceId, instanceToken, clientToken } = config.zapi;

  try {
    await axios.post(
      `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-button-list`,
      {
        phone,
        message,
        buttonList: {
          buttons: buttons.map((b) => ({ id: b.id, label: b.label })),
        },
      },
      {
        headers: { 'Client-Token': clientToken },
        timeout: 20_000,
      },
    );
  } catch (err: any) {
    console.warn('[whatsapp] Button list failed, falling back to text:', err?.message);
    // Fallback: send as plain text with numbered options
    const fallbackText = `${message}\n\n${buttons.map((b) => `${b.id}️⃣ ${b.label}`).join('\n')}`;
    await sendTextMessage(phone, fallbackText, 1);
  }
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
