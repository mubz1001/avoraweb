import { local } from '@/lib/storage';
import type { StayRequest } from './quote';
import type { Basket, Booking, Order, Quote, SavedPaymentMethod } from '@/types';

/** The mock "server": every record the real API would own. Persisted to localStorage (`KEY` below) so a refresh
 *  keeps accounts and bookings while developing. None of this is reachable from app code: only the MSW handlers
 *  touch it, exactly as only the backend would. NOT secure storage. */
export interface PwdRecord {
  s: string;
  h: string;
  i: number;
}

export interface UserRec {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pwd: PwdRecord | null;
  providers: ('google' | 'apple')[];
  methods: (SavedPaymentMethod & { token: string })[];
  defaultMethodId: string;
  favourites: string[];
  /** The stays in progress (GET/PUT/DELETE /me/basket); prices are never stored. */
  basket?: Basket | null;
  createdAt: string;
  demo?: boolean;
}

export interface BookingRec extends Booking {
  demo?: boolean;
}

/** One checkout (POST /orders): one payment, a booking per stay. The bookings live in `bookings`, linked by `orderId`. */
export interface OrderRec extends Omit<Order, 'bookings'> {
  bookingRefs: string[];
  /** A quote pays for one order at most. */
  quoteId: string;
  /** Guests poll the payment with this instead of a session. */
  paymentToken?: string;
  /** Mock payment simulation: when a pending prompt resolves, and how. */
  settleAt?: number;
  settleTo?: 'confirmed' | 'payment_failed';
  failReason?: string;
  /** Mock fixture (docs/06 §9): positions of bookings the property refuses after payment (they are refunded). */
  refuse?: number[];
  demo?: boolean;
}

export interface QuoteRec {
  quote: Quote;
  /** What each stay was priced for, so the order can check it again at payment time. */
  stays: StayRequest[];
  repriced?: boolean;
}

export interface Db {
  users: UserRec[];
  session: { uid: string; exp: number } | null;
  bookings: BookingRec[];
  orders: OrderRec[];
  fails: Record<string, { n: number; until: number }>;
  pending: Record<string, { provider: 'google' | 'apple'; email: string; firstName?: string; exp: number }>;
  quotes: Record<string, QuoteRec>;
  /** Replies by Idempotency-Key, with the quote they were for (a key can't be reused for another checkout). */
  idempotency: Record<string, { status: number; body: unknown; quoteId?: string }>;
  lastPrompt: Record<string, number>;
  /** Password-reset links by token (a real server emails them). */
  resets: Record<string, { email: string; exp: number }>;
}

/** Bumped whenever the store's shape changes: it is demo data, so an older store is simply left behind. */
const KEY = 'mock.db.v2';
const empty = (): Db => ({
  users: [],
  session: null,
  bookings: [],
  orders: [],
  fails: {},
  pending: {},
  quotes: {},
  idempotency: {},
  lastPrompt: {},
  resets: {},
});

let cache: Db | null = null;

// One "server" across tabs: when another tab's mock writes the store, drop this tab's copy and re-read it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) cache = null;
  });
}

export function db(): Db {
  if (!cache) cache = { ...empty(), ...local.get<Partial<Db>>(KEY, {}) };
  return cache;
}

/** Persists after a mutation. Call once per handler that changed something. */
export const save = () => {
  if (cache) local.set(KEY, cache);
};

/** Tests and "reset demo data". Drops memory and storage. */
export function resetDb() {
  cache = empty();
  local.del(KEY);
}

export const rid = (prefix: string) =>
  `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(9)), (x) => x.toString(16).padStart(2, '0')).join('')}`;

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Booking references: AV- + 6 characters without look-alikes (0/O, 1/I). 256 % 32 = 0, so no modulo bias. */
export function newRef(): string {
  const taken = new Set(db().bookings.map((b) => b.ref));
  let ref: string;
  do {
    ref = 'AV-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => REF_ALPHABET[x % 32]).join('');
  } while (taken.has(ref));
  return ref;
}
