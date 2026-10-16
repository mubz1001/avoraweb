import { linesOf, stayOf, type Stay } from '@/lib/basket';
import { addDays, daysFromToday, nightsBetween } from '@/lib/dates';
import { todayIso } from '@/lib/trip';
import type { BasketLine, Booking, Trip } from '@/types';

/** "Check-in today / tomorrow / in 5 days" for an upcoming stay; null once it has started. */
export function checkInText(checkIn: string, hall: boolean): string | null {
  const d = daysFromToday(checkIn);
  const word = hall ? 'Event' : 'Check-in';
  if (d < 0) return null;
  if (d === 0) return `${word} today`;
  if (d === 1) return `${word} tomorrow`;
  return `${word} in ${d} days`;
}

/** True once the stay's last night is behind us (check-out was before today). */
export const hasEnded = (b: Booking) => daysFromToday(b.trip.checkOut) < 0;

/** Whether the booking offers "Write a review": a confirmed stay whose last night is behind us. Only a client-side
 *  gate; the server decides who may review (the booking's owner, once per booking). */
export const canReview = (b: Booking) => b.status === 'confirmed' && hasEnded(b);

export const STATUS: Record<Booking['status'], { label: string; tone?: 'ok' | 'warn' }> = {
  confirmed: { label: 'Confirmed', tone: 'ok' },
  pending_payment: { label: 'Pending payment', tone: 'warn' },
  payment_failed: { label: 'Payment failed' },
  cancelled: { label: 'Cancelled' },
  failed: { label: 'Not confirmed · refunded', tone: 'warn' },
};

/** Rebook offers a finished, confirmed hotel stay again (halls are one-day events, booked fresh). */
export const canRebook = (b: Booking) => canReview(b) && b.property.type === 'hotel';

/** The same stay again: same property, party, rooms and number of nights, starting three days from today (the default
 *  a new search starts with). The caller puts `lines` in the basket as `stay` and opens the property at `trip`. */
export function rebookStay(b: Booking): { trip: Trip; stay: Stay; lines: BasketLine[] } {
  const nights = Math.max(nightsBetween(b.trip.checkIn, b.trip.checkOut), 1);
  const checkIn = addDays(todayIso(), 3);
  const trip: Trip = { ...b.trip, checkIn, checkOut: addDays(checkIn, nights) };
  const lines = linesOf(Object.fromEntries(b.quote.lines.map((l) => [l.roomTypeId, l.qty])));
  return { trip, stay: stayOf(b.property.id, trip), lines };
}
