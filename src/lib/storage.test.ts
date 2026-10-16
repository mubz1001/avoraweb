import { describe, expect, it } from 'vitest';
import { makeStore } from '@/lib/storage';

const blocked = (): Storage => {
  throw new DOMException('denied', 'SecurityError');
};

describe('storage', () => {
  it('round-trips JSON and supports take()', () => {
    const s = makeStore(() => localStorage);
    expect(s.set('k', { a: 1 })).toBe(true);
    expect(s.get('k', null)).toEqual({ a: 1 });
    expect(s.take('k', null)).toEqual({ a: 1 });
    expect(s.get('k', 'gone')).toBe('gone');
  });
  it('returns the fallback for corrupt JSON', () => {
    localStorage.setItem('bad', '{oops');
    expect(makeStore(() => localStorage).get('bad', 7)).toBe(7);
  });
  it('never throws when storage is blocked', () => {
    const s = makeStore(blocked);
    expect(s.get('k', 'd')).toBe('d');
    expect(s.set('k', 1)).toBe(false);
    expect(() => s.del('k')).not.toThrow();
    expect(s.take('k', 'd')).toBe('d');
  });
});
