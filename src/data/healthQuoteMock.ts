// src/data/healthQuoteMock.ts
// Mock health insurance plan data for demo — Phase 4
// All values are fictional and for demonstration purposes only.

export interface HealthQuotePlan {
  operator: string;
  planName: string;
  coverages: string[];
  carencia: Record<string, string>;
  baseMonthlyPrice: number;
  apartamentoMultiplier: number;
  ageMultipliers: Record<string, number>;
}

export const HEALTH_PLAN: HealthQuotePlan = {
  operator: 'Saude Segura',
  planName: 'Essencial Plus',
  coverages: [
    'Consultas medicas ilimitadas',
    'Internacao hospitalar',
    'Exames laboratoriais e de imagem',
    'Pronto-socorro 24h',
    'Cirurgias eletivas e de urgencia',
    'Quimioterapia e radioterapia',
  ],
  carencia: {
    urgencias: '30 dias',
    cirurgias: '180 dias',
    partos: '300 dias',
  },
  baseMonthlyPrice: 280,
  apartamentoMultiplier: 1.4,
  ageMultipliers: {
    '0-18':  0.7,
    '19-23': 0.8,
    '24-28': 0.9,
    '29-33': 1.0,
    '34-38': 1.1,
    '39-43': 1.2,
    '44-48': 1.4,
    '49-53': 1.6,
    '54-58': 1.9,
    '59+':   2.3,
  },
};

export const ALLOWED_CITIES: string[] = [
  'Sao Paulo',
  'Rio de Janeiro',
  'Belo Horizonte',
  'Curitiba',
  'Porto Alegre',
];
