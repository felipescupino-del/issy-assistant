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

// Quote flow types — Phase 4
export type QuoteStep = 'lives' | 'age_range' | 'city' | 'plan_type' | 'confirm' | 'done';

export interface QuoteState {
  status: 'collecting' | 'confirming' | 'complete' | 'abandoned';
  currentStep: QuoteStep;
  retryCount: number;           // retries on current field (max 3)
  lives: number | null;
  ageRange: string | null;      // e.g. "25-35"
  city: string | null;          // one of ALLOWED_CITIES
  planType: 'enfermaria' | 'apartamento' | null;
  startedAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
}
