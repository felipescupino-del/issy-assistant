// Z-API send-text service
// Source: https://developer.z-api.io/en/message/send-message-text

import axios from 'axios';
import { config } from '../config';

/**
 * Send a plain text message via Z-API.
 * @param phone - E.164 digits-only format, e.g. "5511999999999"
 * @param message - Plain text message body
 */
export async function sendTextMessage(phone: string, message: string): Promise<void> {
  const { instanceId, instanceToken, clientToken } = config.zapi;

  await axios.post(
    `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`,
    { phone, message },
    {
      headers: { 'Client-Token': clientToken },
      timeout: 10_000,
    },
  );
}
