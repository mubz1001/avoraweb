import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSel, parseTrip, selString, serializeTrip } from '@/lib/trip';

const q = (s: string) => new URLSearchParams(s);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
});
afterEach(() => vi.useRealTimers());

describe('parseTrip', () => {
  it('defaults to today+3 → today+5, 2 guests, 1 room, Mogadishu', () => {
    expect(parseTrip(q(''))).toEqual({
      type: 'hotel',
      city: 'Mogadishu',
      checkIn: '2026-10-15',
      checkOut: '2026-10-17',
      guests: 2,
      rooms: 1,
    });
  });
  it('resets a past check-in to today+3', () => {
    expect(parseTrip(q('in=2026-10-01&out=2026-10-03')).checkIn).toBe('2026-10-15');
  });
  it('resets check-out <= check-in to check-in+2', () => {
    expect(parseTrip(q('in=2026-10-20&out=2026-10-20')).checkOut).toBe('2026-10-22');
    expect(parseTrip(q('in=2026-10-20&out=2026-10-18')).checkOut).toBe('2026-10-22');
  });
  it('rejects malformed dates', () => {
    expect(parseTrip(q('in=2026-02-31&out=nope')).checkIn).toBe('2026-10-15');
  });
  it('limits hotel guests to 1–8 (else 2) and rooms to min(5, guests)', () => {
    expect(parseTrip(q('guests=9')).guests).toBe(2);
    expect(parseTrip(q('guests=0')).guests).toBe(2);
    expect(parseTrip(q('guests=abc')).guests).toBe(2);
    expect(parseTrip(q('guests=3&rooms=9')).rooms).toBe(3);
    expect(parseTrip(q('guests=8&rooms=9')).rooms).toBe(5);
    expect(parseTrip(q('guests=2&rooms=0')).rooms).toBe(1);
  });
  it('keeps an explicit empty city (all cities) but falls back to the saved one when absent', () => {
    expect(parseTrip(q('city=')).city).toBe('');
    expect(parseTrip(q(''), { city: 'Hargeisa' }).city).toBe('Hargeisa');
  });
  it('ignores ?type=hall while wedding halls are parked', () => {
    expect(parseTrip(q('type=hall&guests=300')).type).toBe('hotel');
  });
  it('round-trips through serializeTrip', () => {
    const t = parseTrip(q('city=Garowe&in=2026-10-20&out=2026-10-23&guests=4&rooms=2'));
    expect(parseTrip(q(serializeTrip(t)))).toEqual(t);
  });
});

describe('sel', () => {
  it('parses positive integer quantities only', () => {
    expect(parseSel('double:2,suite:1,bad:0,x:-1,y:1.5,:3,z')).toEqual({ double: 2, suite: 1 });
    expect(parseSel(null)).toEqual({});
  });
  it('serialises without zero lines', () => {
    expect(selString({ double: 2, single: 0, suite: 1 })).toBe('double:2,suite:1');
  });
});
