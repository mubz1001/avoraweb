import { http, HttpResponse } from 'msw';
import {
  availabilityFor,
  getProperty,
  getReviews,
  getReviewSummary,
  home,
  listCities,
  search,
  suggest,
} from '../catalog';
import { fail } from '../http';
import { config } from '@/lib/config';
import { isIsoDate, iso, parseDate, today } from '@/lib/dates';
import type { PropertyType, Review, Trip } from '@/types';

const base = config.apiBase;
const typeOf = (v: string | null): PropertyType => (v === 'hall' ? 'hall' : 'hotel');
const csv = (v: string | null) => (v ?? '').split(',').filter(Boolean);
const num = (v: string | null, d: number) =>
  v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d;

/** Strict trip parsing for the API: the client sends sanitised values, so bad input is a 422, not a silent reset. */
function tripFrom(p: URLSearchParams): { trip: Trip } | { error: Record<string, string> } {
  const type = typeOf(p.get('type'));
  const checkIn = p.get('checkIn');
  const checkOut = p.get('checkOut');
  const errors: Record<string, string> = {};
  if (!isIsoDate(checkIn)) errors.checkIn = 'REQUIRED';
  else if (parseDate(checkIn) < today()) errors.checkIn = 'DATE_IN_PAST';
  if (type === 'hotel') {
    if (!isIsoDate(checkOut)) errors.checkOut = 'REQUIRED';
    else if (isIsoDate(checkIn) && parseDate(checkOut) <= parseDate(checkIn))
      errors.checkOut = 'CHECKOUT_BEFORE_CHECKIN';
  }
  const guests = num(p.get('guests'), 2);
  const rooms = type === 'hall' ? 1 : num(p.get('rooms'), 1);
  if (type === 'hotel' && (rooms < 1 || rooms > Math.min(config.limits.roomsMax, guests)))
    errors.rooms = 'TOO_MANY_ROOMS';
  if (Object.keys(errors).length) return { error: errors };
  const inn = checkIn as string;
  return {
    trip: {
      type,
      city: p.get('city') ?? '',
      checkIn: inn,
      checkOut: type === 'hall' ? iso(new Date(+parseDate(inn) + 864e5)) : (checkOut as string),
      guests,
      rooms,
    },
  };
}

export const tripFromParams = tripFrom;

const SORTS = ['rec', 'price-asc', 'price-desc', 'rating'] as const;

export const discoveryHandlers = [
  http.get(`${base}/cities`, ({ request }) =>
    HttpResponse.json({ items: listCities(typeOf(new URL(request.url).searchParams.get('type'))) }),
  ),

  http.get(`${base}/suggest`, ({ request }) => {
    const p = new URL(request.url).searchParams;
    return HttpResponse.json(suggest(p.get('q') ?? '', typeOf(p.get('type'))));
  }),

  http.get(`${base}/home`, ({ request }) =>
    HttpResponse.json(home(typeOf(new URL(request.url).searchParams.get('type')))),
  ),

  http.get(`${base}/search`, ({ request }) => {
    const p = new URL(request.url).searchParams;
    const t = tripFrom(p);
    if ('error' in t) return fail(422, 'VALIDATION_FAILED', 'Some fields need attention.', { fieldErrors: t.error });
    const sort = SORTS.find((s) => s === p.get('sort')) ?? 'rec';
    return HttpResponse.json(
      search({
        trip: t.trip,
        sort,
        maxPrice: num(p.get('maxPrice'), 0),
        minRating: num(p.get('minRating'), 0),
        amenities: csv(p.get('amenities')),
        propertyTypes: csv(p.get('propertyTypes')),
      }),
    );
  }),

  http.get(`${base}/properties/:id`, ({ params }) => {
    const prop = getProperty(String(params.id));
    return prop ? HttpResponse.json(prop) : fail(404, 'PROPERTY_NOT_FOUND', 'We couldn’t find that property.');
  }),

  http.get(`${base}/properties/:id/availability`, ({ params, request }) => {
    const id = String(params.id);
    if (!getProperty(id)) return fail(404, 'PROPERTY_NOT_FOUND', 'We couldn’t find that property.');
    const t = tripFrom(new URL(request.url).searchParams);
    if ('error' in t) return fail(422, 'VALIDATION_FAILED', 'Some fields need attention.', { fieldErrors: t.error });
    return HttpResponse.json(availabilityFor(id, t.trip));
  }),

  http.get(`${base}/properties/:id/reviews`, ({ params, request }) => {
    const id = String(params.id);
    const prop = getProperty(id);
    if (!prop) return fail(404, 'PROPERTY_NOT_FOUND', 'We couldn’t find that property.');
    const summary = getReviewSummary(id);
    if (!summary) return HttpResponse.json({ total: 0, items: [], nextCursor: null });
    const p = new URL(request.url).searchParams;
    const score = p.get('score');
    const topic = p.get('topic');
    const newer = (a: Review, b: Review) => (a.postedAt < b.postedAt ? 1 : -1);
    const sorters: Record<string, (a: Review, b: Review) => number> = {
      newest: newer,
      oldest: (a, b) => (a.postedAt > b.postedAt ? 1 : -1),
      highest: (a, b) => b.score - a.score || newer(a, b),
      lowest: (a, b) => a.score - b.score || newer(a, b),
      relevant: (a, b) => b.text.length - a.text.length || newer(a, b),
    };
    const sorter = sorters[p.get('sort') ?? 'relevant'] ?? sorters.relevant!;
    const all = getReviews(id)
      .filter(
        (r) =>
          (!topic || r.topics.includes(topic)) &&
          (!score || (score === 'low' ? r.score <= 2 : r.score === Number(score))),
      )
      .sort(sorter);
    const limit = Math.min(Math.max(num(p.get('limit'), 10), 1), 50);
    const cursor = p.get('cursor');
    const start = cursor && /^c_\d+$/.test(cursor) ? Number(cursor.slice(2)) : 0;
    const items = all.slice(start, start + limit);
    return HttpResponse.json({
      summary,
      total: all.length,
      items,
      nextCursor: start + limit < all.length ? `c_${start + limit}` : null,
    });
  }),
];
