// src/types/index.ts
// Shared types used across Phase 2 pipeline services

export interface ConversationContext {
  phone: string;
  contactName: string;
  isFirstMessage: boolean;
  humanMode: boolean;
}
