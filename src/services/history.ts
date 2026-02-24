// src/services/history.ts
// Message history persistence and retrieval — CORE-04
import { prisma } from '../lib/prisma';
import { config } from '../config';

/**
 * Load the last N messages for a phone number, returned in chronological order (oldest-first).
 * ALWAYS call this BEFORE saving the current user message to avoid doubling the message in history.
 * N is controlled by HISTORY_LIMIT env var (default 20) via config.app.historyLimit.
 */
export async function loadHistory(phone: string) {
  const messages = await prisma.message.findMany({
    where: { phone },
    orderBy: { createdAt: 'desc' },
    take: config.app.historyLimit,
  });
  return messages.reverse();  // chronological order for LLM context
}

/**
 * Persist a single message (user or assistant) to the mensagens table.
 * Call for user message AFTER loadHistory, and for assistant message AFTER sendTextMessage succeeds.
 */
export async function saveMessage(
  phone: string,
  role: 'user' | 'assistant',
  content: string,
) {
  return prisma.message.create({
    data: { phone, role, content },
  });
}
