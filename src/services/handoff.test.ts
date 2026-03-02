vi.mock('../config', () => ({
  config: {
    openai: { apiKey: 'sk-test', model: 'gpt-4o-mini' },
    zapi: { instanceId: 'test', instanceToken: 'test', clientToken: 'test' },
  },
}));

vi.mock('../lib/prisma', () => ({ prisma: {} }));
vi.mock('./whatsapp', () => ({ sendTextMessage: vi.fn() }));
vi.mock('./conversation', () => ({ setHumanMode: vi.fn() }));
vi.mock('./history', () => ({ saveMessage: vi.fn() }));

import { buildHandoffBriefing } from './handoff';

describe('buildHandoffBriefing', () => {
  const contact = { name: 'João Silva', phone: '5511999999999' };
  const history = [
    { role: 'user', content: 'Oi, preciso de ajuda' },
    { role: 'assistant', content: 'Como posso ajudar?' },
    { role: 'user', content: 'Quero falar com humano' },
  ];
  const summary = 'Corretor precisa de atendimento humano sobre cotação.';

  it('includes contact name and phone', () => {
    const briefing = buildHandoffBriefing(contact, history, summary);
    expect(briefing).toContain('João Silva');
    expect(briefing).toContain('5511999999999');
  });

  it('includes summary', () => {
    const briefing = buildHandoffBriefing(contact, history, summary);
    expect(briefing).toContain(summary);
  });

  it('includes message count', () => {
    const briefing = buildHandoffBriefing(contact, history, summary);
    expect(briefing).toContain('3');
  });

  it('includes last user messages as bullets', () => {
    const briefing = buildHandoffBriefing(contact, history, summary);
    expect(briefing).toContain('- Oi, preciso de ajuda');
    expect(briefing).toContain('- Quero falar com humano');
  });

  it('handles empty history', () => {
    const briefing = buildHandoffBriefing(contact, [], summary);
    expect(briefing).toContain('sem mensagens anteriores');
  });

  it('truncates long messages to 120 chars', () => {
    const longMsg = 'A'.repeat(200);
    const longHistory = [{ role: 'user', content: longMsg }];
    const briefing = buildHandoffBriefing(contact, longHistory, summary);
    // The bullet should be truncated
    expect(briefing).not.toContain('A'.repeat(200));
    expect(briefing).toContain('A'.repeat(120));
  });
});
