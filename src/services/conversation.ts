// src/services/conversation.ts
// Conversation session state — CORE-04 foundation
import { prisma } from '../lib/prisma';

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
 * Must be checked BEFORE any OpenAI call to prevent bot/human double-response race condition.
 */
export function isHumanMode(conversation: { humanMode: boolean }): boolean {
  return conversation.humanMode;
}
