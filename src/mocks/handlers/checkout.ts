import { http, HttpResponse } from 'msw';
import { currentUser, methodExpired, toMethod } from '../auth';
import { withoutBooked } from '../basket';
import { getProperty } from '../catalog';
import { db, newRef, rid, save, type BookingRec, type OrderRec, type QuoteRec } from '../db';
import { fail, readJson, str, wait } from '../http';
import { buildQuote, forStay, quoteStay } from '../quote';
import { config } from '@/lib/config';
import { e164Ok, phoneDigits, phoneOk, toE164 } from '@/lib/phone';
import { serviceFee } from '@/lib/pricing';
import { readCardToken } from '@/lib/payments/mockToken';
import { emailOk } from '@/lib/validation/rules';
import type { Booking, BookingPayment, Order, PaymentMethodKind, Quote, StayQuote } from '@/types';

const base = config.apiBase;

/** Documented test triggers (docs/06 §9). The last four digits of the wallet number or card decide the outcome. */
const OUTCOME = {
  declined: ['0199', '0002'],
  insufficient: ['9995'],
  timeout: ['0198'],
  slow: ['0197'],
  repriced: ['0196'],
  /** Paid, then the last property in the order can't confirm its booking: that booking is refunded. */
  refused: ['0195'],
} as const;
const is = (list: readonly string[], key: string) => list.includes(key);
const PROMPT_MS = 90e3;
const SLOW_MS = 6e3;
/** Presenting the app: every other wallet payment also waits for approval (and confirms after this long), so the
 *  wallet approval screens always show. Off under test; flip to `false` to make ordinary wallet payments instant. */
const DEMO_APPROVAL = import.meta.env.MODE !== 'test';
const DEMO_MS = 12e3;

const WALLETS: Record<string, string[]> = {
  waafipay: ['EVC Plus', 'ZAAD', 'SAHAL'],
  edahab: ['eDahab', 'Premier Wallet'],
};

const usd = (amount: number) => ({ amount, currency: 'USD' as const });

/** Strips mock-only bookkeeping from a stored booking. */
export function publicBooking(rec: BookingRec): Booking {
  const { demo: _d, ...b } = rec;
  void _d;
  return b;
}

const bookingsOf = (o: OrderRec) =>
  o.bookingRefs.map((ref) => db().bookings.find((b) => b.ref === ref)).filter((b): b is BookingRec => !!b);

/** Strips mock-only bookkeeping from a stored order and puts its bookings in. */
export function publicOrder(o: OrderRec): Order {
  const {
    bookingRefs: _r,
    quoteId: _q,
    paymentToken: _p,
    settleAt: _s,
    settleTo: _t,
    failReason: _f,
    refuse: _x,
    demo: _d,
    ...rest
  } = o;
  void [_r, _q, _p, _s, _t, _f, _x, _d];
  return { ...rest, bookings: bookingsOf(o).map(publicBooking) };
}

/**
 * The payment went through: each property confirms its booking. One that refuses (the `refused` fixture; in production
 * a property-side rejection) is marked `failed` and its own total refunded, never the others'. The order says what
 * happened overall. Nothing is confirmed before the payment is.
 */
function paid(o: OrderRec) {
  const now = new Date().toISOString();
  o.payment.paidAt = now;
  let refunded = 0;
  bookingsOf(o).forEach((b, i) => {
    b.payment = { ...b.payment, paidAt: now };
    if (o.refuse?.includes(i)) {
      b.status = 'failed';
      b.refundedAt = now;
      refunded += b.quote.total.amount;
    } else b.status = 'confirmed';
  });
  const all = o.bookingRefs.length;
  const refusedN = o.refuse?.filter((i) => i < all).length ?? 0;
  o.status = refusedN === 0 ? 'confirmed' : refusedN === all ? 'failed' : 'partially_confirmed';
  if (refunded) o.refunded = usd(refunded);
  // Paid stays leave the account's basket now, not when the prompt is sent: a payment that fails keeps them.
  const owner = db().users.find((u) => u.id === o.accountId);
  const quote = db().quotes[o.quoteId];
  if (owner && quote) owner.basket = withoutBooked(owner.basket, quote.stays);
}

/** Resolves a pending mobile-money prompt once its time has come. */
function settle(o: OrderRec) {
  if (o.status !== 'pending_payment' || !o.settleAt || Date.now() < o.settleAt || !o.settleTo) return;
  if (o.settleTo === 'confirmed') paid(o);
  else {
    o.status = 'payment_failed';
    bookingsOf(o).forEach((b) => (b.status = 'payment_failed'));
  }
  save();
}

/** Brings any of these bookings' orders up to date (a prompt may have resolved since). */
export function settleOrdersOf(refs: string[]) {
  for (const o of db().orders) if (o.bookingRefs.some((r) => refs.includes(r))) settle(o);
}

const mask = (e164: string) => {
  const d = phoneDigits(e164);
  return `+252 ${d.slice(0, 2)} *** ${d.slice(5)}`;
};

/** The repriced fixture: every stay 10% dearer, as a new quote. */
function reprice(rec: QuoteRec): QuoteRec {
  const stays: StayQuote[] = rec.quote.stays.map((s) => {
    const subtotal = Math.round((s.subtotal.amount * 1.1) / 100) * 100;
    const fee = serviceFee(subtotal);
    return { ...s, subtotal: usd(subtotal), serviceFee: usd(fee), total: usd(subtotal + fee) };
  });
  const quote: Quote = {
    ...rec.quote,
    quoteId: rid('q'),
    stays,
    total: usd(stays.reduce((a, s) => a + s.total.amount, 0)),
    expiresAt: new Date(Date.now() + 15 * 60e3).toISOString(),
  };
  const next: QuoteRec = { ...rec, quote, repriced: true };
  db().quotes[quote.quoteId] = next;
  return next;
}

function bearer(request: Request) {
  const h = request.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

/** Payment token (guests) or the member who owns the order. */
function canSee(request: Request, o: OrderRec) {
  const token = bearer(request);
  if (token && o.paymentToken && token === o.paymentToken) return true;
  const u = currentUser();
  return !!u && o.accountId === u.id;
}

const findOrder = (id: string) => db().orders.find((o) => o.id === id);

export const checkoutHandlers = [
  http.post(`${base}/quotes`, async ({ request }) => {
    const b = await readJson(request);
    const stays = (Array.isArray(b.stays) ? (b.stays as Record<string, unknown>[]) : []).map((s) => ({
      propertyId: str(s?.propertyId),
      checkIn: str(s?.checkIn),
      checkOut: str(s?.checkOut),
      guests: Number(s?.guests) || 2,
      selection: Array.isArray(s?.selection)
        ? (s.selection as { roomTypeId?: unknown; qty?: unknown }[]).map((x) => ({
            roomTypeId: str(x?.roomTypeId),
            qty: Number(x?.qty),
          }))
        : [],
    }));
    const r = buildQuote({ stays });
    if (!r.ok)
      return fail(r.status, r.code, r.message, {
        ...(r.fieldErrors ? { fieldErrors: r.fieldErrors } : {}),
        ...(r.stays ? { body: { stays: r.stays } } : {}),
      });
    return HttpResponse.json(r.rec.quote);
  }),

  /**
   * One checkout (docs/06 §4.2): one payment for every stay in the quote, a booking per stay. The request is replayed
   * from the idempotency key, and a quote pays for at most one order, so a retry or a second tap never books or charges
   * twice. Stock is checked again before anything is charged.
   */
  http.post(`${base}/orders`, async ({ request }) => {
    const key = request.headers.get('idempotency-key');
    if (!key) return fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key header.');
    const b = await readJson(request);
    const quoteId = str(b.quoteId);
    const seen = db().idempotency[key];
    if (seen) {
      if (seen.quoteId && seen.quoteId !== quoteId)
        return fail(422, 'IDEMPOTENCY_KEY_REUSED', 'That key was used for a different checkout.');
      return HttpResponse.json(seen.body as object, { status: seen.status });
    }
    const reply = (status: number, body: object) => {
      db().idempotency[key] = { status, body, quoteId };
      save();
      return HttpResponse.json(body, { status });
    };
    /** An error envelope that is also remembered under the idempotency key, so a retry gets the same answer. */
    const failWith = (
      status: number,
      code: string,
      message: string,
      extra: { fieldErrors?: Record<string, string>; body?: object } = {},
    ) =>
      reply(status, {
        error: { code, message, ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}), retryable: false },
        ...extra.body,
      });

    await wait(400);
    const g = (b.guest ?? {}) as Record<string, unknown>;
    const pay = (b.payment ?? {}) as Record<string, unknown>;
    const quoteRec = db().quotes[quoteId];
    if (!quoteRec || new Date(quoteRec.quote.expiresAt) < new Date())
      return failWith(409, 'QUOTE_EXPIRED', 'Your price has expired. Please review it again.');
    // A quote pays for one order. Only an order whose payment failed lets the same quote be paid again.
    const used = db().orders.find((o) => o.quoteId === quoteId && o.status !== 'payment_failed');
    if (used)
      return failWith(409, 'QUOTE_USED', 'This checkout has already been paid for.', { body: { orderId: used.id } });

    const fieldErrors: Record<string, string> = {};
    if (str(g.name).trim().length < 3) fieldErrors['guest.name'] = 'REQUIRED';
    // The contact number is E.164 from any listed country; a bare Somali number is still taken as +252.
    const guestPhone = str(g.phone).startsWith('+') ? str(g.phone) : phoneOk(str(g.phone)) ? toE164(str(g.phone)) : '';
    if (!e164Ok(guestPhone)) fieldErrors['guest.phone'] = 'INVALID_PHONE';
    if (!emailOk(str(g.email))) fieldErrors['guest.email'] = 'INVALID_EMAIL';

    const user = currentUser();
    const savedId = str(pay.savedMethodId);
    const saved = savedId && user ? user.methods.find((m) => m.id === savedId) : undefined;
    if (savedId && (!saved || methodExpired(toMethod(saved)))) fieldErrors['payment.savedMethodId'] = 'INVALID_CARD';

    let method: PaymentMethodKind = saved ? saved.kind : (str(pay.method) as PaymentMethodKind);
    let brand = saved ? saved.brand : str(pay.brand);
    let last4: string | undefined = saved?.last4;
    let outcomeKey = saved
      ? saved.kind === 'card'
        ? (saved.last4 ?? '')
        : phoneDigits(saved.phone ?? '').slice(-4)
      : '';
    let payPhone = saved?.phone ?? '';
    let card = null as ReturnType<typeof readCardToken>;
    if (!saved) {
      if (method === 'card') {
        card = readCardToken(str(pay.cardToken));
        if (!card) fieldErrors['payment.cardToken'] = 'INVALID_CARD';
        else {
          brand = card.brand;
          last4 = card.last4;
          outcomeKey = card.last4;
        }
      } else if (WALLETS[method]?.includes(brand)) {
        payPhone = str(pay.payPhone);
        if (!phoneOk(payPhone)) fieldErrors['payment.payPhone'] = 'INVALID_PHONE';
        outcomeKey = phoneDigits(payPhone).slice(-4);
      } else {
        method = 'card';
        fieldErrors['payment.method'] = 'REQUIRED';
      }
    }
    if (Object.keys(fieldErrors).length)
      return failWith(422, 'VALIDATION_FAILED', 'Some fields need attention.', { fieldErrors });

    // Before any money moves: every stay must still be bookable at the quoted price.
    const now = quoteRec.stays.map(quoteStay);
    const gone = now.flatMap((q, i) => (!q.ok ? [i] : []));
    if (gone.length)
      return failWith(409, 'ROOM_UNAVAILABLE', 'Some rooms are no longer available.', {
        fieldErrors: Object.assign(
          {},
          ...gone.map((i) => {
            const q = now[i]!;
            return q.ok ? {} : forStay(q, i).fieldErrors;
          }),
        ),
        body: { stays: gone },
      });
    const drifted =
      !quoteRec.repriced && now.some((q, i) => q.ok && q.stay.total.amount !== quoteRec.quote.stays[i]!.total.amount);
    if (drifted || (is(OUTCOME.repriced, outcomeKey) && !quoteRec.repriced)) {
      // The price moved (really, or by the test number): the server's new quote, to be accepted before anything is charged.
      const fresh = drifted ? buildQuote({ stays: quoteRec.stays }) : null;
      const next = fresh?.ok ? fresh.rec : reprice(quoteRec);
      return failWith(409, 'PRICE_CHANGED', 'The price changed since you last looked.', {
        body: { newQuote: next.quote },
      });
    }
    if (is(OUTCOME.declined, outcomeKey)) return failWith(402, 'PAYMENT_DECLINED', 'Your payment was declined.');
    if (is(OUTCOME.insufficient, outcomeKey))
      return failWith(402, 'INSUFFICIENT_FUNDS', 'Not enough funds in that wallet.');

    const slow = is(OUTCOME.slow, outcomeKey);
    const timeout = is(OUTCOME.timeout, outcomeKey);
    const pending = timeout || slow || (DEMO_APPROVAL && method !== 'card');
    const demoApproval = pending && DEMO_APPROVAL && !slow && !timeout;
    const created = new Date().toISOString();
    const payment: BookingPayment = {
      method,
      brand,
      ...(last4 ? { last4 } : {}),
      ...(method !== 'card' ? { payPhoneMasked: mask(payPhone) } : {}),
    };
    const order: OrderRec = {
      id: rid('ord'),
      quoteId,
      status: 'pending_payment',
      total: quoteRec.quote.total,
      payment,
      bookingRefs: [],
      ...(user ? { accountId: user.id } : {}),
      createdAt: created,
      ...(is(OUTCOME.refused, outcomeKey) ? { refuse: [quoteRec.stays.length - 1] } : {}),
      ...(!user ? { paymentToken: rid('pt') } : {}),
    };
    const guest = { name: str(g.name).trim(), phone: guestPhone, email: str(g.email).trim() };
    const bookings: BookingRec[] = now.map((q) => {
      if (!q.ok) throw new Error('unreachable');
      const prop = getProperty(q.stay.propertyId)!;
      return {
        ref: newRef(),
        orderId: order.id,
        status: 'pending_payment',
        property: {
          id: prop.id,
          name: prop.name,
          address: prop.address,
          checkInFrom: prop.checkInFrom,
          checkOutUntil: prop.checkOutUntil,
          whatsapp: prop.whatsapp,
          type: prop.type,
          area: prop.area,
          city: prop.city,
          hue: prop.hue,
          propertyType: prop.propertyType,
          ...(prop.images[0] ? { image: prop.images[0] } : {}),
        },
        trip: q.trip,
        quote: q.stay,
        guest,
        payment,
        ...(user ? { accountId: user.id } : {}),
        createdAt: created,
      };
    });
    db().bookings.unshift(...bookings);
    order.bookingRefs = bookings.map((x) => x.ref);
    if (pending) {
      order.settleAt = Date.now() + (demoApproval ? DEMO_MS : slow ? SLOW_MS : PROMPT_MS);
      order.settleTo = demoApproval || slow ? 'confirmed' : 'payment_failed';
      order.failReason = 'TIMEOUT';
    } else paid(order);
    db().orders.unshift(order);

    // Saving the method never fails the order (docs/06 §5b).
    if (user && b.saveMethod === true && !saved && user.methods.length < config.limits.savedMethodsMax) {
      const dup = user.methods.some(
        (m) =>
          m.kind === method &&
          m.brand === brand &&
          (method === 'card'
            ? m.last4 === last4 && m.expMonth === card?.expMonth && m.expYear === card?.expYear
            : phoneDigits(m.phone ?? '') === phoneDigits(payPhone)),
      );
      if (!dup) {
        const entry = {
          id: rid('pm'),
          token: rid('tok'),
          createdAt: created,
          kind: method,
          brand,
          ...(method === 'card'
            ? { last4: last4!, expMonth: card!.expMonth, expYear: card!.expYear }
            : { phone: toE164(payPhone) }),
        };
        user.methods.push(entry);
        if (!user.defaultMethodId) user.defaultMethodId = entry.id;
      }
    }

    const body = {
      ...publicOrder(order),
      ...(order.paymentToken ? { paymentToken: order.paymentToken } : {}),
      ...(pending ? { paymentPrompt: { expiresAt: new Date(Date.now() + PROMPT_MS).toISOString() } } : {}),
    };
    return reply(pending ? 202 : 201, body);
  }),

  http.get(`${base}/orders/:id/payment-status`, ({ params, request }) => {
    const o = findOrder(String(params.id));
    if (!o || !canSee(request, o)) return fail(404, 'ORDER_NOT_FOUND', 'No order found.');
    settle(o);
    return HttpResponse.json({
      status: o.status,
      ...(o.status === 'payment_failed' ? { reason: o.failReason ?? 'USER_DECLINED' } : {}),
    });
  }),

  http.post(`${base}/orders/:id/payment-prompt`, ({ params, request }) => {
    const o = findOrder(String(params.id));
    if (!o || !canSee(request, o)) return fail(404, 'ORDER_NOT_FOUND', 'No order found.');
    const last = db().lastPrompt[o.id] ?? 0;
    if (Date.now() - last < 30e3) {
      return fail(429, 'RATE_LIMITED', 'Please wait before asking for another prompt.', {
        headers: { 'Retry-After': String(Math.ceil((30e3 - (Date.now() - last)) / 1000)) },
      });
    }
    settle(o);
    if (o.status !== 'pending_payment' && o.status !== 'payment_failed')
      return fail(409, 'ORDER_NOT_PENDING', 'This order has already been paid.');
    db().lastPrompt[o.id] = Date.now();
    o.status = 'pending_payment';
    bookingsOf(o).forEach((x) => (x.status = 'pending_payment'));
    o.settleAt = Date.now() + 4e3;
    o.settleTo = 'confirmed';
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${base}/orders/:id`, ({ params, request }) => {
    const o = findOrder(String(params.id));
    if (!o || !canSee(request, o)) return fail(404, 'ORDER_NOT_FOUND', 'No order found.');
    settle(o);
    return HttpResponse.json(publicOrder(o));
  }),

  http.get(`${base}/bookings/:ref`, ({ params }) => {
    const u = currentUser();
    if (!u) return fail(401, 'UNAUTHORIZED', 'Sign in to view this booking.');
    const ref = String(params.ref).toUpperCase();
    settleOrdersOf([ref]);
    const rec = db().bookings.find((b) => b.ref === ref);
    if (!rec || rec.accountId !== u.id) return fail(404, 'BOOKING_NOT_FOUND', 'No booking found.');
    return HttpResponse.json(publicBooking(rec));
  }),
];
