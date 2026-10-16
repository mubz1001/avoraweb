import { galleryImages, roomImage } from './placeholderImages';
import raw from './data/properties.json';
import { buildReviews, summarize } from './reviews';
import { CITIES } from '@/lib/reference';
import { addDays, today } from '@/lib/dates';
import {
  canFreeCancel,
  cancelDate,
  fitRate,
  fits,
  isAvailable,
  minRate,
  nightsFor,
  recommend,
  roomsLeft,
  type RoomOffer,
} from '@/lib/pricing';
import type { Availability, Property, PropertySummary, PropertyType, Review, ReviewSummary, Trip } from '@/types';

interface RawProperty {
  id: string;
  type: PropertyType;
  name: string;
  city: string;
  area: string;
  address: string;
  propertyType: Property['propertyType'];
  stars?: number;
  amenities: string[];
  hue: number;
  featured: boolean;
  listedDaysAgo: number;
  mapUrl?: string;
  description: string;
  checkInFrom: string;
  checkOutUntil: string;
  cancellation: { freeUntilDaysBefore: number };
  whatsapp: string;
  roomTypes: Property['roomTypes'];
  mock: { stock: Record<string, number>; blocked: boolean; reviewCount: number; targetRating: number | null };
}

const RAW = raw as unknown as RawProperty[];

interface Entry {
  property: Property;
  reviews: Review[];
  summary: ReviewSummary | undefined;
  raw: RawProperty;
}

let entries: Entry[] | null = null;

/** Built lazily so review dates are relative to the day the server starts. */
function catalog(): Entry[] {
  if (entries) return entries;
  entries = RAW.map((r) => {
    const reviews = buildReviews({
      id: r.id,
      type: r.type,
      count: r.mock.reviewCount,
      target: r.mock.targetRating,
      roomNames: r.roomTypes.map((x) => x.name),
    });
    const full = reviews.length >= 3 ? summarize(reviews, r.type) : undefined;
    const { mock: _mock, listedDaysAgo, ...rest } = r;
    void _mock;
    const property: Property = {
      ...rest,
      ...(r.type === 'hotel'
        ? {
            images: galleryImages(r.id),
            roomTypes: r.roomTypes.map((rt, i) => ({ ...rt, image: roomImage(r.id, i) })),
          }
        : { images: [] }),
      fromPrice: { amount: Math.min(...r.roomTypes.map((x) => x.nightlyPrice.amount)), currency: 'USD' },
      listedAt: addDays(today(), -listedDaysAgo),
      ...(full
        ? { rating: { score: full.score, count: full.count }, reviewSummary: full, latestReviews: reviews.slice(0, 4) }
        : {}),
    };
    return { property, reviews, summary: full, raw: r };
  });
  return entries;
}

const find = (id: string) => catalog().find((e) => e.property.id === id);

export const getProperty = (id: string) => find(id)?.property;
export const getReviews = (id: string) => find(id)?.reviews ?? [];
export const getReviewSummary = (id: string) => find(id)?.summary;

export function summaryOf(p: Property): PropertySummary {
  const {
    address: _a,
    mapUrl: _m,
    description: _d,
    checkInFrom: _ci,
    checkOutUntil: _co,
    cancellation: _c,
    whatsapp: _w,
    roomTypes: _rt,
    reviewSummary: _rs,
    latestReviews: _lr,
    ...summary
  } = p;
  void [_a, _m, _d, _ci, _co, _c, _w, _rt, _rs, _lr];
  return summary;
}

export function offersFor(id: string): RoomOffer[] {
  const e = find(id);
  if (!e) return [];
  return e.property.roomTypes.map((r) => ({
    id: r.id,
    name: r.name,
    maxGuests: r.maxGuests,
    nightly: r.nightlyPrice.amount,
    available: e.raw.mock.blocked ? 0 : (e.raw.mock.stock[r.id] ?? 0),
  }));
}

export function availabilityFor(id: string, trip: Trip): Availability | undefined {
  const e = find(id);
  if (!e) return undefined;
  const offers = offersFor(id);
  const rec = recommend(offers, trip);
  const days = e.property.cancellation.freeUntilDaysBefore;
  return {
    available: isAvailable(offers),
    roomTypes: offers.map((o) => ({
      roomTypeId: o.id,
      available: o.available,
      nightlyPrice: { amount: o.nightly, currency: 'USD' },
    })),
    ...(rec ? { recommendation: { roomTypeId: rec.id, qty: rec.qty } } : {}),
    ...(canFreeCancel(trip.checkIn, days) ? { freeCancellationUntil: cancelDate(trip.checkIn, days) } : {}),
  };
}

export const cityCount = (type: PropertyType, city: string) =>
  catalog().filter((e) => e.property.type === type && e.property.city === city).length;

export const listCities = (type: PropertyType) => CITIES.map((name) => ({ name, count: cityCount(type, name) }));

/** "Mog" → "Mogadishu"; '' = all cities; unknown → null. */
export function resolveCity(input: string): string | null {
  const q = input.trim().toLowerCase();
  if (!q) return '';
  return (
    CITIES.find((c) => c.toLowerCase() === q) ??
    CITIES.find((c) => c.toLowerCase().startsWith(q)) ??
    CITIES.find((c) => c.toLowerCase().includes(q)) ??
    null
  );
}

export function suggest(q: string, type: PropertyType) {
  const s = q.trim().toLowerCase();
  const cities = CITIES.filter((c) => !s || c.toLowerCase().includes(s)).map((name) => ({
    name,
    count: cityCount(type, name),
  }));
  const properties = s
    ? catalog()
        .filter((e) => e.property.type === type && e.property.name.toLowerCase().includes(s))
        .slice(0, 4)
        .map((e) => ({ id: e.property.id, name: e.property.name, city: e.property.city }))
    : [];
  return { cities, properties };
}

export function home(type: PropertyType) {
  const pool = catalog()
    .filter((e) => e.property.type === type)
    .map((e) => e.property);
  const featured = pool.filter((p) => p.featured).slice(0, 3);
  const newest = pool
    .filter((p) => !featured.includes(p))
    .sort((a, b) => (a.listedAt < b.listedAt ? 1 : -1))
    .slice(0, 3);
  return { featured: featured.map(summaryOf), newest: newest.map(summaryOf) };
}

export interface SearchQuery {
  trip: Trip;
  sort: 'rec' | 'price-asc' | 'price-desc' | 'rating';
  maxPrice: number;
  minRating: number;
  amenities: string[];
  propertyTypes: string[];
}

export function search(q: SearchQuery) {
  const { trip } = q;
  const resolved = resolveCity(trip.city);
  const rate = (p: Property) => p.rating?.score ?? 0;
  let pool = catalog().filter((e) => {
    const p = e.property;
    if (p.type !== trip.type) return false;
    if (resolved === null) return p.name.toLowerCase().includes(trip.city.trim().toLowerCase());
    return resolved === '' || p.city === resolved;
  });
  pool = pool.filter((e) => {
    const p = e.property;
    const min = Math.min(...p.roomTypes.map((r) => r.nightlyPrice.amount));
    return (
      (!q.maxPrice || min <= q.maxPrice) &&
      (!q.minRating || rate(p) >= q.minRating) &&
      q.amenities.every((a) => p.amenities.includes(a)) &&
      (!q.propertyTypes.length || q.propertyTypes.includes(p.propertyType))
    );
  });
  const cmp: Record<SearchQuery['sort'], (a: Property, b: Property) => number> = {
    rec: (a, b) => (b.rating?.score ?? 4.2) - (a.rating?.score ?? 4.2),
    'price-asc': (a, b) => minRate(offersFor(a.id)) - minRate(offersFor(b.id)),
    'price-desc': (a, b) => minRate(offersFor(b.id)) - minRate(offersFor(a.id)),
    rating: (a, b) => rate(b) - rate(a),
  };
  pool.sort((a, b) => cmp[q.sort](a.property, b.property));

  const items = pool.map((e) => {
    const p = e.property;
    const offers = offersFor(p.id);
    const left = roomsLeft(offers);
    const state = fits(offers, trip) ? 'available' : isAvailable(offers) ? 'partial' : 'unavailable';
    const nights = nightsFor(trip);
    const from = state === 'unavailable' ? undefined : fitRate(offers, trip);
    const days = p.cancellation.freeUntilDaysBefore;
    return {
      property: summaryOf(p),
      availability: state,
      roomsLeft: left,
      nights,
      ...(from !== undefined && state === 'available'
        ? {
            fromRate: { amount: from, currency: 'USD' },
            stayTotal: { amount: from * nights * trip.rooms, currency: 'USD' },
          }
        : {}),
      ...(canFreeCancel(trip.checkIn, days) ? { freeCancellationUntil: cancelDate(trip.checkIn, days) } : {}),
    };
  });
  const ordered = [
    ...items.filter((i) => i.availability === 'available'),
    ...items.filter((i) => i.availability !== 'available'),
  ];
  return {
    resolvedCity: resolved,
    total: ordered.length,
    availableCount: ordered.filter((i) => i.availability === 'available').length,
    items: ordered,
    nextCursor: null,
  };
}
