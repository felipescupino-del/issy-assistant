vi.mock('../lib/prisma', () => ({
  prisma: {
    conversation: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  },
}));

import { isHumanMode, isSessionExpired } from './conversation';

describe('isHumanMode', () => {
  it('returns true when humanMode is true', () => {
    expect(isHumanMode({ humanMode: true })).toBe(true);
  });

  it('returns false when humanMode is false', () => {
    expect(isHumanMode({ humanMode: false })).toBe(false);
  });
});

describe('isSessionExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when last update was less than 30 minutes ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const conversation = { updatedAt: new Date('2024-06-01T11:45:00Z') }; // 15min ago
    expect(isSessionExpired(conversation)).toBe(false);
  });

  it('returns true when last update was more than 30 minutes ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const conversation = { updatedAt: new Date('2024-06-01T11:29:00Z') }; // 31min ago
    expect(isSessionExpired(conversation)).toBe(true);
  });

  it('returns false when exactly 30 minutes (boundary)', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const conversation = { updatedAt: new Date('2024-06-01T11:30:00Z') }; // exactly 30min
    expect(isSessionExpired(conversation)).toBe(false);
  });
});
