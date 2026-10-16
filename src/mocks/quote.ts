import { getProperty, offersFor } from './catalog';
import { db, rid, save, type QuoteRec } from './db';
import { config } from '@/lib/config';
import { addDays, isIsoDate, parseDate, today } from '@/lib/dates';
import { canFreeCancel, cancelDate, price } from '@/lib/pricing';
import type { StayQuote, Trip } from '@/types';

/** One stay to price: a property, its dates and party, and the rooms. */
export interface StayRequest {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  selection: { roomTypeId: string; qty: number }[];
}

type Failure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Which stays (by position) the failure is about. */
  stays?: number[];
};
export type StayQuoteResult = { ok: true; stay: StayQuote; req: StayRequest; trip: Trip } | Failure;
export type QuoteResult = { ok: true; rec: QuoteRec } | Failure;

const QUOTE_MS = 15 * 60e3;
const usd = (amount: number) => ({ amount, currency: 'USD' as const });
const chooseRoom: Failure = {
  ok: false,
  status: 422,
  code: 'VALIDATION_FAILED',
  message: 'Choose a room.',
  fieldErrors: { selection: 'REQUIRED' },
};

/** One stay's authoritative price (docs/06 §4.1): validates dates and stock, then prices with the shared pricing module.
 *  Also used at payment time to check that the stay can still be booked. */
export function quoteStay(req: StayRequest): StayQuoteResult {
  const prop = getProperty(req.propertyId);
  if (!prop) return { ok: false, status: 404, code: 'PROPERTY_NOT_FOUND', message: 'We couldn’t find that property.' };
  const hall = prop.type === 'hall';
  const checkOut = hall ? addDays(req.checkIn, 1) : req.checkOut;
  if (!isIsoDate(req.checkIn) || !isIsoDate(checkOut) || parseDate(req.checkIn) < today()) {
    return {
      ok: false,
      status: 422,
      code: 'DATE_IN_PAST',
      message: 'Choose dates from today onwards.',
      fieldErrors: { checkIn: 'DATE_IN_PAST' },
    };
  }
  if (parseDate(checkOut) <= parseDate(req.checkIn)) {
    return {
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Check-out must be after check-in.',
      fieldErrors: { checkOut: 'CHECKOUT_BEFORE_CHECKIN' },
    };
  }
  const offers = offersFor(prop.id);
  const sel: Record<string, number> = {};
  const stock: Record<string, string> = {};
  for (const s of req.selection.filter((x) => x.qty > 0)) {
    const offer = offers.find((o) => o.id === s.roomTypeId);
    if (!offer || !Number.isInteger(s.qty)) return chooseRoom;
    sel[offer.id] = (sel[offer.id] ?? 0) + s.qty;
    if (sel[offer.id]! > offer.available || (hall && sel[offer.id]! > 1))
      stock[`selection.${offer.id}`] = `ONLY_${offer.available}_LEFT`;
  }
  if (!Object.keys(sel).length) return chooseRoom;
  if (Object.keys(stock).length)
    return {
      ok: false,
      status: 409,
      code: 'ROOM_UNAVAILABLE',
      message: 'Some rooms are no longer available.',
      fieldErrors: stock,
    };

  const rooms = Object.values(sel).reduce((a, b) => a + b, 0);
  const trip: Trip = {
    type: prop.type,
    city: prop.city,
    checkIn: req.checkIn,
    checkOut,
    guests: req.guests,
    rooms: hall ? 1 : rooms,
  };
  const p = price(offers, sel, trip);
  const days = prop.cancellation.freeUntilDaysBefore;
  const selection = Object.entries(sel).map(([roomTypeId, qty]) => ({ roomTypeId, qty }));
  return {
    ok: true,
    trip,
    req: { propertyId: prop.id, checkIn: req.checkIn, checkOut, guests: req.guests, selection },
    stay: {
      propertyId: prop.id,
      checkIn: req.checkIn,
      checkOut,
      guests: req.guests,
      nights: p.nights,
      lines: p.lines.map((l) => ({
        roomTypeId: l.offer.id,
        name: l.offer.name,
        qty: l.qty,
        unitPrice: usd(l.offer.nightly),
        total: usd(l.total),
      })),
      subtotal: usd(p.subtotal),
      serviceFee: usd(p.fee),
      total: usd(p.total),
      ...(canFreeCancel(req.checkIn, days) ? { freeCancellationUntil: cancelDate(req.checkIn, days) } : {}),
    },
  };
}

/** Errors about stay `i` name it: field keys get a `stays.<i>.` prefix and `stays` lists it. */
export const forStay = (f: Failure, i: number): Failure => ({
  ...f,
  stays: [i],
  ...(f.fieldErrors
    ? { fieldErrors: Object.fromEntries(Object.entries(f.fieldErrors).map(([k, v]) => [`stays.${i}.${k}`, v])) }
    : {}),
});

/**
 * The price for one checkout (docs/06 §4.1): every stay is quoted on its own (its own lines, fee, total and cancellation
 * terms, since each becomes its own booking) and the total is their sum. Stock problems are reported for every stay at
 * once, so the guest can fix them in one go; any other problem names the first stay it found.
 */
export function buildQuote(req: { stays: StayRequest[] }): QuoteResult {
  const list = req.stays;
  if (!list.length) return chooseRoom;
  if (list.length > config.limits.basketStaysMax)
    return {
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'That’s too many stays for one checkout.',
      fieldErrors: { stays: 'TOO_MANY' },
    };
  const key = (s: StayRequest) => `${s.propertyId}|${s.checkIn}|${s.checkOut}`;
  if (new Set(list.map(key)).size !== list.length)
    return {
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'A stay is in the request twice.',
      fieldErrors: { stays: 'DUPLICATE_STAY' },
    };

  const quoted = list.map(quoteStay);
  const unavailable = quoted.flatMap((q, i) => (!q.ok && q.code === 'ROOM_UNAVAILABLE' ? [i] : []));
  if (unavailable.length)
    return {
      ok: false,
      status: 409,
      code: 'ROOM_UNAVAILABLE',
      message: 'Some rooms are no longer available.',
      stays: unavailable,
      fieldErrors: Object.assign({}, ...unavailable.map((i) => forStay(quoted[i] as Failure, i).fieldErrors)),
    };
  const bad = quoted.findIndex((q) => !q.ok);
  if (bad >= 0) return forStay(quoted[bad] as Failure, bad);

  const ok = quoted as Extract<StayQuoteResult, { ok: true }>[];
  const rec: QuoteRec = {
    quote: {
      quoteId: rid('q'),
      expiresAt: new Date(Date.now() + QUOTE_MS).toISOString(),
      stays: ok.map((q) => q.stay),
      taxesIncluded: true,
      total: usd(ok.reduce((a, q) => a + q.stay.total.amount, 0)),
    },
    stays: ok.map((q) => q.req),
  };
  db().quotes[rec.quote.quoteId] = rec;
  save();
  return { ok: true, rec };
}
