// Mock config and prisma BEFORE importing the module under test
vi.mock('../config', () => ({
  config: {
    openai: { apiKey: 'sk-test', model: 'gpt-4o-mini', temperature: 0.85, maxTokens: 500 },
    zapi: { instanceId: 'test', instanceToken: 'test', clientToken: 'test' },
    admin: { phoneNumbers: ['5511999999999'] },
    app: { humanDelayMinMs: 1500, humanDelayMaxMs: 3000, historyLimit: 20 },
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    conversation: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    contact: { findUnique: vi.fn(), upsert: vi.fn() },
    message: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class {
      chat = { completions: { create: mockCreate } };
    },
    __mockCreate: mockCreate,
  };
});

vi.mock('./whatsapp', () => ({
  sendTextMessage: vi.fn().mockResolvedValue(true),
  computeDelaySeconds: vi.fn().mockReturnValue(1),
}));

vi.mock('./history', () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
}));

import {
  isQuoteState,
  ageToAgeBand,
  normalizeText,
  resolveCity,
  resolvePlanType,
  mergeExtractedFields,
  getMissingFields,
  buildFallbackQuestion,
  buildConfirmationMessage,
  findAgeBandMultiplier,
  buildQuoteMessage,
  handleQuoteMessage,
} from './quoteService';
import { prisma } from '../lib/prisma';
import { sendTextMessage } from './whatsapp';
import { QuoteState } from '../types/index';

// Helper to create a full QuoteState for tests
function makeState(overrides: Partial<QuoteState> = {}): QuoteState {
  return {
    status: 'collecting',
    currentStep: 'lives',
    retryCount: 0,
    lives: null,
    ageRange: null,
    city: null,
    planType: null,
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isQuoteState', () => {
  it('returns true for valid QuoteState', () => {
    expect(isQuoteState(makeState())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isQuoteState(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isQuoteState(undefined)).toBe(false);
  });

  it('returns false for primitive', () => {
    expect(isQuoteState('string')).toBe(false);
  });

  it('returns false for object missing required fields', () => {
    expect(isQuoteState({ status: 'collecting' })).toBe(false);
    expect(isQuoteState({ status: 'collecting', currentStep: 'lives' })).toBe(false);
  });
});

describe('ageToAgeBand', () => {
  it.each([
    [0, '0-18'],
    [18, '0-18'],
    [19, '19-23'],
    [23, '19-23'],
    [24, '24-28'],
    [29, '29-33'],
    [34, '34-38'],
    [39, '39-43'],
    [44, '44-48'],
    [49, '49-53'],
    [54, '54-58'],
    [59, '59+'],
    [80, '59+'],
    [120, '59+'],
  ] as const)('age %d → "%s"', (age, expected) => {
    expect(ageToAgeBand(age)).toBe(expected);
  });

  it('returns null for negative age', () => {
    expect(ageToAgeBand(-1)).toBeNull();
  });

  it('returns null for age > 120', () => {
    expect(ageToAgeBand(121)).toBeNull();
  });
});

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('HELLO')).toBe('hello');
  });

  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('removes accents', () => {
    expect(normalizeText('São Paulo')).toBe('sao paulo');
    expect(normalizeText('cotação')).toBe('cotacao');
  });
});

describe('resolveCity', () => {
  describe('exact alias matches', () => {
    it.each([
      ['sp', 'Sao Paulo'],
      ['SP', 'Sao Paulo'],
      ['sao paulo', 'Sao Paulo'],
      ['São Paulo', 'Sao Paulo'],
      ['sampa', 'Sao Paulo'],
      ['rio', 'Rio de Janeiro'],
      ['rj', 'Rio de Janeiro'],
      ['bh', 'Belo Horizonte'],
      ['beaga', 'Belo Horizonte'],
      ['cwb', 'Curitiba'],
      ['poa', 'Porto Alegre'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(resolveCity(input)).toBe(expected);
    });
  });

  describe('substring matches', () => {
    it('moro em curitiba', () => {
      expect(resolveCity('moro em curitiba')).toBe('Curitiba');
    });

    it('porto alegre region', () => {
      expect(resolveCity('regiao de porto alegre')).toBe('Porto Alegre');
    });
  });

  it('returns null for unknown city', () => {
    expect(resolveCity('manaus')).toBeNull();
    expect(resolveCity('recife')).toBeNull();
  });
});

describe('resolvePlanType', () => {
  describe('enfermaria', () => {
    it.each(['1', 'enfermaria', 'enf', 'enfermeira'])('"%s" → enfermaria', (input) => {
      expect(resolvePlanType(input)).toBe('enfermaria');
    });

    it('substring "enferm" matches', () => {
      expect(resolvePlanType('quero enfermaria basica')).toBe('enfermaria');
    });
  });

  describe('apartamento', () => {
    it.each(['2', 'apartamento', 'apto', 'apart', 'apt'])('"%s" → apartamento', (input) => {
      expect(resolvePlanType(input)).toBe('apartamento');
    });
  });

  it('returns null for unknown input', () => {
    expect(resolvePlanType('vip')).toBeNull();
    expect(resolvePlanType('premium')).toBeNull();
  });
});

describe('mergeExtractedFields', () => {
  it('fills null fields from extracted', () => {
    const state = makeState();
    mergeExtractedFields(state, { lives: 3, ageRange: '29-33', city: 'Sao Paulo', planType: 'enfermaria' });
    expect(state.lives).toBe(3);
    expect(state.ageRange).toBe('29-33');
    expect(state.city).toBe('Sao Paulo');
    expect(state.planType).toBe('enfermaria');
  });

  it('does not overwrite existing non-null fields', () => {
    const state = makeState({ lives: 2, city: 'Curitiba' });
    mergeExtractedFields(state, { lives: 5, ageRange: '24-28', city: 'Sao Paulo', planType: null });
    expect(state.lives).toBe(2); // preserved
    expect(state.city).toBe('Curitiba'); // preserved
    expect(state.ageRange).toBe('24-28'); // filled
    expect(state.planType).toBeNull(); // both null
  });

  it('handles all-null extracted fields', () => {
    const state = makeState({ lives: 1 });
    mergeExtractedFields(state, { lives: null, ageRange: null, city: null, planType: null });
    expect(state.lives).toBe(1);
  });
});

describe('getMissingFields', () => {
  it('returns all 4 fields when all null', () => {
    const missing = getMissingFields(makeState());
    expect(missing).toEqual(['lives', 'ageRange', 'city', 'planType']);
  });

  it('returns empty array when all filled', () => {
    const state = makeState({ lives: 2, ageRange: '29-33', city: 'Sao Paulo', planType: 'enfermaria' });
    expect(getMissingFields(state)).toEqual([]);
  });

  it('returns only missing fields', () => {
    const state = makeState({ lives: 1, city: 'Curitiba' });
    expect(getMissingFields(state)).toEqual(['ageRange', 'planType']);
  });
});

describe('buildFallbackQuestion', () => {
  it('returns full intro when all 4 fields missing', () => {
    const msg = buildFallbackQuestion(['lives', 'ageRange', 'city', 'planType']);
    expect(msg).toContain('Cotacao de Plano de Saude');
    expect(msg).toContain('vidas');
  });

  it('returns partial question when fewer fields missing', () => {
    const msg = buildFallbackQuestion(['city', 'planType']);
    expect(msg).toContain('cidade');
    expect(msg).toContain('acomodacao');
  });
});

describe('buildConfirmationMessage', () => {
  it('includes all fields formatted', () => {
    const state = makeState({ lives: 2, ageRange: '29-33', city: 'Sao Paulo', planType: 'apartamento' });
    const msg = buildConfirmationMessage(state);
    expect(msg).toContain('2');
    expect(msg).toContain('29-33');
    expect(msg).toContain('Sao Paulo');
    expect(msg).toContain('Apartamento');
    expect(msg).toContain('sim');
    expect(msg).toContain('nao');
  });

  it('displays Enfermaria for enfermaria planType', () => {
    const state = makeState({ lives: 1, ageRange: '0-18', city: 'Curitiba', planType: 'enfermaria' });
    const msg = buildConfirmationMessage(state);
    expect(msg).toContain('Enfermaria');
  });
});

describe('findAgeBandMultiplier', () => {
  it('returns correct multiplier for 29-33 band (midpoint=31)', () => {
    expect(findAgeBandMultiplier('29-33')).toBe(1.0);
  });

  it('returns correct multiplier for 0-18 band', () => {
    expect(findAgeBandMultiplier('0-18')).toBe(0.7);
  });

  it('returns correct multiplier for 59+ (non-range format)', () => {
    // '59+' doesn't match XX-YY regex → returns 1.0 default
    expect(findAgeBandMultiplier('59+')).toBe(1.0);
  });

  it('returns correct multiplier for 54-58 band', () => {
    expect(findAgeBandMultiplier('54-58')).toBe(1.9);
  });
});

describe('buildQuoteMessage', () => {
  it('calculates price correctly for enfermaria', () => {
    const state = makeState({ lives: 2, ageRange: '29-33', city: 'Sao Paulo', planType: 'enfermaria' });
    const msg = buildQuoteMessage(state);
    // base=280, lives=2, age=1.0, tier=1.0 → 280*2*1*1 = 560
    expect(msg).toContain('R$ 560/mes');
    expect(msg).toContain('Enfermaria');
    expect(msg).toContain('Saude Segura');
  });

  it('calculates price correctly for apartamento', () => {
    const state = makeState({ lives: 1, ageRange: '29-33', city: 'Sao Paulo', planType: 'apartamento' });
    const msg = buildQuoteMessage(state);
    // base=280, lives=1, age=1.0, tier=1.4 → 280*1*1*1.4 = 392
    expect(msg).toContain('R$ 392/mes');
    expect(msg).toContain('Apartamento');
  });

  it('includes coverages', () => {
    const state = makeState({ lives: 1, ageRange: '29-33', city: 'Sao Paulo', planType: 'enfermaria' });
    const msg = buildQuoteMessage(state);
    expect(msg).toContain('Consultas medicas ilimitadas');
    expect(msg).toContain('Coberturas incluidas');
  });

  it('uses defaults when fields are null', () => {
    const state = makeState(); // all null
    const msg = buildQuoteMessage(state);
    // Should not throw, uses defaults: lives=1, ageRange=29-33, city=Sao Paulo, planType=enfermaria
    expect(msg).toContain('R$ 280/mes');
  });
});

// ─── handleQuoteMessage integration tests ────────────────────────────────────

// Get the mock OpenAI create function
async function getOpenAIMockCreate() {
  const mod = await import('openai');
  return (mod as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;
}

// Helper: mock GPT extraction response
function mockGptExtraction(mockCreate: ReturnType<typeof vi.fn>, fields: { lives?: number | null; age?: number | string | null; city?: string | null; planType?: string | null }) {
  mockCreate.mockResolvedValueOnce({
    choices: [{
      message: {
        content: JSON.stringify({
          lives: fields.lives ?? null,
          age: fields.age ?? null,
          city: fields.city ?? null,
          planType: fields.planType ?? null,
        }),
      },
    }],
  });
}

// Helper: mock GPT missing fields question
function mockGptQuestion(mockCreate: ReturnType<typeof vi.fn>, question: string) {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content: question } }],
  });
}

describe('handleQuoteMessage — cancel keywords', () => {
  const phone = '5511999990001';
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    mockCreate = await getOpenAIMockCreate();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock prisma update for persistQuoteState
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it.each(['cancelar', 'cancela', 'parar', 'sair', 'desistir', 'nao quero mais'])(
    'cancel keyword "%s" abandons quote and returns handled=true',
    async (keyword) => {
      const state = makeState({ retryCount: 0 });
      const result = await handleQuoteMessage(phone, keyword, state);

      expect(result.handled).toBe(true);
      expect(sendTextMessage).toHaveBeenCalledWith(phone, expect.stringContaining('cancelada'), expect.any(Number));
      // State should be updated to abandoned
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            state: expect.objectContaining({ status: 'abandoned' }),
          }),
        }),
      );
    },
  );
});

describe('handleQuoteMessage — escape flow', () => {
  const phone = '5511999990002';
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    mockCreate = await getOpenAIMockCreate();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('1st message with no data: returns handled=true (still in quote flow)', async () => {
    const state = makeState({ retryCount: 0 });
    // GPT returns nothing extracted
    mockGptExtraction(mockCreate, {});
    // GPT generates question for missing fields
    mockGptQuestion(mockCreate, 'Preciso dos dados pra cotação');

    const result = await handleQuoteMessage(phone, 'oi tudo bem', state);

    expect(result.handled).toBe(true);
    expect(sendTextMessage).toHaveBeenCalled();
  });

  it('2nd consecutive message with no data: returns handled=false (escapes quote flow)', async () => {
    const state = makeState({ retryCount: 1 }); // already failed once
    // GPT returns nothing extracted
    mockGptExtraction(mockCreate, {});

    const result = await handleQuoteMessage(phone, 'qual o horario de atendimento?', state);

    expect(result.handled).toBe(false);
    // State should be abandoned
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: expect.objectContaining({ status: 'abandoned' }),
        }),
      }),
    );
  });

  it('message with quote data resets retryCount and returns handled=true', async () => {
    const state = makeState({ retryCount: 1 }); // had 1 retry
    // GPT extracts lives
    mockGptExtraction(mockCreate, { lives: 3 });
    // GPT generates question for remaining missing fields
    mockGptQuestion(mockCreate, 'Qual a faixa etária?');

    const result = await handleQuoteMessage(phone, '3 vidas', state);

    expect(result.handled).toBe(true);
    // retryCount should be reset to 0 in persisted state
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: expect.objectContaining({ retryCount: 0 }),
        }),
      }),
    );
  });
});
