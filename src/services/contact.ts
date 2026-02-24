// src/services/contact.ts
// Broker identity persistence — CORE-02
import { prisma } from '../lib/prisma';

/**
 * Upsert a contact by phone number, always syncing the latest senderName.
 * Returns the full Contact record including createdAt/updatedAt for first-message detection.
 */
export async function upsertContact(phone: string, senderName: string) {
  return prisma.contact.upsert({
    where: { phone },
    create: { phone, name: senderName },
    update: { name: senderName },   // always sync — broker may rename in WhatsApp
  });
}

/**
 * Detects whether this is the contact's first message.
 * Uses timestamp proximity (within 1s) instead of === comparison — two Date objects
 * with the same value are NOT === equal in JavaScript (object reference comparison).
 */
export function isFirstMessage(contact: { createdAt: Date; updatedAt: Date }): boolean {
  return Math.abs(contact.createdAt.getTime() - contact.updatedAt.getTime()) < 1000;
}
