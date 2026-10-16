/** Domain types. They mirror docs/06 §2; money is integer cents. */

export type PropertyType = 'hotel' | 'hall';
export type Money = { amount: number; currency: 'USD' };

export interface PropertyImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  /** Optional responsive candidates ("…-480.webp 480w, …-800.webp 800w"); `url` is the largest, used by the lightbox. */
  srcset?: string;
}

export interface PropertySummary {
  id: string;
  type: PropertyType;
  name: string;
  city: string;
  area: string;
  propertyType: 'Hotel' | 'Guesthouse' | 'Apartments' | 'Wedding hall';
  stars?: number;
  /** Omitted entirely when count < 3. */
  rating?: { score: number; count: number };
  amenities: string[];
  /** Cheapest room type per night (halls: per day), for "From $X" on cards without a trip. */
  fromPrice: Money;
  images: PropertyImage[];
  /** Drives the placeholder tile colour until real photos exist. */
  hue: number;
  featured: boolean;
  listedAt: string;
}

export interface RoomType {
  id: string;
  name: string;
  beds: string;
  maxGuests: number;
  sizeM2?: number;
  features: string[];
  /** Taxes included; halls: per day. */
  nightlyPrice: Money;
  /** The room's photo; without one a coloured tile stands in. */
  image?: PropertyImage;
}

export interface Property extends PropertySummary {
  address: string;
  mapUrl?: string;
  description: string;
  checkInFrom: string;
  checkOutUntil: string;
  cancellation: { freeUntilDaysBefore: number };
  whatsapp: string;
  roomTypes: RoomType[];
  reviewSummary?: ReviewSummary;
  latestReviews?: Review[];
}

export interface RoomAvailability {
  roomTypeId: string;
  available: number;
  nightlyPrice: Money;
}

export interface Availability {
  available: boolean;
  roomTypes: RoomAvailability[];
  recommendation?: { roomTypeId: string; qty: number };
  freeCancellationUntil?: string;
}

export interface Trip {
  type: PropertyType;
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}

/** One hotel's stay in the basket (docs/02 §4.14): a property, its dates and party, and the room quantities picked.
 *  Prices are never stored; they come from live availability and, at checkout, the server quote. */
export interface BasketStay {
  propertyId: string;
  type: PropertyType;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  lines: BasketLine[];
  /** ISO timestamp of the last change to this stay; the newer copy wins when a device basket meets the account's. */
  updatedAt: string;
}

/** The basket: stays at any number of properties, each with its own dates and party (one per property + dates). They
 *  are paid together at one checkout and each becomes its own booking. */
export interface Basket {
  stays: BasketStay[];
  updatedAt: string;
}

export interface BasketLine {
  roomTypeId: string;
  qty: number;
}

export interface QuoteLine {
  roomTypeId: string;
  name: string;
  qty: number;
  unitPrice: Money;
  total: Money;
}

/** One stay's share of a quote: its own lines, fee, total and cancellation terms (it becomes one booking). */
export interface StayQuote {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  lines: QuoteLine[];
  subtotal: Money;
  serviceFee: Money;
  total: Money;
  freeCancellationUntil?: string;
}

/** The server's price for everything being paid for at one checkout (docs/06 §4.1). */
export interface Quote {
  quoteId: string;
  expiresAt: string;
  stays: StayQuote[];
  taxesIncluded: true;
  total: Money;
}

export type PaymentMethodKind = 'waafipay' | 'edahab' | 'card';

export type BookingProperty = Pick<
  Property,
  | 'id'
  | 'name'
  | 'address'
  | 'checkInFrom'
  | 'checkOutUntil'
  | 'whatsapp'
  | 'type'
  | 'area'
  | 'city'
  | 'hue'
  | 'propertyType'
> & {
  /** The stay's first photo, for booking lists. */
  image?: PropertyImage;
};

export type BookingPayment = {
  method: PaymentMethodKind;
  brand?: string;
  last4?: string;
  payPhoneMasked?: string;
  paidAt?: string;
};

/** One property's reservation. `failed`: paid for, but the property couldn't confirm it; its total was refunded. */
export interface Booking {
  ref: string;
  /** The checkout it was paid in; several bookings can share one. */
  orderId: string;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'payment_failed' | 'failed';
  property: BookingProperty;
  trip: Trip;
  quote: StayQuote;
  guest: { name: string; phone: string; email?: string };
  payment: BookingPayment;
  /** Set when this booking's total went back to the payment method. */
  refundedAt?: string;
  /** The member's review of this stay, once sent (docs/06 §5b): what the card needs to say "Review sent". */
  review?: { score: number; postedAt: string };
  accountId?: string;
  createdAt: string;
}

/**
 * One checkout: one payment covering a booking per stay (docs/06 §4.2). `partially_confirmed`: paid, but some properties
 * couldn't confirm; their share is refunded (`refunded`). `failed`: paid, none confirmed, all refunded.
 */
export interface Order {
  id: string;
  status: 'pending_payment' | 'confirmed' | 'partially_confirmed' | 'failed' | 'payment_failed';
  total: Money;
  refunded?: Money;
  payment: BookingPayment;
  bookings: Booking[];
  accountId?: string;
  createdAt: string;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  hasPassword: boolean;
  providers: ('google' | 'apple')[];
  defaultPaymentMethodId?: string;
  createdAt: string;
}

export interface SavedPaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  brand: string;
  phone?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  createdAt: string;
}

export interface ReviewSummary {
  count: number;
  score: number;
  label: 'Exceptional' | 'Excellent' | 'Very good' | 'Good' | 'Okay' | 'Poor';
  topics: { key: string; label: string; count: number }[];
}

export interface Review {
  id: string;
  firstName: string;
  roomTypeName: string;
  nights: number;
  stayMonth: string;
  postedAt: string;
  score: number;
  title: string;
  text: string;
  topics: string[];
  response?: { text: string; postedAt: string };
}
