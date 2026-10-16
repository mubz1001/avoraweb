import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canRebook, canReview, checkInText, rebookStay, STATUS } from './bookingInfo';
import type { Booking } from '@/types';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe('booking card text', () => {
  it('counts down to check-in, and stops once the stay has started', () => {
    expect(checkInText('2026-10-15', false)).toBe('Check-in today');
    expect(checkInText('2026-10-16', false)).toBe('Check-in tomorrow');
    expect(checkInText('2026-10-20', false)).toBe('Check-in in 5 days');
    expect(checkInText('2026-10-20', true)).toBe('Event in 5 days');
    expect(checkInText('2026-10-14', false)).toBeNull();
  });
  it('labels every status, green only for confirmed', () => {
    expect(STATUS.confirmed).toEqual({ label: 'Confirmed', tone: 'ok' });
    expect(STATUS.pending_payment.tone).toBe('warn');
    expect(STATUS.cancelled.tone).toBeUndefined();
  });
});

describe('canReview', () => {
  const stay = (status: Booking['status'], checkOut: string) => ({ status, trip: { checkOut } }) as unknown as Booking;
  it('offers a review only for a confirmed stay that has ended', () => {
    expect(canReview(stay('confirmed', '2026-10-14'))).toBe(true);
    expect(canReview(stay('confirmed', '2026-10-15'))).toBe(false); // checks out today: still in the stay
    expect(canReview(stay('confirmed', '2026-10-20'))).toBe(false);
  });
  it('never offers one for a booking that did not happen', () => {
    for (const s of ['pending_payment', 'payment_failed', 'cancelled', 'failed'] as const)
      expect(canReview(stay(s, '2026-10-01'))).toBe(false);
  });
});

describe('rebook', () => {
  const past = {
    status: 'confirmed',
    property: { id: 'lido', type: 'hotel' },
    trip: { type: 'hotel', city: 'Mogadishu', checkIn: '2026-10-01', checkOut: '2026-10-04', guests: 3, rooms: 2 },
    quote: {
      lines: [
        { roomTypeId: 'double', qty: 1 },
        { roomTypeId: 'single', qty: 1 },
      ],
    },
  } as unknown as Booking;

  it('is offered only for a finished, confirmed hotel stay', () => {
    expect(canRebook(past)).toBe(true);
    expect(canRebook({ ...past, status: 'cancelled' } as Booking)).toBe(false);
    expect(canRebook({ ...past, trip: { ...past.trip, checkOut: '2026-10-20' } } as Booking)).toBe(false);
  });

  it('keeps the party, rooms and number of nights, starting three days from today', () => {
    const { trip, stay, lines } = rebookStay(past);
    expect(trip).toMatchObject({ checkIn: '2026-10-18', checkOut: '2026-10-21', guests: 3, rooms: 2 });
    expect(stay).toMatchObject({
      propertyId: 'lido',
      checkIn: '2026-10-18',
      checkOut: '2026-10-21',
      guests: 3,
      rooms: 2,
    });
    expect(lines).toEqual([
      { roomTypeId: 'double', qty: 1 },
      { roomTypeId: 'single', qty: 1 },
    ]);
  });
});
