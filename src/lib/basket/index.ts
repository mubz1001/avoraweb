import { isApiError } from '@/lib/api/client';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { basketSchema } from '@/lib/api/schemas';
import { config } from '@/lib/config';
import { parseDate, today } from '@/lib/dates';
import { queryClient } from '@/lib/queryClient';
import { storageKeys } from '@/lib/storage';
import { clearLocalValue, readLocalValue, writeLocalValue } from '@/lib/useLocalValue';
import type { Basket, BasketLine, BasketStay, Trip } from '@/types';

/**
 * The basket (docs/02 §4.14): stays at any number of properties, each with its own dates, party and rooms. One stay per
 * property + dates; changing one never touches another. It lives on the device for guests and on the account for
 * members, and a device basket joins the account at sign-in. These are the pure rules and the device copy; `useBasket`
 * is the React side.
 */
export type Stay = Omit<BasketStay, 'lines' | 'updatedAt'>;
type StayId = Pick<BasketStay, 'propertyId' | 'checkIn' | 'checkOut'>;

export const stayOf = (propertyId: string, trip: Trip): Stay => ({
  propertyId,
  type: trip.type,
  checkIn: trip.checkIn,
  checkOut: trip.checkOut,
  guests: trip.guests,
  rooms: trip.rooms,
});

/** A stay's identity: property and dates. Guests and rooms can change without it becoming another stay. */
export const stayKey = (s: StayId) => `${s.propertyId}|${s.checkIn}|${s.checkOut}`;

export const isSameStay = (a: StayId | null | undefined, b: StayId | null | undefined) =>
  !!a && !!b && stayKey(a) === stayKey(b);

export const findStay = (b: Basket | null, s: StayId) => b?.stays.find((x) => isSameStay(x, s)) ?? null;

/** A stay whose check-in has passed can't be booked; it is shown as expired until removed. */
export const isExpired = (s: Pick<BasketStay, 'checkIn'>) => parseDate(s.checkIn) < today();

export const roomCount = (b: Basket | null) =>
  b ? b.stays.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.qty, 0), 0) : 0;

/** A stay's trip, for links back to the property and to checkout. */
export const basketTrip = (s: Stay, city = ''): Trip => ({
  type: s.type,
  city,
  checkIn: s.checkIn,
  checkOut: s.checkOut,
  guests: s.guests,
  rooms: s.rooms,
});

/** Quantities as the property page and the `sel` URL parameter use them. */
export const selOf = (lines: BasketLine[]): Record<string, number> =>
  Object.fromEntries(lines.map((l) => [l.roomTypeId, l.qty]));

export const linesOf = (sel: Record<string, number>): BasketLine[] =>
  Object.entries(sel)
    .filter(([, qty]) => qty > 0)
    .map(([roomTypeId, qty]) => ({ roomTypeId, qty }));

/** The basket that results from giving `stay` these rooms: the stay is updated in place, added at the end, or (no
 *  rooms) removed. Every other stay is left exactly as it was. No stays left is no basket. */
export function withStay(b: Basket | null, stay: Stay, lines: BasketLine[]): Basket | null {
  const now = new Date().toISOString();
  const stays = b?.stays ?? [];
  const at = stays.findIndex((s) => isSameStay(s, stay));
  const next = lines.length ? { ...stay, lines, updatedAt: now } : null;
  const out =
    at < 0
      ? next
        ? [...stays, next]
        : stays
      : next
        ? stays.map((s, i) => (i === at ? next : s))
        : stays.filter((_, i) => i !== at);
  return out.length ? { stays: out.slice(-config.limits.basketStaysMax), updatedAt: now } : null;
}

/** Moves a stay to new dates or party (the property page's trip changed), keeping its rooms. If the basket already
 *  holds the property on the new dates, the two are combined. */
export function moveStay(b: Basket | null, from: StayId, to: Stay): Basket | null {
  const old = findStay(b, from);
  if (!old || isSameStay(from, to)) return old ? withStay(b, to, old.lines) : b;
  const there = findStay(b, to);
  const sel = selOf(old.lines);
  for (const l of there?.lines ?? []) sel[l.roomTypeId] = (sel[l.roomTypeId] ?? 0) + l.qty;
  return withStay(withStay(b, old, []), to, linesOf(sel));
}

/** The basket without these stays (they were booked). */
export const withoutStays = (b: Basket | null, gone: StayId[]): Basket | null =>
  gone.reduce<Basket | null>((acc, s) => (findStay(acc, s) ? withStay(acc, findStay(acc, s)!, []) : acc), b);

/** The device copy. localStorage is user-editable, so it is parsed like an API response; anything malformed is none. */
export function parseBasket(raw: unknown): Basket | null {
  const r = basketSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export const readDeviceBasket = () => parseBasket(readLocalValue<unknown>(storageKeys.basket, null));
export const clearDeviceBasket = () => clearLocalValue(storageKeys.basket);
export const writeDeviceBasket = (b: Basket | null) =>
  b ? writeLocalValue(storageKeys.basket, b) : clearDeviceBasket();

/**
 * Brings the device basket into the account (sign-in): the server combines the two stay by stay, keeping the copy of a
 * stay that changed last. Stays the server refuses (dates passed, property gone) are dropped; on a network error the
 * device basket stays and joins on the next sign-in.
 */
export async function mergeDeviceBasket() {
  const device = readDeviceBasket();
  if (!device) return;
  try {
    const { basket } = await accountApi.putBasket(device, true);
    queryClient.setQueryData(queryKeys.basket, { basket });
    clearDeviceBasket();
  } catch (e) {
    if (isApiError(e) && (e.status === 422 || e.status === 404)) clearDeviceBasket();
  }
}

/** Bookings were made: those stays are done. The server removes them from the account's basket; this, the device's. */
export function staysBooked(stays: StayId[]) {
  const device = readDeviceBasket();
  if (device) writeDeviceBasket(withoutStays(device, stays));
  void queryClient.invalidateQueries({ queryKey: queryKeys.basket });
}
