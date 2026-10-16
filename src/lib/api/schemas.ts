import { z } from 'zod';
import { config } from '@/lib/config';
import type {
  Availability,
  Basket,
  Booking,
  Member,
  Order,
  Property,
  PropertySummary,
  Quote,
  Review,
  ReviewSummary,
  SavedPaymentMethod,
} from '@/types';

/** Runtime validation of every response (docs/04 B.6). Each schema is checked against the domain type at compile time. */
const money = z.object({ amount: z.number().int(), currency: z.literal('USD') });
const propertyType = z.enum(['hotel', 'hall']);

export const reviewSummarySchema: z.ZodType<ReviewSummary> = z.object({
  count: z.number(),
  score: z.number(),
  label: z.enum(['Exceptional', 'Excellent', 'Very good', 'Good', 'Okay', 'Poor']),
  topics: z.array(z.object({ key: z.string(), label: z.string(), count: z.number() })),
});

export const reviewSchema: z.ZodType<Review> = z.object({
  id: z.string(),
  firstName: z.string(),
  roomTypeName: z.string(),
  nights: z.number(),
  stayMonth: z.string(),
  postedAt: z.string(),
  score: z.number(),
  title: z.string(),
  text: z.string(),
  topics: z.array(z.string()),
  response: z.object({ text: z.string(), postedAt: z.string() }).optional(),
});

const image = z.object({
  url: z.string(),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
  srcset: z.string().optional(),
});

const summaryShape = {
  id: z.string(),
  type: propertyType,
  name: z.string(),
  city: z.string(),
  area: z.string(),
  propertyType: z.enum(['Hotel', 'Guesthouse', 'Apartments', 'Wedding hall']),
  stars: z.number().optional(),
  rating: z.object({ score: z.number(), count: z.number() }).optional(),
  amenities: z.array(z.string()),
  fromPrice: money,
  images: z.array(image),
  hue: z.number(),
  featured: z.boolean(),
  listedAt: z.string(),
};

export const propertySummarySchema: z.ZodType<PropertySummary> = z.object(summaryShape);

export const propertySchema: z.ZodType<Property> = z.object({
  ...summaryShape,
  address: z.string(),
  mapUrl: z.string().optional(),
  description: z.string(),
  checkInFrom: z.string(),
  checkOutUntil: z.string(),
  cancellation: z.object({ freeUntilDaysBefore: z.number() }),
  whatsapp: z.string(),
  roomTypes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      beds: z.string(),
      maxGuests: z.number(),
      sizeM2: z.number().optional(),
      features: z.array(z.string()),
      nightlyPrice: money,
      image: image.optional(),
    }),
  ),
  reviewSummary: reviewSummarySchema.optional(),
  latestReviews: z.array(reviewSchema).optional(),
});

export const availabilitySchema: z.ZodType<Availability> = z.object({
  available: z.boolean(),
  roomTypes: z.array(z.object({ roomTypeId: z.string(), available: z.number(), nightlyPrice: money })),
  recommendation: z.object({ roomTypeId: z.string(), qty: z.number() }).optional(),
  freeCancellationUntil: z.string().optional(),
});

const stayQuoteSchema = z.object({
  propertyId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number(),
  nights: z.number(),
  lines: z.array(
    z.object({ roomTypeId: z.string(), name: z.string(), qty: z.number(), unitPrice: money, total: money }),
  ),
  subtotal: money,
  serviceFee: money,
  total: money,
  freeCancellationUntil: z.string().optional(),
});

export const quoteSchema: z.ZodType<Quote> = z.object({
  quoteId: z.string(),
  expiresAt: z.string(),
  stays: z.array(stayQuoteSchema).min(1),
  taxesIncluded: z.literal(true),
  total: money,
});

const trip = z.object({
  type: propertyType,
  city: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number(),
  rooms: z.number(),
});

const bookingPayment = z.object({
  method: z.enum(['waafipay', 'edahab', 'card']),
  brand: z.string().optional(),
  last4: z.string().optional(),
  payPhoneMasked: z.string().optional(),
  paidAt: z.string().optional(),
});

const bookingShape = {
  ref: z.string(),
  orderId: z.string(),
  status: z.enum(['pending_payment', 'confirmed', 'cancelled', 'payment_failed', 'failed']),
  property: z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    checkInFrom: z.string(),
    checkOutUntil: z.string(),
    whatsapp: z.string(),
    type: propertyType,
    area: z.string(),
    city: z.string(),
    hue: z.number(),
    propertyType: z.enum(['Hotel', 'Guesthouse', 'Apartments', 'Wedding hall']),
    image: image.optional(),
  }),
  trip,
  quote: stayQuoteSchema,
  guest: z.object({ name: z.string(), phone: z.string(), email: z.string().optional() }),
  payment: bookingPayment,
  refundedAt: z.string().optional(),
  review: z.object({ score: z.number(), postedAt: z.string() }).optional(),
  accountId: z.string().optional(),
  createdAt: z.string(),
};

export const bookingSchema: z.ZodType<Booking> = z.object(bookingShape);

const orderShape = {
  id: z.string(),
  status: z.enum(['pending_payment', 'confirmed', 'partially_confirmed', 'failed', 'payment_failed']),
  total: money,
  refunded: money.optional(),
  payment: bookingPayment,
  bookings: z.array(bookingSchema).min(1),
  accountId: z.string().optional(),
  createdAt: z.string(),
};

export const orderSchema: z.ZodType<Order> = z.object(orderShape);

/** POST /orders: the order plus the guest payment token and, while a mobile-money prompt is pending, its expiry. */
export const createdOrderSchema = z.object({
  ...orderShape,
  paymentToken: z.string().optional(),
  paymentPrompt: z.object({ expiresAt: z.string() }).optional(),
});
export type CreatedOrder = z.infer<typeof createdOrderSchema>;

export const memberSchema: z.ZodType<Member> = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  phoneVerified: z.boolean(),
  hasPassword: z.boolean(),
  providers: z.array(z.enum(['google', 'apple'])),
  defaultPaymentMethodId: z.string().optional(),
  createdAt: z.string(),
});

export const savedMethodSchema: z.ZodType<SavedPaymentMethod> = z.object({
  id: z.string(),
  kind: z.enum(['waafipay', 'edahab', 'card']),
  brand: z.string(),
  phone: z.string().optional(),
  last4: z.string().optional(),
  expMonth: z.number().optional(),
  expYear: z.number().optional(),
  createdAt: z.string(),
});

export const sessionSchema = z.object({ member: memberSchema });

export const citiesSchema = z.object({ items: z.array(z.object({ name: z.string(), count: z.number() })) });

export const suggestSchema = z.object({
  cities: z.array(z.object({ name: z.string(), count: z.number() })),
  properties: z.array(z.object({ id: z.string(), name: z.string(), city: z.string() })),
});

export const homeSchema = z.object({
  featured: z.array(propertySummarySchema),
  newest: z.array(propertySummarySchema),
});

export const searchSchema = z.object({
  resolvedCity: z.string().nullable(),
  total: z.number(),
  availableCount: z.number(),
  items: z.array(
    z.object({
      property: propertySummarySchema,
      availability: z.enum(['available', 'partial', 'unavailable']),
      roomsLeft: z.number(),
      nights: z.number(),
      fromRate: money.optional(),
      stayTotal: money.optional(),
      freeCancellationUntil: z.string().optional(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export type SearchResult = z.infer<typeof searchSchema>;
export type SearchItem = SearchResult['items'][number];

export const reviewsPageSchema = z.object({
  summary: reviewSummarySchema.optional(),
  total: z.number(),
  items: z.array(reviewSchema),
  nextCursor: z.string().nullable(),
});
export type ReviewsPage = z.infer<typeof reviewsPageSchema>;

export const myBookingsSchema = z.object({ upcoming: z.array(bookingSchema), past: z.array(bookingSchema) });
export const favouritesSchema = z.object({ propertyIds: z.array(z.string()) });
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stayKeyPart = z.string().regex(/^[\w-]{1,64}$/);
const basketStaySchema = z.object({
  propertyId: stayKeyPart,
  type: propertyType,
  checkIn: isoDay,
  checkOut: isoDay,
  guests: z.number().int().min(1).max(1000),
  rooms: z.number().int().min(1).max(20),
  lines: z
    .array(z.object({ roomTypeId: stayKeyPart, qty: z.number().int().min(1).max(20) }))
    .min(1)
    .max(20),
  updatedAt: z.string(),
});
/** Also guards the device copy: localStorage is user-editable, so a basket read from it is parsed like a response. */
export const basketSchema: z.ZodType<Basket> = z.object({
  stays: z.array(basketStaySchema).min(1).max(config.limits.basketStaysMax),
  updatedAt: z.string(),
});
export const basketResponseSchema = z.object({ basket: basketSchema.nullable() });
export const methodsSchema = z.object({ items: z.array(savedMethodSchema), defaultId: z.string().optional() });
export const paymentStatusSchema = z.object({
  status: z.enum(['pending_payment', 'confirmed', 'partially_confirmed', 'failed', 'payment_failed']),
  reason: z.string().optional(),
});
export const oauthSchema = z.union([sessionSchema, z.object({ pendingToken: z.string(), email: z.string() })]);
