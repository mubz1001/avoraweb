import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canFreeCancel,
  cancelDate,
  fitRate,
  fits,
  price,
  recommend,
  serviceFee,
  stayFit,
  topUp,
  type RoomOffer,
} from '@/lib/pricing';

const offers: RoomOffer[] = [
  { id: 'single', name: 'Single Room', maxGuests: 1, available: 3, nightly: 8000 },
  { id: 'double', name: 'Double Room', maxGuests: 2, available: 6, nightly: 10000 },
  { id: 'suite', name: 'Family Suite', maxGuests: 4, available: 2, nightly: 18000 },
];
const trip = { type: 'hotel' as const, checkIn: '2026-10-14', checkOut: '2026-10-16', guests: 2, rooms: 1 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
});
afterEach(() => vi.useRealTimers());

describe('price', () => {
  it('multiplies price × qty × nights and adds a 2% fee', () => {
    const p = price(offers, { double: 2 }, trip);
    expect(p.nights).toBe(2);
    expect(p.subtotal).toBe(40000);
    expect(p.fee).toBe(800);
    expect(p.total).toBe(40800);
    expect(p.rooms).toBe(2);
  });
  it('rounds the fee to whole dollars and hides it (0) when it rounds away', () => {
    expect(serviceFee(40000)).toBe(800);
    expect(serviceFee(12000)).toBe(200);
    expect(serviceFee(10000)).toBe(200);
    expect(serviceFee(2000)).toBe(0);
  });
  it('charges halls one day regardless of dates', () => {
    const p = price(offers, { double: 1 }, { ...trip, type: 'hall', checkOut: '2026-10-20' });
    expect(p.nights).toBe(1);
    expect(p.subtotal).toBe(10000);
  });
  it('ignores zero and unknown quantities', () => {
    expect(price(offers, { double: 0, ghost: 3 }, trip).lines).toHaveLength(0);
  });
});

describe('cancellation', () => {
  it('is cancel-by = check-in minus cancelDays', () => {
    expect(cancelDate('2026-10-14', 1)).toBe('2026-10-13');
    expect(cancelDate('2026-10-14', 7)).toBe('2026-10-07');
  });
  it('is free only while the deadline is today or later', () => {
    expect(canFreeCancel('2026-10-14', 1)).toBe(true);
    expect(canFreeCancel('2026-10-13', 1)).toBe(true);
    expect(canFreeCancel('2026-10-12', 1)).toBe(false);
  });
});

describe('recommend / fits / fitRate', () => {
  it('picks the cheapest type that maxGuests guests-per-room with enough rooms', () => {
    expect(recommend(offers, trip)).toEqual({ id: 'double', qty: 1 });
    expect(recommend(offers, { ...trip, guests: 4, rooms: 2 })).toEqual({ id: 'double', qty: 2 });
    expect(recommend(offers, { ...trip, guests: 1 })).toEqual({ id: 'single', qty: 1 });
  });
  it('falls back to the largest type, capped by what is left', () => {
    expect(recommend(offers, { ...trip, guests: 8, rooms: 1 })).toEqual({ id: 'suite', qty: 2 });
  });
  it('returns null when nothing is bookable', () => {
    expect(
      recommend(
        offers.map((o) => ({ ...o, available: 0 })),
        trip,
      ),
    ).toBeNull();
  });
  it('fits only when the total rooms left cover the request', () => {
    expect(fits(offers, { rooms: 5 })).toBe(true);
    expect(fits(offers, { rooms: 12 })).toBe(false);
    expect(
      fits(
        offers.map((o) => ({ ...o, available: 0 })),
        { rooms: 1 },
      ),
    ).toBe(false);
  });
  it('uses the cheapest fitting type for the card price', () => {
    expect(fitRate(offers, trip)).toBe(10000);
    expect(fitRate(offers, { ...trip, guests: 4, rooms: 1 })).toBe(18000);
  });
});

describe('stayFit', () => {
  const four = { guests: 4, rooms: 2 };
  it('measures beds and rooms against the search', () => {
    expect(stayFit(offers, { double: 1 }, four)).toEqual({
      guests: { have: 2, want: 4 },
      rooms: { have: 1, want: 2 },
      short: 2,
    });
  });
  it('is not short when one roomy room sleeps everyone, even with fewer rooms than asked', () => {
    const f = stayFit(offers, { suite: 1 }, four);
    expect(f.short).toBe(0);
    expect(f.rooms).toEqual({ have: 1, want: 2 });
  });
  it('counts nothing for an empty selection', () => {
    expect(stayFit(offers, {}, four)).toEqual({ guests: { have: 0, want: 4 }, rooms: { have: 0, want: 2 }, short: 4 });
  });
});

describe('topUp', () => {
  it('picks the cheapest room type that sleeps the guests still without a bed', () => {
    expect(topUp(offers, { double: 1 }, 2)).toBe('double');
    expect(topUp(offers, { single: 1 }, 1)).toBe('single');
  });
  it('skips types already fully selected, and falls back to the roomiest left', () => {
    expect(topUp(offers, { double: 6 }, 2)).toBe('suite');
    expect(topUp(offers, { double: 6, suite: 2 }, 3)).toBe('single');
  });
  it('returns null when nothing is left', () => {
    expect(topUp(offers, { single: 3, double: 6, suite: 2 }, 1)).toBeNull();
  });
});
