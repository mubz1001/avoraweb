import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  basketTrip,
  findStay,
  isExpired,
  isSameStay,
  linesOf,
  moveStay,
  parseBasket,
  readDeviceBasket,
  roomCount,
  selOf,
  stayKey,
  stayOf,
  staysBooked,
  withoutStays,
  withStay,
  writeDeviceBasket,
} from './index';
import type { Basket, Trip } from '@/types';

const trip: Trip = {
  type: 'hotel',
  city: 'Mogadishu',
  checkIn: '2026-10-15',
  checkOut: '2026-10-17',
  guests: 2,
  rooms: 1,
};
const later: Trip = { ...trip, checkIn: '2026-10-20', checkOut: '2026-10-22' };
const double = (qty: number) => [{ roomTypeId: 'double', qty }];
const suite = (qty: number) => [{ roomTypeId: 'suite', qty }];

/** A basket of three stays: Jazeera and Lido on the same dates, and Jazeera again later. */
const make = (): Basket =>
  withStay(
    withStay(withStay(null, stayOf('jazeera', trip), double(2)), stayOf('lido', trip), suite(1)),
    stayOf('jazeera', later),
    double(1),
  )!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('basket rules', () => {
  it('identifies a stay by property and dates, whatever the party size', () => {
    const a = stayOf('jazeera', trip);
    expect(isSameStay(a, stayOf('jazeera', { ...trip, guests: 4 }))).toBe(true);
    expect(isSameStay(a, stayOf('lido', trip))).toBe(false);
    expect(isSameStay(a, stayOf('jazeera', later))).toBe(false);
    expect(isSameStay(null, a)).toBe(false);
    expect(stayKey(a)).toBe('jazeera|2026-10-15|2026-10-17');
  });

  it('holds rooms at several hotels and several dates at once', () => {
    const b = make();
    expect(b.stays.map(stayKey)).toEqual([
      'jazeera|2026-10-15|2026-10-17',
      'lido|2026-10-15|2026-10-17',
      'jazeera|2026-10-20|2026-10-22',
    ]);
    expect(roomCount(b)).toBe(4);
    expect(roomCount(null)).toBe(0);
  });

  it('changes one stay without touching the others', () => {
    const before = make();
    const after = withStay(before, stayOf('lido', trip), suite(3))!;
    expect(findStay(after, stayOf('lido', trip))?.lines).toEqual(suite(3));
    // The other two stays are the very same objects: nothing about them was rewritten.
    expect(after.stays[0]).toBe(before.stays[0]);
    expect(after.stays[2]).toBe(before.stays[2]);
    // Adding more rooms at an hotel already there updates that stay in place, in its slot.
    const more = withStay(before, stayOf('jazeera', trip), double(4))!;
    expect(more.stays.map(stayKey)).toEqual(before.stays.map(stayKey));
    expect(more.stays[0]!.lines).toEqual(double(4));
    expect(more.stays[1]).toBe(before.stays[1]);
  });

  it('removes a stay when it has no rooms left, and is no basket when none remain', () => {
    const b = withStay(make(), stayOf('lido', trip), [])!;
    expect(b.stays.map((s) => s.propertyId)).toEqual(['jazeera', 'jazeera']);
    expect(withStay(withStay(b, stayOf('jazeera', trip), []), stayOf('jazeera', later), [])).toBeNull();
    expect(withStay(null, stayOf('jazeera', trip), [])).toBeNull();
  });

  it('moves a stay to new dates, keeping its rooms and every other stay', () => {
    const b = moveStay(make(), stayOf('lido', trip), stayOf('lido', later))!;
    expect(b.stays.map(stayKey)).toEqual([
      'jazeera|2026-10-15|2026-10-17',
      'jazeera|2026-10-20|2026-10-22',
      'lido|2026-10-20|2026-10-22',
    ]);
    expect(findStay(b, stayOf('lido', later))?.lines).toEqual(suite(1));
  });

  it('combines a stay moved onto dates it already has, adding the rooms', () => {
    const b = moveStay(make(), stayOf('jazeera', trip), stayOf('jazeera', later))!;
    expect(b.stays.map(stayKey)).toEqual(['lido|2026-10-15|2026-10-17', 'jazeera|2026-10-20|2026-10-22']);
    expect(findStay(b, stayOf('jazeera', later))?.lines).toEqual(double(3));
  });

  it('keeps the party when only the guests change (same stay, updated in place)', () => {
    const b = moveStay(make(), stayOf('jazeera', trip), stayOf('jazeera', { ...trip, guests: 5 }))!;
    expect(b.stays).toHaveLength(3);
    expect(b.stays[0]!.guests).toBe(5);
  });

  it('converts to and from the sel parameter, and gives a stay back as a trip', () => {
    expect(selOf(double(2))).toEqual({ double: 2 });
    expect(linesOf({ double: 2, suite: 0 })).toEqual(double(2));
    expect(basketTrip(stayOf('jazeera', trip), 'Mogadishu')).toEqual(trip);
  });

  it('expires a stay once its check-in has passed, and only that stay', () => {
    const b = make();
    expect(b.stays.map(isExpired)).toEqual([false, false, false]);
    expect(isExpired({ checkIn: '2026-10-11' })).toBe(true);
  });

  it('never holds more stays than the limit (the oldest go first)', () => {
    let b: Basket | null = null;
    for (let i = 1; i <= 12; i++) {
      const day = `2026-11-${String(i).padStart(2, '0')}`;
      b = withStay(
        b,
        stayOf('jazeera', { ...trip, checkIn: day, checkOut: `2026-12-${String(i).padStart(2, '0')}` }),
        double(1),
      );
    }
    expect(b!.stays).toHaveLength(10);
    expect(b!.stays[0]!.checkIn).toBe('2026-11-03');
  });

  it('treats a tampered device copy as no basket', () => {
    const b = make();
    expect(parseBasket(b)).toEqual(b);
    const tampered = (patch: object) => ({ ...b, stays: [{ ...b.stays[0]!, ...patch }] });
    expect(parseBasket(tampered({ lines: [{ roomTypeId: '<img onerror=x>', qty: 1 }] }))).toBeNull();
    expect(parseBasket(tampered({ lines: [{ roomTypeId: 'double', qty: -3 }] }))).toBeNull();
    expect(parseBasket(tampered({ propertyId: '../admin' }))).toBeNull();
    expect(parseBasket(tampered({ guests: '2' }))).toBeNull();
    expect(parseBasket({ ...b, stays: [] })).toBeNull();
    expect(parseBasket({ ...b, stays: Array(11).fill(b.stays[0]) })).toBeNull();
    expect(parseBasket('nonsense')).toBeNull();
  });
});

describe('the device copy', () => {
  it('survives a refresh: written, then read back whole', () => {
    const b = make();
    writeDeviceBasket(b);
    expect(readDeviceBasket()).toEqual(b);
    writeDeviceBasket(null);
    expect(readDeviceBasket()).toBeNull();
  });

  it('drops only the booked stays, and the whole basket once none are left', () => {
    writeDeviceBasket(make());
    staysBooked([stayOf('lido', trip), stayOf('jazeera', trip)]);
    expect(readDeviceBasket()?.stays.map(stayKey)).toEqual(['jazeera|2026-10-20|2026-10-22']);
    staysBooked([stayOf('ghost', trip)]);
    expect(readDeviceBasket()?.stays).toHaveLength(1);
    staysBooked([stayOf('jazeera', later)]);
    expect(readDeviceBasket()).toBeNull();
    expect(withoutStays(null, [stayOf('jazeera', trip)])).toBeNull();
  });
});
