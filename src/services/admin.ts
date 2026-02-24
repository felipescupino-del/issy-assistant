// src/services/admin.ts
// Admin in-band command handling — HAND-03
// /bot restores bot mode; /status shows conversation state.
// /humano is NOT handled here — it flows through the normal intent pipeline.

import { config } from '../config';
import { setHumanMode } from './conversation';
import { sendTextMessage } from './whatsapp';
import { prisma } from '../lib/prisma';

/**
 * Returns true if the given phone is in the admin allowlist (ADMIN_PHONE_NUMBERS env var).
 * Phone must match exactly — no normalization applied.
 */
export function isAdminPhone(phone: string): boolean {
  return config.admin.phoneNumbers.includes(phone);
}

/**
 * Returns true if text is exactly /bot or /status (trimmed, lowercased).
 * Returns false for /humano — that command flows through the normal intent pipeline.
 * Returns false for anything else.
 */
export function isAdminCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === '/bot' || normalized === '/status';
}

/**
 * Handle an admin command sent via WhatsApp.
 * Caller must verify isAdminPhone(phone) BEFORE calling this function.
 *
 * /bot  — restores bot mode (humanMode=false), confirms to admin
 * /status — reports current mode, broker name, last message
 *
 * No typing delay on admin responses (system messages, not conversational).
 */
export async function handleAdminCommand(phone: string, text: string): Promise<void> {
  const normalized = text.trim().toLowerCase();

  if (normalized === '/bot') {
    await setHumanMode(phone, false);
    await sendTextMessage(phone, 'Bot mode restaurado. Issy voltou a responder neste chat.', 0);
    console.log(`[admin] /bot executed by ${phone}`);
    return;
  }

  if (normalized === '/status') {
    const conversation = await prisma.conversation.findUnique({ where: { phone } });
    const contact = await prisma.contact.findUnique({ where: { phone } });
    const lastMessage = await prisma.message.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    const mode = conversation?.humanMode ? 'Humano' : 'Bot';
    const brokerName = contact?.name ?? 'Desconhecido';
    const lastContent = lastMessage?.content
      ? lastMessage.content.slice(0, 100)
      : '(sem mensagens)';

    const statusMessage =
      `*Status do Chat*\n` +
      `Modo: ${mode}\n` +
      `Corretor: ${brokerName}\n` +
      `Ultima mensagem: "${lastContent}"`;

    await sendTextMessage(phone, statusMessage, 0);
    console.log(`[admin] /status executed by ${phone}`);
    return;
  }
}
