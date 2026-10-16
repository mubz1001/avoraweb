import { config } from '@/lib/config';
import { addDays, isIsoDate, iso, parseDate, today } from '@/lib/dates';
import type { Trip } from '@/types';

/** URL parameter names are part of the shareable-link contract (docs/02 §1): `in` / `out`, not checkIn / checkOut. */
const { hotelGuestsMax, roomsMax, hallGuestsMin } = config.limits;

const int = (v: string | null | undefined): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

/**
 * Builds a valid Trip from URL params, falling back to the last saved trip, then defaults.
 * Rules: a past or invalid check-in becomes today+3; check-out <= check-in becomes check-in+2;
 * hotels sleep 1–8 guests (more resets to 2), halls start at 50 (less resets to 200) and last one day;
 * rooms are 1 to min(5, guests).
 */
export function parseTrip(params: URLSearchParams, saved: Partial<Trip> = {}): Trip {
  const type = config.features.halls
    ? params.get('type') === 'hall' || (!params.has('type') && saved.type === 'hall')
      ? 'hall'
      : 'hotel'
    : 'hotel';
  const rawIn = params.get('in') ?? saved.checkIn;
  const rawOut = params.get('out') ?? saved.checkOut;
  let checkIn = isIsoDate(rawIn) ? rawIn : '';
  let checkOut = isIsoDate(rawOut) ? rawOut : '';
  if (!checkIn || parseDate(checkIn) < today()) {
    checkIn = addDays(today(), 3);
    checkOut = addDays(today(), 5);
  }
  if (!checkOut || parseDate(checkOut) <= parseDate(checkIn)) checkOut = addDays(checkIn, 2);

  let guests = int(params.get('guests')) ?? saved.guests ?? 2;
  if (type === 'hall' && guests < hallGuestsMin) guests = 200;
  if (type === 'hotel' && (guests > hotelGuestsMax || guests < 1)) guests = 2;

  const wantRooms = int(params.get('rooms')) ?? saved.rooms ?? 1;
  const rooms = type === 'hall' ? 1 : Math.min(Math.max(wantRooms, 1), Math.min(roomsMax, guests));

  const city = params.has('city') ? (params.get('city') ?? '') : (saved.city ?? 'Mogadishu');
  return { type, city, checkIn, checkOut: type === 'hall' ? addDays(checkIn, 1) : checkOut, guests, rooms };
}

/** The inverse of parseTrip: query string for links. Extra params (id, sel, sort…) are appended. */
export function serializeTrip(trip: Trip, extra: Record<string, string> = {}): string {
  return new URLSearchParams({
    type: trip.type,
    city: trip.city,
    in: trip.checkIn,
    out: trip.checkOut,
    guests: String(trip.guests),
    rooms: String(trip.rooms),
    ...extra,
  }).toString();
}

/** Switches a trip to another property type (hotel page opened from a hall link, or the home toggle). */
export function withType(trip: Trip, type: Trip['type']): Trip {
  if (trip.type === type) return trip;
  if (type === 'hall')
    return {
      ...trip,
      type,
      rooms: 1,
      checkOut: addDays(trip.checkIn, 1),
      guests: trip.guests < hallGuestsMin ? 200 : trip.guests,
    };
  return { ...trip, type, checkOut: addDays(trip.checkIn, 2), guests: trip.guests > hotelGuestsMax ? 2 : trip.guests };
}

export const todayIso = () => iso(today());

/** `sel` param: "double:2,suite:1". Quantities must be positive integers. */
export function parseSel(s: string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (s ?? '').split(',')) {
    const [id, q] = part.split(':');
    const n = Number(q);
    if (id && /^[\w-]+$/.test(id) && Number.isInteger(n) && n > 0) out[id] = n;
  }
  return out;
}

export const selString = (sel: Record<string, number>) =>
  Object.keys(sel)
    .filter((k) => (sel[k] ?? 0) > 0)
    .map((k) => `${k}:${sel[k]}`)
    .join(',');
