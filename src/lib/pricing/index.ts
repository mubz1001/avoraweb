import { addDays, nightsBetween, parseDate, today } from '@/lib/dates';
import type { Trip } from '@/types';

/**
 * Pricing and availability rules (docs/04 B.3). Pure functions over integer cents, used by the UI and by the
 * mock server alike, so cards, hotel page, sticky bar, checkout and confirmation can never disagree. The server
 * quote is authoritative in production; this module is the display fallback and the mock's source of truth.
 */
export interface RoomOffer {
  id: string;
  name: string;
  maxGuests: number;
  /** Rooms of this type still bookable for the trip. 0 = sold out. */
  available: number;
  /** Cents per night (halls: per day). */
  nightly: number;
}

export const SERVICE_FEE_RATE = 0.02;

export const nightsFor = (trip: Pick<Trip, 'type' | 'checkIn' | 'checkOut'>) =>
  trip.type === 'hall' ? 1 : nightsBetween(trip.checkIn, trip.checkOut);

/** 2% of the subtotal, rounded to whole dollars. The UI hides the row when it is 0. */
export const serviceFee = (subtotal: number) => Math.round((subtotal * SERVICE_FEE_RATE) / 100) * 100;

export interface PricedLine {
  offer: RoomOffer;
  qty: number;
  total: number;
}

export function price(
  offers: RoomOffer[],
  sel: Record<string, number>,
  trip: Pick<Trip, 'type' | 'checkIn' | 'checkOut'>,
) {
  const nights = nightsFor(trip);
  const lines: PricedLine[] = offers
    .filter((o) => (sel[o.id] ?? 0) > 0)
    .map((offer) => ({ offer, qty: sel[offer.id] ?? 0, total: offer.nightly * (sel[offer.id] ?? 0) * nights }));
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const fee = serviceFee(subtotal);
  return { nights, lines, subtotal, fee, total: subtotal + fee, rooms: lines.reduce((a, l) => a + l.qty, 0) };
}

export const bookable = (offers: RoomOffer[]) => offers.filter((o) => o.available > 0);
export const roomsLeft = (offers: RoomOffer[]) => bookable(offers).reduce((a, o) => a + o.available, 0);
export const isAvailable = (offers: RoomOffer[]) => roomsLeft(offers) > 0;
export const fits = (offers: RoomOffer[], trip: Pick<Trip, 'rooms'>) =>
  isAvailable(offers) && roomsLeft(offers) >= trip.rooms;
export const minRate = (offers: RoomOffer[]) => Math.min(...offers.map((o) => o.nightly));

const perRoom = (trip: Pick<Trip, 'type' | 'guests' | 'rooms'>) =>
  Math.ceil(trip.guests / (trip.type === 'hall' ? 1 : trip.rooms));
const wanted = (trip: Pick<Trip, 'type' | 'rooms'>) => (trip.type === 'hall' ? 1 : trip.rooms);

/** Cheapest room type that fits the guests per room and has enough rooms; otherwise the cheapest bookable one. */
export function fitRate(offers: RoomOffer[], trip: Pick<Trip, 'type' | 'guests' | 'rooms'>): number {
  const open = bookable(offers);
  const ok = open.filter((o) => o.maxGuests >= perRoom(trip) && o.available >= wanted(trip));
  return Math.min(...(ok.length ? ok : open).map((o) => o.nightly));
}

/** Recommended room type and quantity, or null when nothing is bookable. */
export function recommend(
  offers: RoomOffer[],
  trip: Pick<Trip, 'type' | 'guests' | 'rooms'>,
): { id: string; qty: number } | null {
  const open = bookable(offers);
  if (!open.length) return null;
  const n = wanted(trip);
  const fit = open
    .filter((o) => o.maxGuests >= perRoom(trip) && o.available >= n)
    .sort((a, b) => a.nightly - b.nightly)[0];
  if (fit) return { id: fit.id, qty: n };
  const big = [...open].sort((a, b) => b.maxGuests - a.maxGuests)[0];
  if (!big) return null;
  return { id: big.id, qty: Math.min(big.available, Math.max(n, Math.ceil(trip.guests / big.maxGuests))) };
}

/** How a room selection measures up against the search (guests and rooms asked for). */
export interface StayFit {
  /** Beds in the selected rooms vs guests searched for. */
  guests: { have: number; want: number };
  /** Rooms selected vs rooms searched for. */
  rooms: { have: number; want: number };
  /** Guests the selection has no bed for (0 when everyone fits). */
  short: number;
}

export function stayFit(
  offers: RoomOffer[],
  sel: Record<string, number>,
  trip: Pick<Trip, 'guests' | 'rooms'>,
): StayFit {
  const beds = offers.reduce((a, o) => a + (sel[o.id] ?? 0) * o.maxGuests, 0);
  const rooms = offers.reduce((a, o) => a + (sel[o.id] ?? 0), 0);
  return {
    guests: { have: beds, want: trip.guests },
    rooms: { have: rooms, want: trip.rooms },
    short: Math.max(0, trip.guests - beds),
  };
}

/** The room type to add for `short` more guests: the cheapest one still bookable (after the selection) that sleeps
 *  them all, else the roomiest one left. Null when nothing is left to add. */
export function topUp(offers: RoomOffer[], sel: Record<string, number>, short: number): string | null {
  const left = offers.filter((o) => o.available - (sel[o.id] ?? 0) > 0);
  const fit = left.filter((o) => o.maxGuests >= short).sort((a, b) => a.nightly - b.nightly)[0];
  return (fit ?? [...left].sort((a, b) => b.maxGuests - a.maxGuests || a.nightly - b.nightly)[0])?.id ?? null;
}

/** Last day a booking can be cancelled free of charge. */
export const cancelDate = (checkIn: string, cancelDays: number) => addDays(checkIn, -cancelDays);
export const canFreeCancel = (checkIn: string, cancelDays: number) =>
  parseDate(cancelDate(checkIn, cancelDays)) >= today();
