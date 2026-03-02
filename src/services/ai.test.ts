vi.mock('../config', () => ({
  config: {
    openai: { apiKey: 'sk-test', model: 'gpt-4o-mini', temperature: 0.85, maxTokens: 500 },
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {},
}));

import { buildSystemPrompt, formatFactsBlock, getFallbackMessage } from './ai';
import { InsuranceFacts } from '../types/index';

describe('buildSystemPrompt', () => {
  it('includes contact name', () => {
    const prompt = buildSystemPrompt('João', 'qa', null, {});
    expect(prompt).toContain('João');
  });

  it('includes Luna identity', () => {
    const prompt = buildSystemPrompt('Maria', 'qa', null, {});
    expect(prompt).toContain('Luna');
    expect(prompt).toContain('Grupo Futura União');
  });

  it('includes quote context for quote intent', () => {
    const prompt = buildSystemPrompt('Carlos', 'quote', null, {});
    expect(prompt).toContain('cotação');
  });

  it('includes handoff context for handoff intent', () => {
    const prompt = buildSystemPrompt('Ana', 'handoff', null, {});
    expect(prompt).toContain('[TRANSFER]');
  });

  it('includes greeting context for greeting intent', () => {
    const prompt = buildSystemPrompt('Pedro', 'greeting', null, {});
    expect(prompt).toContain('Cumprimente');
  });

  it('includes new session context when isNewSession is true', () => {
    const prompt = buildSystemPrompt('Luna', 'qa', null, { isNewSession: true });
    expect(prompt).toContain('nova sessão');
  });

  it('includes product facts when productType is provided', () => {
    const prompt = buildSystemPrompt('Test', 'qa', 'saude', {});
    expect(prompt).toContain('Plano de Saúde');
  });
});

describe('formatFactsBlock', () => {
  const facts: InsuranceFacts = {
    productName: 'Test Product',
    description: 'Test description',
    commonCoverages: ['Coverage A', 'Coverage B'],
    commonExclusions: ['Exclusion A'],
    acceptanceRules: ['Rule A'],
    importantNotes: ['Note A'],
  };

  it('includes product name', () => {
    expect(formatFactsBlock(facts)).toContain('Test Product');
  });

  it('includes description', () => {
    expect(formatFactsBlock(facts)).toContain('Test description');
  });

  it('lists coverages', () => {
    const result = formatFactsBlock(facts);
    expect(result).toContain('- Coverage A');
    expect(result).toContain('- Coverage B');
  });

  it('lists exclusions', () => {
    expect(formatFactsBlock(facts)).toContain('- Exclusion A');
  });

  it('lists acceptance rules', () => {
    expect(formatFactsBlock(facts)).toContain('- Rule A');
  });

  it('lists important notes', () => {
    expect(formatFactsBlock(facts)).toContain('- Note A');
  });
});

describe('getFallbackMessage', () => {
  it('returns a non-empty string', () => {
    const msg = getFallbackMessage();
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('contains apologetic tone', () => {
    expect(getFallbackMessage()).toContain('Desculpe');
  });
});
