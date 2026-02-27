// src/services/conversation.ts
// Conversation session state with 30-minute timeout
import { prisma } from '../lib/prisma';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create the Conversation record for a phone number.
 * Uses no-op update so the record is created if absent, left unchanged if present.
 */
export async function getOrCreateConversation(phone: string) {
  return prisma.conversation.upsert({
    where: { phone },
    create: { phone },
    update: {},    // intentional no-op — preserve humanMode and state
  });
}

/**
 * Returns true if a human agent has taken over this conversation.
 */
export function isHumanMode(conversation: { humanMode: boolean }): boolean {
  return conversation.humanMode;
}

/**
 * Returns true if the last activity was more than 30 minutes ago.
 * Used to trigger the welcome menu on "stale" conversations.
 */
export function isSessionExpired(conversation: { updatedAt: Date }): boolean {
  return Date.now() - conversation.updatedAt.getTime() > SESSION_TIMEOUT_MS;
}

/**
 * Set humanMode for a conversation. Used by handoff flow (true) and admin /bot command (false).
 */
export async function setHumanMode(phone: string, mode: boolean): Promise<void> {
  await prisma.conversation.update({
    where: { phone },
    data: { humanMode: mode },
  });
}

/**
 * Touch the conversation timestamp to keep the session alive.
 * Called on every incoming message to track activity for session timeout.
 */
export async function touchConversation(phone: string): Promise<void> {
  await prisma.conversation.update({
    where: { phone },
    data: { updatedAt: new Date() },
  });
}
