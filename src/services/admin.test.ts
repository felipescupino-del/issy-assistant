vi.mock('../config', () => ({
  config: {
    admin: { phoneNumbers: ['5511999999999', '5511888888888'] },
    zapi: { instanceId: 'test', instanceToken: 'test', clientToken: 'test' },
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    conversation: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    contact: { findUnique: vi.fn() },
    message: { findFirst: vi.fn() },
  },
}));

vi.mock('./whatsapp', () => ({
  sendTextMessage: vi.fn(),
}));

vi.mock('./conversation', () => ({
  setHumanMode: vi.fn(),
}));

import { isAdminPhone, isAdminCommand } from './admin';

describe('isAdminPhone', () => {
  it('returns true for known admin phone', () => {
    expect(isAdminPhone('5511999999999')).toBe(true);
    expect(isAdminPhone('5511888888888')).toBe(true);
  });

  it('returns false for non-admin phone', () => {
    expect(isAdminPhone('5511777777777')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAdminPhone('')).toBe(false);
  });
});

describe('isAdminCommand', () => {
  it('recognizes /bot', () => {
    expect(isAdminCommand('/bot')).toBe(true);
  });

  it('recognizes /status', () => {
    expect(isAdminCommand('/status')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isAdminCommand('/BOT')).toBe(true);
    expect(isAdminCommand('/Status')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isAdminCommand('  /bot  ')).toBe(true);
  });

  it('returns false for /humano (flows through intent pipeline)', () => {
    expect(isAdminCommand('/humano')).toBe(false);
  });

  it('returns false for regular text', () => {
    expect(isAdminCommand('hello')).toBe(false);
  });
});
