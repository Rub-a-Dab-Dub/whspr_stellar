import { decodeCursor, encodeCursor } from './pagination';

describe('pagination helpers', () => {
  it('encodes and decodes cursor', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const cursor = encodeCursor(date, 'id-1');
    const decoded = decodeCursor(cursor);
    expect(decoded?.id).toBe('id-1');
    expect(decoded?.sentAt.toISOString()).toBe(date.toISOString());
  });

  it('returns null for invalid cursor', () => {
    expect(decodeCursor('not-base64')).toBeNull();
  });
});
