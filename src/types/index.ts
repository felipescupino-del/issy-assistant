// src/types/index.ts
// Shared types used across Phase 2 pipeline services

export interface ConversationContext {
  phone: string;
  contactName: string;
  isFirstMessage: boolean;
  humanMode: boolean;
}

export type ProductType = 'saude' | 'auto' | 'vida' | 'residencial' | 'empresarial';

export interface InsuranceFacts {
  productName: string;
  description: string;
  commonCoverages: string[];
  commonExclusions: string[];
  acceptanceRules: string[];
  importantNotes: string[];
}
