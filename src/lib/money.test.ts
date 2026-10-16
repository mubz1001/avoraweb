import { describe, expect, it } from 'vitest';
import { formatMoney, guestsUpTo, plural } from './money';

describe('money helpers', () => {
  it('formats whole dollars from cents', () => {
    expect(formatMoney(20000)).toBe('$200');
    expect(formatMoney({ amount: 123456, currency: 'USD' })).toBe('$1,235');
  });

  it('pluralises', () => {
    expect(plural(1, 'night')).toBe('1 night');
    expect(plural(2, 'night')).toBe('2 nights');
  });

  it('says how many guests a room holds the same way everywhere', () => {
    expect(guestsUpTo(1)).toBe('Up to 1 guest');
    expect(guestsUpTo(2)).toBe('Up to 2 guests');
    expect(guestsUpTo(4)).toBe('Up to 4 guests');
  });
});
