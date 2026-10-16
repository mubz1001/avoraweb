import { getProperty } from './catalog';
import { config } from '@/lib/config';
import { addDays, isIsoDate, nightsBetween, parseDate, today } from '@/lib/dates';
import type { Basket, BasketStay } from '@/types';

/** Longest stay a basket may hold (the date picker's range). */
export const MAX_NIGHTS = 30;

type Failure = { ok: false; status: number; code: string; message: string; fieldErrors?: Record<string, string> };
export type StayResult = { ok: true; stay: BasketStay } | Failure;
export type BasketResult = { ok: true; basket: Basket } | Failure;

const int = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
const invalid = (field: string, fieldCode: string, code = 'VALIDATION_FAILED'): Failure => ({
  ok: false,
  status: 422,
  code,
  message: code === 'DATE_IN_PAST' ? 'Choose dates from today onwards.' : 'That basket isn’t valid.',
  fieldErrors: { [field]: fieldCode },
});

/**
 * The server's rules for one stay (docs/06 §5b). Never trusts the client: the property type, the hall's one-day stay and
 * the timestamp come from the server, unknown room types are refused and repeated lines are summed. Stock is not
 * checked: a basket may hold rooms that sell out later; the basket shows that, and the quote refuses it at checkout.
 */
export function checkStay(raw: unknown, now = new Date()): StayResult {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const prop = typeof b.propertyId === 'string' ? getProperty(b.propertyId) : undefined;
  if (!prop) return { ok: false, status: 404, code: 'PROPERTY_NOT_FOUND', message: 'We couldn’t find that property.' };
  const hall = prop.type === 'hall';
  const { hotelGuestsMax, roomsMax, hallGuestsMin, hallGuestsMax } = config.limits;

  const checkIn = typeof b.checkIn === 'string' ? b.checkIn : '';
  if (!isIsoDate(checkIn) || parseDate(checkIn) < today()) return invalid('checkIn', 'DATE_IN_PAST', 'DATE_IN_PAST');
  const checkOut = hall ? addDays(checkIn, 1) : typeof b.checkOut === 'string' ? b.checkOut : '';
  if (!isIsoDate(checkOut) || parseDate(checkOut) <= parseDate(checkIn))
    return invalid('checkOut', 'CHECKOUT_BEFORE_CHECKIN');
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return invalid('checkOut', 'STAY_TOO_LONG');

  const guests = hall ? int(b.guests, hallGuestsMin, hallGuestsMax) : int(b.guests, 1, hotelGuestsMax);
  if (guests === null) return invalid('guests', 'OUT_OF_RANGE');
  const rooms = hall ? 1 : int(b.rooms, 1, roomsMax);
  if (rooms === null) return invalid('rooms', 'OUT_OF_RANGE');

  const qty: Record<string, number> = {};
  for (const l of Array.isArray(b.lines) ? (b.lines as unknown[]) : []) {
    const line = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
    const room = prop.roomTypes.find((r) => r.id === line.roomTypeId);
    const n = int(line.qty, 1, roomsMax);
    if (!room || n === null) return invalid('lines', 'INVALID_LINE');
    qty[room.id] = (qty[room.id] ?? 0) + n;
  }
  const lines = Object.entries(qty).map(([roomTypeId, n]) => ({ roomTypeId, qty: n }));
  if (!lines.length) return invalid('lines', 'REQUIRED');
  if (lines.some((l) => l.qty > roomsMax)) return invalid('lines', 'TOO_MANY');
  if (hall && (lines.length > 1 || lines[0]!.qty > 1)) return invalid('lines', 'ONE_HALL');

  const sent = typeof b.updatedAt === 'string' ? Date.parse(b.updatedAt) : NaN;
  return {
    ok: true,
    stay: {
      propertyId: prop.id,
      type: prop.type,
      checkIn,
      checkOut,
      guests,
      rooms,
      lines,
      // The client's time only orders two copies of a stay at sign-in; it can never be later than now.
      updatedAt: new Date(Number.isNaN(sent) ? now.getTime() : Math.min(sent, now.getTime())).toISOString(),
    },
  };
}

type StayId = Pick<BasketStay, 'propertyId' | 'checkIn' | 'checkOut'>;
export const sameStay = (a: StayId, b: StayId) =>
  a.propertyId === b.propertyId && a.checkIn === b.checkIn && a.checkOut === b.checkOut;

/**
 * The whole basket: every stay passes `checkStay` (the first that doesn't refuses the request, naming it), there are at
 * most `basketStaysMax`, and a stay sent twice (same property and dates) is refused rather than guessed at.
 */
export function checkBasket(raw: unknown, now = new Date()): BasketResult {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(b.stays) ? (b.stays as unknown[]) : [];
  if (!list.length) return invalid('stays', 'REQUIRED');
  if (list.length > config.limits.basketStaysMax) return invalid('stays', 'TOO_MANY');
  const stays: BasketStay[] = [];
  for (const [i, raw] of list.entries()) {
    const r = checkStay(raw, now);
    if (!r.ok) return { ...r, fieldErrors: prefix(r.fieldErrors, `stays.${i}.`) };
    if (stays.some((s) => sameStay(s, r.stay))) return invalid(`stays.${i}`, 'DUPLICATE_STAY');
    stays.push(r.stay);
  }
  return { ok: true, basket: { stays, updatedAt: now.toISOString() } };
}

const prefix = (e: Record<string, string> | undefined, p: string) =>
  e ? Object.fromEntries(Object.entries(e).map(([k, v]) => [p + k, v])) : undefined;

/** Sign-in merge: the two baskets combined stay by stay; where both hold a stay, the copy changed last wins. */
export function mergeBaskets(account: Basket | null | undefined, device: Basket, now = new Date()): Basket {
  const stays = [...(account?.stays ?? [])];
  for (const d of device.stays) {
    const at = stays.findIndex((s) => sameStay(s, d));
    if (at < 0) stays.push(d);
    else if (Date.parse(d.updatedAt) > Date.parse(stays[at]!.updatedAt)) stays[at] = d;
  }
  return { stays: stays.slice(-config.limits.basketStaysMax), updatedAt: now.toISOString() };
}

/** The basket without the stays just booked; none left is no basket. */
export function withoutBooked(b: Basket | null | undefined, booked: StayId[]): Basket | null {
  const stays = (b?.stays ?? []).filter((s) => !booked.some((x) => sameStay(s, x)));
  return stays.length ? { stays, updatedAt: new Date().toISOString() } : null;
}
