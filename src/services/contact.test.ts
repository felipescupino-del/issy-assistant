vi.mock('../lib/prisma', () => ({
  prisma: {
    contact: { upsert: vi.fn() },
  },
}));

import { isFirstMessage } from './contact';

describe('isFirstMessage', () => {
  it('returns true when createdAt and updatedAt are identical', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    expect(isFirstMessage({ createdAt: now, updatedAt: now })).toBe(true);
  });

  it('returns true when diff is less than 1 second (DB rounding)', () => {
    const created = new Date('2024-06-01T12:00:00.000Z');
    const updated = new Date('2024-06-01T12:00:00.500Z'); // 500ms diff
    expect(isFirstMessage({ createdAt: created, updatedAt: updated })).toBe(true);
  });

  it('returns false when diff exceeds 1 second', () => {
    const created = new Date('2024-06-01T12:00:00.000Z');
    const updated = new Date('2024-06-01T12:00:02.000Z'); // 2s diff
    expect(isFirstMessage({ createdAt: created, updatedAt: updated })).toBe(false);
  });
});
