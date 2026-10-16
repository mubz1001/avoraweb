import { api } from './client';
import {
  availabilitySchema,
  basketResponseSchema,
  bookingSchema,
  citiesSchema,
  createdOrderSchema,
  homeSchema,
  methodsSchema,
  myBookingsSchema,
  oauthSchema,
  orderSchema,
  paymentStatusSchema,
  propertySchema,
  quoteSchema,
  reviewsPageSchema,
  savedMethodSchema,
  searchSchema,
  sessionSchema,
  suggestSchema,
  favouritesSchema,
} from './schemas';
import type { Basket, PaymentMethodKind, PropertyType, Trip } from '@/types';

/** One function per docs/06 endpoint. Components never call fetch; queries and mutations call these. */
const tripQuery = (t: Trip) => ({
  type: t.type,
  city: t.city,
  checkIn: t.checkIn,
  checkOut: t.checkOut,
  guests: t.guests,
  rooms: t.rooms,
});

export interface SearchFilters {
  sort: 'rec' | 'price-asc' | 'price-desc' | 'rating';
  /** Cents; 0 = no cap. */
  maxPrice: number;
  minRating: number;
  amenities: string[];
  propertyTypes: string[];
}

export const catalogApi = {
  cities: (type: PropertyType, signal?: AbortSignal) =>
    api('GET', '/cities', { query: { type }, schema: citiesSchema, signal }),
  suggest: (q: string, type: PropertyType, signal?: AbortSignal) =>
    api('GET', '/suggest', { query: { q, type }, schema: suggestSchema, signal }),
  home: (type: PropertyType, signal?: AbortSignal) =>
    api('GET', '/home', { query: { type }, schema: homeSchema, signal }),
  search: (trip: Trip, f: SearchFilters, signal?: AbortSignal) =>
    api('GET', '/search', {
      query: {
        ...tripQuery(trip),
        sort: f.sort,
        maxPrice: f.maxPrice,
        minRating: f.minRating,
        amenities: f.amenities.join(','),
        propertyTypes: f.propertyTypes.join(','),
      },
      schema: searchSchema,
      signal,
    }),
  property: (id: string, signal?: AbortSignal) =>
    api('GET', `/properties/${encodeURIComponent(id)}`, { schema: propertySchema, signal }),
  availability: (id: string, trip: Trip, signal?: AbortSignal) =>
    api('GET', `/properties/${encodeURIComponent(id)}/availability`, {
      query: tripQuery(trip),
      schema: availabilitySchema,
      signal,
    }),
  reviews: (id: string, q: { sort: string; score: string; topic: string; cursor?: string }, signal?: AbortSignal) =>
    api('GET', `/properties/${encodeURIComponent(id)}/reviews`, {
      query: { ...q, limit: 10 },
      schema: reviewsPageSchema,
      signal,
    }),
};

/** POST /orders (docs/06 §4.2): pays for every stay in the quote at once. */
export interface OrderRequest {
  quoteId: string;
  guest: { name: string; phone: string; email: string };
  saveMethod?: boolean;
  payment: {
    method?: PaymentMethodKind;
    brand?: string;
    payPhone?: string;
    cardToken?: string;
    savedMethodId?: string;
  };
}

/** One stay as the quote request names it. */
export interface QuoteStayRequest {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  selection: { roomTypeId: string; qty: number }[];
}

export const checkoutApi = {
  /** One price for every stay being paid for together (docs/06 §4.1). */
  quote: (stays: QuoteStayRequest[], signal?: AbortSignal) =>
    api('POST', '/quotes', { body: { stays }, schema: quoteSchema, signal }),
  createOrder: (req: OrderRequest, idempotencyKey: string) =>
    api('POST', '/orders', { body: req, schema: createdOrderSchema, idempotencyKey }),
  paymentStatus: (orderId: string, bearer?: string, signal?: AbortSignal) =>
    api('GET', `/orders/${encodeURIComponent(orderId)}/payment-status`, {
      schema: paymentStatusSchema,
      bearer,
      signal,
    }),
  resendPrompt: (orderId: string, bearer?: string) =>
    api('POST', `/orders/${encodeURIComponent(orderId)}/payment-prompt`, { bearer }),
  order: (orderId: string, signal?: AbortSignal, bearer?: string) =>
    api('GET', `/orders/${encodeURIComponent(orderId)}`, { schema: orderSchema, signal, bearer }),
  booking: (ref: string, signal?: AbortSignal) =>
    api('GET', `/bookings/${encodeURIComponent(ref)}`, { schema: bookingSchema, signal }),
};

export interface ProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export const accountApi = {
  me: (signal?: AbortSignal) => api('GET', '/me', { schema: sessionSchema, signal }),
  register: (b: ProfileInput & { password: string }) =>
    api('POST', '/auth/register', { body: b, schema: sessionSchema }),
  login: (email: string, password: string) =>
    api('POST', '/auth/login', { body: { email, password }, schema: sessionSchema }),
  oauth: (provider: 'google' | 'apple', code: string) =>
    api('POST', `/auth/oauth/${provider}`, {
      body: { code, codeVerifier: 'mock', nonce: 'mock' },
      schema: oauthSchema,
    }),
  oauthComplete: (b: { pendingToken: string; firstName: string; lastName: string; phone: string }) =>
    api('POST', '/auth/oauth/complete', { body: b, schema: sessionSchema }),
  requestReset: (email: string) => api('POST', '/auth/password-reset', { body: { email } }),
  confirmReset: (b: { token: string; password: string }) => api('POST', '/auth/password-reset/confirm', { body: b }),
  logout: () => api('POST', '/auth/logout'),
  update: (b: ProfileInput & { currentPassword?: string }) => api('PATCH', '/me', { body: b, schema: sessionSchema }),
  setPassword: (b: { currentPassword?: string; newPassword: string }) => api('PUT', '/me/password', { body: b }),
  remove: (currentPassword?: string) => api('DELETE', '/me', { body: { currentPassword } }),
  bookings: (signal?: AbortSignal) => api('GET', '/me/bookings', { schema: myBookingsSchema, signal }),
  favourites: (signal?: AbortSignal) => api('GET', '/me/favourites', { schema: favouritesSchema, signal }),
  putFavourites: (propertyIds: string[]) =>
    api('PUT', '/me/favourites', { body: { propertyIds }, schema: favouritesSchema }),
  basket: (signal?: AbortSignal) => api('GET', '/me/basket', { schema: basketResponseSchema, signal }),
  /** `merge`: keep whichever of the two baskets changed last (sign-in brings the device basket over). */
  putBasket: (basket: Basket, merge = false) =>
    api('PUT', '/me/basket', { body: { basket, merge }, schema: basketResponseSchema }),
  clearBasket: () => api('DELETE', '/me/basket'),
  methods: (signal?: AbortSignal) => api('GET', '/me/payment-methods', { schema: methodsSchema, signal }),
  addMethod: (b: {
    kind: PaymentMethodKind;
    brand?: string;
    phone?: string;
    providerToken?: string;
    makeDefault?: boolean;
  }) => api('POST', '/me/payment-methods', { body: b, schema: savedMethodSchema }),
  setDefaultMethod: (id: string) => api('PUT', `/me/payment-methods/${encodeURIComponent(id)}/default`),
  removeMethod: (id: string) => api('DELETE', `/me/payment-methods/${encodeURIComponent(id)}`),
  /** POST /bookings/{ref}/review (docs/06 §5b): one review per booking, from the member who made it. */
  submitReview: (ref: string, b: { score: number; text: string }, idempotencyKey: string) =>
    api('POST', `/bookings/${encodeURIComponent(ref)}/review`, { body: b, idempotencyKey }),
};

export const queryKeys = {
  cities: (type: PropertyType) => ['cities', type] as const,
  suggest: (q: string, type: PropertyType) => ['suggest', type, q] as const,
  home: (type: PropertyType) => ['home', type] as const,
  search: (trip: Trip, f: SearchFilters) => ['search', trip, f] as const,
  property: (id: string) => ['property', id] as const,
  availability: (id: string, trip: Trip) =>
    ['availability', id, trip.checkIn, trip.checkOut, trip.guests, trip.rooms] as const,
  reviews: (id: string, q: object) => ['reviews', id, q] as const,
  quote: (key: string) => ['quote', key] as const,
  me: ['me'] as const,
  myBookings: ['me', 'bookings'] as const,
  booking: (ref: string) => ['booking', ref] as const,
  order: (id: string) => ['order', id] as const,
  favourites: ['me', 'favourites'] as const,
  basket: ['me', 'basket'] as const,
  methods: ['me', 'methods'] as const,
  /** Booking refs reviewed in this session (client-only; the booking data carries no review status yet). */
  reviewed: ['me', 'reviewed'] as const,
};
