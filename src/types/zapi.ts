// Z-API webhook payload types
// Source: https://developer.z-api.io/en/webhooks/on-message-received

export interface ZApiWebhookPayload {
  instanceId: string;
  messageId: string;
  phone: string;           // sender phone number — e.g., "5511999999999" (E.164, digits only)
  fromMe: boolean;         // true if the connected WhatsApp number sent this — ALWAYS filter out
  senderName: string;      // display name of the sender
  chatName: string;        // group or contact chat name
  momment: number;         // unix timestamp in ms — note: intentional typo in Z-API API
  status: string;          // "RECEIVED" | "SENT" | "READ" | "PLAYED" etc.
  isGroup: boolean;        // true for group messages — ignore group messages in v1
  type: string;            // "ReceivedCallback"
  text?: {
    message: string;       // the actual text body
  };
  image?: { caption?: string; imageUrl: string };
  audio?: { audioUrl: string; ptt: boolean };
}

export interface ParsedZApiMessage {
  phone: string;
  text: string | null;
  senderName: string;
  messageId: string;
  fromMe: boolean;
  isGroup: boolean;
  timestamp: Date;
}

/**
 * Extract the fields we care about from a raw Z-API webhook payload.
 * Returns null if the message should be ignored (fromMe or group message).
 */
export function parseZApiPayload(body: ZApiWebhookPayload): ParsedZApiMessage | null {
  if (body.fromMe) return null;   // never process messages sent by the bot itself
  if (body.isGroup) return null;  // v1 ignores group messages

  return {
    phone:       body.phone,
    text:        body.text?.message ?? null,
    senderName:  body.senderName ?? body.chatName ?? 'Desconhecido',
    messageId:   body.messageId,
    fromMe:      body.fromMe,
    isGroup:     body.isGroup,
    timestamp:   new Date(body.momment),
  };
}
