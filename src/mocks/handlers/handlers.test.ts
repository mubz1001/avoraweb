import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../server';
import { newUser, putUser } from '../auth';
import { db, resetDb } from '../db';
import { ApiError } from '@/lib/api/client';
import { accountApi, catalogApi, checkoutApi, type QuoteStayRequest, type SearchFilters } from '@/lib/api/endpoints';
import { DEMO_ACCOUNTS } from '@/lib/demoAccounts';
import { makeCardToken } from '@/lib/payments/mockToken';
import type { Basket, BasketStay, Quote, Trip } from '@/types';

const trip: Trip = {
  type: 'hotel',
  city: 'Mogadishu',
  checkIn: '2026-10-15',
  checkOut: '2026-10-17',
  guests: 2,
  rooms: 1,
};
const noFilters: SearchFilters = { sort: 'rec', maxPrice: 0, minRating: 0, amenities: [], propertyTypes: [] };
const guest = { name: 'Amina Hassan', phone: '61 555 0142', email: 'amina@example.com' };
const profile = { firstName: 'Amina', lastName: 'Hassan', email: 'amina@example.com', phone: '61 555 0142' };

const fails = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected the call to fail');
};

/** One stay as a quote asks for it: a double room at the property, on the shared test dates. */
const stay = (propertyId: string, over: Partial<QuoteStayRequest> = {}): QuoteStayRequest => ({
  propertyId,
  checkIn: trip.checkIn,
  checkOut: trip.checkOut,
  guests: 2,
  selection: [{ roomTypeId: 'double', qty: 1 }],
  ...over,
});
/** The same stay as the basket stores it. */
const bstay = (over: Partial<BasketStay> = {}): BasketStay => ({
  propertyId: 'jazeera',
  type: 'hotel',
  checkIn: trip.checkIn,
  checkOut: trip.checkOut,
  guests: 2,
  rooms: 1,
  lines: [{ roomTypeId: 'double', qty: 1 }],
  updatedAt: new Date().toISOString(),
  ...over,
});
const WALLET = { method: 'waafipay' as const, brand: 'EVC Plus', payPhone: '61 555 0142' };

/** Quotes these stays and pays for them in one order. */
const pay = async (stays: QuoteStayRequest[], payment: object, key = crypto.randomUUID()) => {
  const quote = await checkoutApi.quote(stays);
  return { quote, res: await checkoutApi.createOrder({ quoteId: quote.quoteId, guest, payment }, key), key };
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
  resetDb();
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe('discovery', () => {
  it('city counts equal the unfiltered search total (audit issue 11)', async () => {
    const { items } = await catalogApi.cities('hotel');
    for (const c of items) {
      const r = await catalogApi.search({ ...trip, city: c.name }, noFilters);
      expect(r.total).toBe(c.count);
    }
  });

  it('newest never overlaps featured (issue 13)', async () => {
    const h = await catalogApi.home('hotel');
    const featured = new Set(h.featured.map((p) => p.id));
    expect(h.featured).toHaveLength(3);
    expect(h.newest.every((p) => !featured.has(p.id))).toBe(true);
  });

  it('lists unavailable stays after available ones and resolves partial city names', async () => {
    const r = await catalogApi.search({ ...trip, city: 'Mog' }, noFilters);
    expect(r.resolvedCity).toBe('Mogadishu');
    const ocean = r.items.findIndex((i) => i.property.id === 'ocean');
    expect(r.items[ocean]?.availability).toBe('unavailable');
    expect(r.items[ocean]?.stayTotal).toBeUndefined();
    expect(r.items.slice(0, r.availableCount).every((i) => i.availability === 'available')).toBe(true);
    expect(ocean).toBeGreaterThanOrEqual(r.availableCount);
  });

  it('reports an unknown city as null so the UI shows its empty state', async () => {
    expect((await catalogApi.search({ ...trip, city: 'Atlantis' }, noFilters)).resolvedCity).toBeNull();
  });

  it('omits ratings below 3 reviews and keeps rating = review summary (issue 3)', async () => {
    const shamo = await catalogApi.property('shamo');
    expect(shamo.rating).toBeUndefined();
    const jazeera = await catalogApi.property('jazeera');
    const page = await catalogApi.reviews('jazeera', { sort: 'relevant', score: '', topic: '' });
    expect(jazeera.rating?.count).toBe(page.summary?.count);
    expect(jazeera.rating?.score).toBe(page.summary?.score);
    expect(jazeera.latestReviews).toHaveLength(4);
  });

  it('filters, sorts and pages reviews', async () => {
    const all = await catalogApi.reviews('jazeera', { sort: 'newest', score: '', topic: '' });
    expect(all.items).toHaveLength(10);
    expect(all.nextCursor).toBe('c_10');
    const next = await catalogApi.reviews('jazeera', {
      sort: 'newest',

      score: '',
      topic: '',
      cursor: 'c_10',
    });
    expect(next.items[0]?.id).not.toBe(all.items[0]?.id);
    const fives = await catalogApi.reviews('jazeera', { sort: 'highest', score: '5', topic: '' });
    expect(fives.items.every((r) => r.score === 5)).toBe(true);
  });

  it('shows scarcity only from real stock and recommends a fitting type (issue 2)', async () => {
    const a = await catalogApi.availability('jazeera', trip);
    expect(a.roomTypes.find((r) => r.roomTypeId === 'suite')?.available).toBe(2);
    expect(a.recommendation).toEqual({ roomTypeId: 'double', qty: 1 });
    expect((await catalogApi.availability('ocean', trip)).available).toBe(false);
  });

  it('rejects a past check-in with a field error', async () => {
    const e = await fails(catalogApi.search({ ...trip, checkIn: '2026-10-01' }, noFilters));
    expect(e.status).toBe(422);
    expect(e.fieldErrors.checkIn).toBe('DATE_IN_PAST');
  });

  it('answers a missing property with PROPERTY_NOT_FOUND', async () => {
    expect((await fails(catalogApi.property('nope'))).code).toBe('PROPERTY_NOT_FOUND');
  });
});

describe('accounts', () => {
  it('registers, signs in and reads /me', async () => {
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    expect((await accountApi.me()).member.email).toBe('amina@example.com');
    await accountApi.logout();
    expect((await fails(accountApi.me())).status).toBe(401);
    const { member } = await accountApi.login('AMINA@example.com', 'purple tractor lamp');
    expect(member.hasPassword).toBe(true);
  });

  describe('password reset', () => {
    const linkFor = async (email: string) => {
      await accountApi.requestReset(email);
      return Object.keys(db().resets)[0];
    };

    it('answers every email alike and only issues a link for a real account', async () => {
      await accountApi.register({ ...profile, password: 'purple tractor lamp' });
      await accountApi.logout();
      await accountApi.requestReset('nobody@example.com');
      expect(Object.keys(db().resets)).toHaveLength(0);
      expect(await linkFor('AMINA@example.com')).toMatch(/^rst_/);
    });

    it('sets the new password once, ends the session and clears the lock', async () => {
      await accountApi.register({ ...profile, password: 'purple tractor lamp' });
      const token = (await linkFor('amina@example.com'))!;
      await accountApi.confirmReset({ token, password: 'orange kettle drum' });
      expect((await fails(accountApi.me())).status).toBe(401);
      expect((await fails(accountApi.login('amina@example.com', 'purple tractor lamp'))).code).toBe('BAD_CREDENTIALS');
      expect((await accountApi.login('amina@example.com', 'orange kettle drum')).member.firstName).toBe('Amina');
      expect((await fails(accountApi.confirmReset({ token, password: 'another long phrase' }))).status).toBe(410);
    });

    it('refuses a weak password without using the link, and an unknown or expired link', async () => {
      await accountApi.register({ ...profile, password: 'purple tractor lamp' });
      const token = (await linkFor('amina@example.com'))!;
      expect((await fails(accountApi.confirmReset({ token, password: 'short' }))).fieldErrors).toEqual({
        password: 'TOO_SHORT',
      });
      expect((await fails(accountApi.confirmReset({ token: 'rst_nope', password: 'orange kettle drum' }))).status).toBe(
        410,
      );
      vi.setSystemTime(new Date(2026, 9, 12, 15, 31));
      expect((await fails(accountApi.confirmReset({ token, password: 'orange kettle drum' }))).status).toBe(410);
    });
  });

  describe('reviews', () => {
    const TEXT = 'The room was spotless and the staff were wonderful throughout.';
    /** The demo member's finished stay (a past stay can't be booked through the API). */
    const finishedStay = async () => {
      await accountApi.login(DEMO_ACCOUNTS.email.email, DEMO_ACCOUNTS.email.password);
      return (await accountApi.bookings()).past.find((b) => b.status === 'confirmed')!.ref;
    };
    const upcomingStay = async () => {
      await accountApi.register({ ...profile, password: 'purple tractor lamp' });
      const { res } = await pay([stay('jazeera')], {
        method: 'card',
        cardToken: makeCardToken('Visa', '4242', 12, 2030).token,
      });
      return res.bookings[0]!.ref;
    };

    it('takes one review from the owner of a finished, confirmed stay and shows it on the booking', async () => {
      const ref = await finishedStay();
      await accountApi.submitReview(ref, { score: 5, text: TEXT }, 'k1');
      const b = (await accountApi.bookings()).past.find((x) => x.ref === ref)!;
      expect(b.review?.score).toBe(5);
      expect((await fails(accountApi.submitReview(ref, { score: 4, text: TEXT }, 'k2'))).code).toBe('ALREADY_REVIEWED');
    });

    it('answers a repeated key with the original success, never a 409', async () => {
      const ref = await finishedStay();
      await accountApi.submitReview(ref, { score: 5, text: TEXT }, 'same');
      await expect(accountApi.submitReview(ref, { score: 5, text: TEXT }, 'same')).resolves.toBeUndefined();
    });

    it('refuses a stay that is not finished, another member’s booking and a signed-out caller', async () => {
      const upcoming = await upcomingStay();
      expect((await fails(accountApi.submitReview(upcoming, { score: 5, text: TEXT }, 'k'))).code).toBe('NOT_ELIGIBLE');
      expect((await fails(accountApi.submitReview('AV-NOPE00', { score: 5, text: TEXT }, 'k'))).status).toBe(404);
      await accountApi.logout();
      expect((await fails(accountApi.submitReview(upcoming, { score: 5, text: TEXT }, 'k'))).status).toBe(401);
      await accountApi.register({
        ...profile,
        email: 'other@example.com',
        phone: '61 555 0143',
        password: 'purple tractor lamp',
      });
      expect((await fails(accountApi.submitReview(upcoming, { score: 5, text: TEXT }, 'k'))).status).toBe(404);
    });

    it('refuses a missing rating and a short, empty or over-long text without using the key', async () => {
      const ref = await finishedStay();
      expect((await fails(accountApi.submitReview(ref, { score: 0, text: TEXT }, 'a'))).fieldErrors).toEqual({
        score: 'REQUIRED',
      });
      expect((await fails(accountApi.submitReview(ref, { score: 5, text: '   ' }, 'a'))).fieldErrors).toEqual({
        text: 'REQUIRED',
      });
      expect((await fails(accountApi.submitReview(ref, { score: 5, text: 'short' }, 'a'))).fieldErrors).toEqual({
        text: 'TOO_SHORT',
      });
      expect(
        (await fails(accountApi.submitReview(ref, { score: 5, text: 'x'.repeat(2001) }, 'a'))).fieldErrors,
      ).toEqual({ text: 'TOO_LONG' });
      await expect(accountApi.submitReview(ref, { score: 5, text: TEXT }, 'a')).resolves.toBeUndefined();
    });
  });

  it('gives the same error for an unknown email and a wrong password', async () => {
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    await accountApi.logout();
    const a = await fails(accountApi.login('nobody@example.com', 'whatever pass'));
    const b = await fails(accountApi.login('amina@example.com', 'whatever pass'));
    expect([a.status, a.code, a.message]).toEqual([b.status, b.code, b.message]);
    expect(a.code).toBe('BAD_CREDENTIALS');
  });

  it('locks an email after five failures, even for the right password', async () => {
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    await accountApi.logout();
    for (let i = 0; i < 4; i++)
      expect((await fails(accountApi.login('amina@example.com', 'wrong password'))).code).toBe('BAD_CREDENTIALS');
    expect((await fails(accountApi.login('amina@example.com', 'wrong password'))).code).toBe('RATE_LIMITED');
    const locked = await fails(accountApi.login('amina@example.com', 'purple tractor lamp'));
    expect(locked.code).toBe('RATE_LIMITED');
    expect(locked.retryAfter).toBeGreaterThan(0);
  });

  it('validates sign-up fields and refuses a duplicate email', async () => {
    const bad = await fails(accountApi.register({ ...profile, phone: '123', password: 'short' }));
    expect(bad.fieldErrors).toMatchObject({ phone: 'INVALID_PHONE', password: 'TOO_SHORT' });
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    await accountApi.logout();
    expect((await fails(accountApi.register({ ...profile, password: 'purple tractor lamp' }))).code).toBe(
      'EMAIL_TAKEN',
    );
  });

  it('runs a Google sign-up through the pending step', async () => {
    const first = await accountApi.oauth('google', 'new@example.com');
    if (!('pendingToken' in first)) throw new Error('expected a pending sign-up');
    const { member } = await accountApi.oauthComplete({
      pendingToken: first.pendingToken,
      firstName: 'New',
      lastName: 'Person',
      phone: '71 555 0100',
    });
    expect(member.providers).toEqual(['google']);
    expect(member.hasPassword).toBe(false);
    await accountApi.logout();
    const again = await accountApi.oauth('google', 'new@example.com');
    expect('member' in again).toBe(true);
  });

  it('requires the current password to change the email or delete the account', async () => {
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    expect((await fails(accountApi.update({ ...profile, email: 'other@example.com' }))).code).toBe('BAD_PASSWORD');
    expect(
      (await accountApi.update({ ...profile, email: 'other@example.com', currentPassword: 'purple tractor lamp' }))
        .member.email,
    ).toBe('other@example.com');
    expect((await fails(accountApi.remove('nope nope nope'))).code).toBe('BAD_PASSWORD');
    await accountApi.remove('purple tractor lamp');
    expect((await fails(accountApi.me())).status).toBe(401);
  });

  it('keeps favourites on the account, drops unknown ids and repeats, and needs a sign-in', async () => {
    expect((await fails(accountApi.favourites())).status).toBe(401);
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    expect((await accountApi.putFavourites(['lido', 'ghost', 'lido'])).propertyIds).toEqual(['lido']);
    expect((await accountApi.putFavourites(['karkaar'])).propertyIds).toEqual(['karkaar']);
    expect((await accountApi.favourites()).propertyIds).toEqual(['karkaar']);
  });

  it('manages saved payment methods: default, duplicates, removal falls back to a usable one', async () => {
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    const evc = await accountApi.addMethod({ kind: 'waafipay', brand: 'EVC Plus', phone: '+252615550142' });
    const card = makeCardToken('Visa', '4242', 12, 2030);
    const visa = await accountApi.addMethod({ kind: 'card', providerToken: card.token });
    expect((await accountApi.methods()).defaultId).toBe(evc.id);
    expect(
      (await fails(accountApi.addMethod({ kind: 'waafipay', brand: 'EVC Plus', phone: '61 555 0142' }))).code,
    ).toBe('DUPLICATE_METHOD');
    await accountApi.setDefaultMethod(visa.id);
    await accountApi.removeMethod(visa.id);
    const left = await accountApi.methods();
    expect(left.items).toHaveLength(1);
    expect(left.defaultId).toBe(evc.id);
  });

  it('repairs a demo member saved without a password by an older version', async () => {
    const evc = {
      id: 'pm_old',
      token: 'tok_old',
      createdAt: '2026-01-01T00:00:00Z',
      kind: 'waafipay' as const,
      brand: 'EVC Plus',
      phone: '+252615550100',
    };
    putUser(
      newUser(
        { firstName: 'Amina', lastName: 'Hassan', email: DEMO_ACCOUNTS.email.email, phone: '+252615550100' },
        { methods: [evc], defaultMethodId: evc.id },
      ),
    );
    const { member } = await accountApi.login(DEMO_ACCOUNTS.email.email, DEMO_ACCOUNTS.email.password);
    expect(member.hasPassword).toBe(true);
  });

  it('opens the Google/Apple demo member through the provider path, with no password to type', async () => {
    const r = await accountApi.oauth('google', DEMO_ACCOUNTS.social.email);
    expect('member' in r && r.member.firstName).toBe('Omar');
    expect((await accountApi.bookings()).upcoming.length).toBe(2);
    await accountApi.logout();
    expect((await fails(accountApi.login(DEMO_ACCOUNTS.social.email, 'anything at all'))).code).toBe('BAD_CREDENTIALS');
    const again = await accountApi.oauth('apple', DEMO_ACCOUNTS.social.email);
    expect('member' in again && again.member.id).toBe('member' in r ? r.member.id : '');
  });

  it('seeds the demo member with upcoming and past bookings, signed in through the ordinary email login', async () => {
    await accountApi.login(DEMO_ACCOUNTS.email.email, DEMO_ACCOUNTS.email.password);
    const b = await accountApi.bookings();
    expect(b.upcoming.length).toBe(2);
    expect(b.past.length).toBe(1);
    expect((await accountApi.methods()).items).toHaveLength(3);
  });
});

describe('checkout', () => {
  it('prices a quote with the 2% fee: 2 × $100 × 2 nights = $408', async () => {
    const q = await checkoutApi.quote([stay('jazeera', { guests: 4, selection: [{ roomTypeId: 'double', qty: 2 }] })]);
    const s = q.stays[0]!;
    expect([s.subtotal.amount, s.serviceFee.amount, s.total.amount, s.nights]).toEqual([40000, 800, 40800, 2]);
    expect(s.freeCancellationUntil).toBe('2026-10-14');
    expect(q.total.amount).toBe(40800);
  });

  it('prices every stay on its own and totals them: two hotels, different dates', async () => {
    const q = await checkoutApi.quote([
      stay('jazeera'),
      stay('lido', { checkIn: '2026-10-20', checkOut: '2026-10-23', selection: [{ roomTypeId: 'suite', qty: 1 }] }),
    ]);
    expect(q.stays.map((s) => s.propertyId)).toEqual(['jazeera', 'lido']);
    expect(q.stays.map((s) => s.nights)).toEqual([2, 3]);
    expect(q.stays[0]!.lines[0]!.roomTypeId).toBe('double');
    expect(q.stays[1]!.lines[0]!.roomTypeId).toBe('suite');
    expect(q.stays.every((s) => s.total.amount === s.subtotal.amount + s.serviceFee.amount)).toBe(true);
    expect(q.total.amount).toBe(q.stays.reduce((n, s) => n + s.total.amount, 0));
  });

  it('refuses more rooms than are left, naming the stay', async () => {
    const e = await fails(
      checkoutApi.quote([
        stay('jazeera'),
        stay('jazeera', {
          guests: 8,
          selection: [{ roomTypeId: 'suite', qty: 3 }],
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
        }),
      ]),
    );
    expect(e.code).toBe('ROOM_UNAVAILABLE');
    expect(e.fieldErrors['stays.1.selection.suite']).toBe('ONLY_2_LEFT');
    expect((e.body as { stays: number[] }).stays).toEqual([1]);
  });

  it('refuses an empty, duplicated or oversized checkout', async () => {
    expect((await fails(checkoutApi.quote([]))).fieldErrors).toEqual({ selection: 'REQUIRED' });
    expect((await fails(checkoutApi.quote([stay('jazeera'), stay('jazeera')]))).fieldErrors).toEqual({
      stays: 'DUPLICATE_STAY',
    });
    const many = Array.from({ length: 11 }, (_, i) =>
      stay('jazeera', {
        checkIn: `2026-11-${String(i + 1).padStart(2, '0')}`,
        checkOut: `2026-11-${String(i + 2).padStart(2, '0')}`,
      }),
    );
    expect((await fails(checkoutApi.quote(many))).fieldErrors).toEqual({ stays: 'TOO_MANY' });
    expect((await fails(checkoutApi.quote([stay('ghost')]))).code).toBe('PROPERTY_NOT_FOUND');
  });

  it('books as a guest and returns the same order for a repeated idempotency key', async () => {
    const { quote, res, key } = await pay([stay('jazeera')], {
      method: 'waafipay',
      brand: 'EVC Plus',
      payPhone: '61 555 0142',
    });
    expect(res.status).toBe('confirmed');
    expect(res.bookings).toHaveLength(1);
    expect(res.bookings[0]!.ref).toMatch(/^AV-[A-HJ-NP-Z2-9]{6}$/);
    expect(res.bookings[0]!.orderId).toBe(res.id);
    expect(res.bookings[0]!.status).toBe('confirmed');
    expect(res.paymentToken).toBeTruthy();
    expect(res.total.amount).toBe(quote.total.amount);
    const again = await checkoutApi.createOrder(
      { quoteId: quote.quoteId, guest, payment: { method: 'waafipay', brand: 'EVC Plus', payPhone: '61 555 0142' } },
      key,
    );
    expect(again.id).toBe(res.id);
    expect(again.bookings[0]!.ref).toBe(res.bookings[0]!.ref);
  });

  it('pays for two hotels at once: one payment, one booking each, each its own price', async () => {
    const { quote, res } = await pay(
      [
        stay('jazeera'),
        stay('lido', { checkIn: '2026-10-20', checkOut: '2026-10-23', selection: [{ roomTypeId: 'suite', qty: 1 }] }),
      ],
      { method: 'waafipay', brand: 'EVC Plus', payPhone: '61 555 0142' },
    );
    expect(res.status).toBe('confirmed');
    expect(res.bookings.map((b) => b.property.id)).toEqual(['jazeera', 'lido']);
    expect(new Set(res.bookings.map((b) => b.orderId))).toEqual(new Set([res.id]));
    expect(new Set(res.bookings.map((b) => b.ref)).size).toBe(2);
    expect(res.bookings.map((b) => b.quote.total.amount)).toEqual(quote.stays.map((s) => s.total.amount));
    expect(res.bookings.reduce((n, b) => n + b.quote.total.amount, 0)).toBe(res.total.amount);
    expect(res.bookings.map((b) => b.trip.checkIn)).toEqual(['2026-10-15', '2026-10-20']);
    expect(res.bookings.every((b) => b.payment.brand === 'EVC Plus' && !!b.payment.paidAt)).toBe(true);
  });

  it('never pays a quote twice: another key, another tap, another tab', async () => {
    const { quote, res } = await pay(
      [stay('jazeera'), stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] })],
      WALLET,
    );
    const e = await fails(checkoutApi.createOrder({ quoteId: quote.quoteId, guest, payment: WALLET }, 'another-key'));
    expect([e.status, e.code]).toEqual([409, 'QUOTE_USED']);
    expect((e.body as { orderId: string }).orderId).toBe(res.id);
    expect(db().orders).toHaveLength(1);
    expect(db().bookings).toHaveLength(2);
  });

  it('does not let a key be reused for a different checkout', async () => {
    const { key } = await pay([stay('jazeera')], WALLET);
    const other = await checkoutApi.quote([stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] })]);
    const e = await fails(checkoutApi.createOrder({ quoteId: other.quoteId, guest, payment: WALLET }, key));
    expect(e.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('checks every stay again before charging, and charges nothing if one is gone', async () => {
    const quote = await checkoutApi.quote([
      stay('jazeera'),
      stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] }),
    ]);
    // The server's copy of what the second stay needs now asks for more than is left (stock moved since the quote).
    db().quotes[quote.quoteId]!.stays[1]!.selection[0]!.qty = 99;
    const e = await fails(checkoutApi.createOrder({ quoteId: quote.quoteId, guest, payment: WALLET }, 'k-gone'));
    expect([e.status, e.code]).toEqual([409, 'ROOM_UNAVAILABLE']);
    expect((e.body as { stays: number[] }).stays).toEqual([1]);
    expect(db().orders).toHaveLength(0);
    expect(db().bookings).toHaveLength(0);
  });

  it('ignores anything in the request but the quote: prices and stays come from the server', async () => {
    const quote = await checkoutApi.quote([stay('jazeera')]);
    const res = await checkoutApi.createOrder(
      {
        quoteId: quote.quoteId,
        guest,
        payment: WALLET,
        stays: [stay('lido')],
        total: { amount: 1, currency: 'USD' },
      } as never,
      'k-tamper',
    );
    expect(res.bookings.map((b) => b.property.id)).toEqual(['jazeera']);
    expect(res.total.amount).toBe(quote.total.amount);
  });

  it('validates guest and payment fields', async () => {
    const quote = await checkoutApi.quote([stay('jazeera')]);
    const e = await fails(
      checkoutApi.createOrder(
        {
          quoteId: quote.quoteId,
          guest: { name: 'A', phone: '1', email: 'x' },
          payment: { method: 'card', cardToken: 'raw 4242424242424242' },
        },
        'k1',
      ),
    );
    expect(e.status).toBe(422);
    expect(Object.keys(e.fieldErrors).sort()).toEqual([
      'guest.email',
      'guest.name',
      'guest.phone',
      'payment.cardToken',
    ]);
  });

  it('declines, and reprices every stay once on the price-change test number', async () => {
    const declined = await fails(
      pay([stay('jazeera')], { method: 'waafipay', brand: 'EVC Plus', payPhone: '61 555 0199' }).then((r) => r.res),
    );
    expect([declined.status, declined.code]).toEqual([402, 'PAYMENT_DECLINED']);
    expect(db().orders).toHaveLength(0); // a declined payment books nothing

    const quote = await checkoutApi.quote([
      stay('jazeera'),
      stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] }),
    ]);
    const card = { method: 'waafipay' as const, brand: 'EVC Plus', payPhone: '61 555 0196' };
    const changed = await fails(checkoutApi.createOrder({ quoteId: quote.quoteId, guest, payment: card }, 'k-a'));
    expect(changed.code).toBe('PRICE_CHANGED');
    const next = (changed.body as { newQuote: Quote }).newQuote;
    expect(next.total.amount).toBeGreaterThan(quote.total.amount);
    expect(next.stays.every((s, i) => s.total.amount > quote.stays[i]!.total.amount)).toBe(true);
    const ok = await checkoutApi.createOrder({ quoteId: next.quoteId, guest, payment: card }, 'k-b');
    expect(ok.status).toBe('confirmed');
    expect(ok.total.amount).toBe(next.total.amount);
  });

  it('keeps a mobile-money prompt pending for the whole order, then confirms it; resend is rate limited', async () => {
    const { res } = await pay([stay('jazeera'), stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] })], {
      method: 'waafipay',
      brand: 'EVC Plus',
      payPhone: '61 555 0197',
    });
    expect(res.status).toBe('pending_payment');
    expect(res.bookings.map((b) => b.status)).toEqual(['pending_payment', 'pending_payment']);
    expect(res.paymentPrompt?.expiresAt).toBeTruthy();
    expect((await checkoutApi.paymentStatus(res.id, res.paymentToken)).status).toBe('pending_payment');
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0, 10));
    expect((await checkoutApi.paymentStatus(res.id, res.paymentToken)).status).toBe('confirmed');
    expect((await fails(checkoutApi.order(res.id))).status).toBe(404); // guests have no lookup
    await fails(checkoutApi.resendPrompt(res.id, res.paymentToken)); // already paid: nothing to resend
  });

  it('rate limits resending a prompt', async () => {
    const { res } = await pay([stay('jazeera')], { method: 'waafipay', brand: 'EVC Plus', payPhone: '61 555 0198' });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 2, 0));
    await checkoutApi.resendPrompt(res.id, res.paymentToken);
    expect((await fails(checkoutApi.resendPrompt(res.id, res.paymentToken))).code).toBe('RATE_LIMITED');
  });

  it('times out an unanswered prompt, fails every booking, and a resend recovers it', async () => {
    const { res } = await pay([stay('jazeera'), stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] })], {
      method: 'waafipay',
      brand: 'EVC Plus',
      payPhone: '61 555 0198',
    });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 2, 0));
    const s = await checkoutApi.paymentStatus(res.id, res.paymentToken);
    expect([s.status, s.reason]).toEqual(['payment_failed', 'TIMEOUT']);
    expect(db().bookings.map((b) => b.status)).toEqual(['payment_failed', 'payment_failed']);
    await checkoutApi.resendPrompt(res.id, res.paymentToken);
    vi.setSystemTime(new Date(2026, 9, 12, 15, 2, 10));
    expect((await checkoutApi.paymentStatus(res.id, res.paymentToken)).status).toBe('confirmed');
    expect(db().bookings.map((b) => b.status)).toEqual(['confirmed', 'confirmed']);
  });

  it('lets the same quote be paid again once its payment failed, and not before', async () => {
    const quote = await checkoutApi.quote([stay('jazeera')]);
    const wallet = { method: 'waafipay' as const, brand: 'EVC Plus', payPhone: '61 555 0198' };
    const first = await checkoutApi.createOrder({ quoteId: quote.quoteId, guest, payment: wallet }, 'k-1');
    expect((await fails(checkoutApi.createOrder({ quoteId: quote.quoteId, guest, payment: WALLET }, 'k-2'))).code).toBe(
      'QUOTE_USED',
    ); // still waiting for approval
    vi.setSystemTime(new Date(2026, 9, 12, 15, 2, 0));
    await checkoutApi.paymentStatus(first.id, first.paymentToken); // settles to payment_failed
    const second = await checkoutApi.createOrder({ quoteId: quote.quoteId, guest, payment: WALLET }, 'k-3');
    expect(second.status).toBe('confirmed');
    expect(second.id).not.toBe(first.id);
  });

  it('refunds just the booking a property refuses, and says so: partly confirmed', async () => {
    const { res } = await pay([stay('jazeera'), stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] })], {
      method: 'waafipay',
      brand: 'EVC Plus',
      payPhone: '61 555 0195',
    });
    expect(res.status).toBe('partially_confirmed');
    expect(res.bookings.map((b) => b.status)).toEqual(['confirmed', 'failed']);
    expect(res.bookings[0]!.refundedAt).toBeUndefined();
    expect(res.bookings[1]!.refundedAt).toBeTruthy();
    expect(res.refunded?.amount).toBe(res.bookings[1]!.quote.total.amount);
    expect(res.total.amount).toBe(res.bookings[0]!.quote.total.amount + res.bookings[1]!.quote.total.amount);
  });

  it('refunds everything when no property confirms: failed, never confirmed', async () => {
    const { res } = await pay([stay('jazeera')], { method: 'waafipay', brand: 'EVC Plus', payPhone: '61 555 0195' });
    expect(res.status).toBe('failed');
    expect(res.bookings[0]!.status).toBe('failed');
    expect(res.refunded?.amount).toBe(res.total.amount);
  });

  it('confirms nothing before the payment is approved', async () => {
    const { res } = await pay([stay('jazeera')], { method: 'waafipay', brand: 'EVC Plus', payPhone: '61 555 0197' });
    expect(res.bookings[0]!.status).toBe('pending_payment');
    expect(res.bookings[0]!.payment.paidAt).toBeUndefined();
  });

  it('refuses payment polling without the payment token', async () => {
    const { res } = await pay([stay('jazeera')], { method: 'waafipay', brand: 'EVC Plus', payPhone: '61 555 0197' });
    expect((await fails(checkoutApi.paymentStatus(res.id))).status).toBe(404);
    expect((await fails(checkoutApi.paymentStatus(res.id, 'pt_wrong'))).status).toBe(404);
  });

  it('only lets the owner open an order or a booking (members); guests have no lookup', async () => {
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    const { res } = await pay([stay('jazeera'), stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] })], {
      method: 'card',
      cardToken: makeCardToken('Visa', '4242', 12, 2030).token,
    });
    expect(res.accountId).toBeTruthy();
    const refs = res.bookings.map((b) => b.ref);
    expect((await checkoutApi.order(res.id)).bookings.map((b) => b.ref)).toEqual(refs);
    expect((await checkoutApi.booking(refs[0]!)).orderId).toBe(res.id);
    expect((await accountApi.bookings()).upcoming.map((b) => b.ref).sort()).toEqual([...refs].sort());

    await accountApi.logout();
    expect((await fails(checkoutApi.booking(refs[0]!))).status).toBe(401);
    expect((await fails(checkoutApi.order(res.id))).status).toBe(404);

    await accountApi.register({
      ...profile,
      firstName: 'Other',
      email: 'other@example.com',
      password: 'another good phrase',
    });
    expect((await fails(checkoutApi.booking(refs[0]!))).status).toBe(404);
    expect((await fails(checkoutApi.order(res.id))).status).toBe(404);
  });

  it('saves a new payment method after a successful order, without ever failing the order', async () => {
    await accountApi.register({ ...profile, password: 'purple tractor lamp' });
    const quote = await checkoutApi.quote([stay('jazeera')]);
    await checkoutApi.createOrder(
      {
        quoteId: quote.quoteId,
        guest,
        saveMethod: true,
        payment: { method: 'waafipay', brand: 'ZAAD', payPhone: '61 555 0150' },
      },
      'k-save',
    );
    expect((await accountApi.methods()).items.map((m) => m.brand)).toEqual(['ZAAD']);
  });
});

describe('basket', () => {
  const basket = (...stays: BasketStay[]): Basket => ({ stays, updatedAt: new Date().toISOString() });
  const signUp = () => accountApi.register({ ...profile, password: 'purple tractor lamp' });

  it('belongs to the signed-in account only', async () => {
    expect((await fails(accountApi.basket())).status).toBe(401);
    expect((await fails(accountApi.putBasket(basket(bstay())))).status).toBe(401);
    await signUp();
    expect((await accountApi.basket()).basket).toBeNull();
    await accountApi.putBasket(basket(bstay({ lines: [{ roomTypeId: 'suite', qty: 2 }] })));
    expect((await accountApi.basket()).basket?.stays[0]?.lines).toEqual([{ roomTypeId: 'suite', qty: 2 }]);
    await accountApi.clearBasket();
    expect((await accountApi.basket()).basket).toBeNull();
  });

  it('takes the property type and timestamps from the server and sums repeated lines', async () => {
    await signUp();
    const { basket: b } = await accountApi.putBasket(
      basket(
        bstay({
          type: 'hall',
          updatedAt: '2099-01-01T00:00:00.000Z',
          lines: [
            { roomTypeId: 'double', qty: 1 },
            { roomTypeId: 'double', qty: 2 },
          ],
        }),
      ),
    );
    expect(b?.stays[0]?.type).toBe('hotel');
    expect(b?.stays[0]?.updatedAt).toBe(new Date().toISOString());
    expect(b?.updatedAt).toBe(new Date().toISOString());
    expect(b?.stays[0]?.lines).toEqual([{ roomTypeId: 'double', qty: 3 }]);
  });

  it('holds rooms at several hotels, and the same hotel on different dates', async () => {
    await signUp();
    const { basket: b } = await accountApi.putBasket(
      basket(
        bstay(),
        bstay({ propertyId: 'lido', lines: [{ roomTypeId: 'suite', qty: 1 }] }),
        bstay({ checkIn: '2026-10-20', checkOut: '2026-10-22' }),
      ),
    );
    expect(b?.stays.map((s) => `${s.propertyId} ${s.checkIn}`)).toEqual([
      'jazeera 2026-10-15',
      'lido 2026-10-15',
      'jazeera 2026-10-20',
    ]);
  });

  it('refuses unknown properties and rooms, past dates and impossible parties, naming the stay', async () => {
    await signUp();
    const bad = async (...stays: BasketStay[]) => await fails(accountApi.putBasket(basket(...stays)));
    expect((await bad(bstay(), bstay({ propertyId: 'ghost' }))).code).toBe('PROPERTY_NOT_FOUND');
    expect((await bad(bstay({ checkIn: '2026-10-01' }))).code).toBe('DATE_IN_PAST');
    expect((await bad(bstay(), bstay({ propertyId: 'lido', checkOut: trip.checkIn }))).fieldErrors).toEqual({
      'stays.1.checkOut': 'CHECKOUT_BEFORE_CHECKIN',
    });
    expect((await bad(bstay({ checkOut: '2026-12-31' }))).fieldErrors).toEqual({ 'stays.0.checkOut': 'STAY_TOO_LONG' });
    expect((await bad(bstay({ lines: [{ roomTypeId: 'penthouse', qty: 1 }] }))).fieldErrors).toEqual({
      'stays.0.lines': 'INVALID_LINE',
    });
    expect((await bad(bstay({ guests: 40 }))).fieldErrors).toEqual({ 'stays.0.guests': 'OUT_OF_RANGE' });
  });

  it('refuses a stay sent twice, an empty basket and too many stays', async () => {
    await signUp();
    expect((await fails(accountApi.putBasket(basket(bstay(), bstay())))).fieldErrors).toEqual({
      'stays.1': 'DUPLICATE_STAY',
    });
    expect((await fails(accountApi.putBasket(basket()))).fieldErrors).toEqual({ stays: 'REQUIRED' });
    const many = Array.from({ length: 11 }, (_, i) =>
      bstay({
        checkIn: `2026-11-${String(i + 1).padStart(2, '0')}`,
        checkOut: `2026-11-${String(i + 2).padStart(2, '0')}`,
      }),
    );
    expect((await fails(accountApi.putBasket(basket(...many)))).fieldErrors).toEqual({ stays: 'TOO_MANY' });
  });

  it('keeps one hall for one day', async () => {
    await signUp();
    const hall = { propertyId: 'alnuur', type: 'hall' as const, guests: 200 };
    const { basket: b } = await accountApi.putBasket(
      basket(bstay({ ...hall, lines: [{ roomTypeId: 'main', qty: 1 }] })),
    );
    expect(b?.stays[0]?.checkOut).toBe('2026-10-16');
    expect(
      await fails(accountApi.putBasket(basket(bstay({ ...hall, lines: [{ roomTypeId: 'main', qty: 2 }] })))),
    ).toMatchObject({
      fieldErrors: { 'stays.0.lines': 'ONE_HALL' },
    });
  });

  it('on merge combines the two baskets stay by stay, the copy changed last winning a shared stay', async () => {
    await signUp();
    await accountApi.putBasket(
      basket(
        bstay({ propertyId: 'lido', lines: [{ roomTypeId: 'suite', qty: 1 }] }),
        bstay({ updatedAt: '2026-10-12T14:00:00.000Z', lines: [{ roomTypeId: 'double', qty: 1 }] }),
      ),
    );
    // Stamps sent by the client are capped at "now" and kept, so two copies of one stay can be told apart.
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0));
    await accountApi.putBasket(
      basket(bstay({ updatedAt: '2026-10-12T09:00:00.000Z', lines: [{ roomTypeId: 'double', qty: 1 }] })),
    );
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
    const device = basket(
      bstay({ updatedAt: '2026-10-12T16:00:00.000Z', lines: [{ roomTypeId: 'double', qty: 2 }] }),
      bstay({ propertyId: 'ambassador', lines: [{ roomTypeId: 'double', qty: 1 }] }),
    );
    const { basket: merged } = await accountApi.putBasket(device, true);
    const by = (id: string) => merged?.stays.find((s) => s.propertyId === id);
    expect(merged?.stays).toHaveLength(2);
    expect(by('jazeera')).toBeDefined();
    expect(by('ambassador')).toBeDefined();
  });

  it('removes only the stays that were booked', async () => {
    await signUp();
    await accountApi.putBasket(
      basket(
        bstay(),
        bstay({ propertyId: 'lido', lines: [{ roomTypeId: 'suite', qty: 1 }] }),
        bstay({ checkIn: '2026-10-20', checkOut: '2026-10-22' }),
      ),
    );
    await pay([stay('jazeera'), stay('lido', { selection: [{ roomTypeId: 'suite', qty: 1 }] })], WALLET);
    const left = (await accountApi.basket()).basket;
    expect(left?.stays.map((s) => `${s.propertyId} ${s.checkIn}`)).toEqual(['jazeera 2026-10-20']);
    await pay([stay('jazeera', { checkIn: '2026-10-20', checkOut: '2026-10-22' })], WALLET);
    expect((await accountApi.basket()).basket).toBeNull();
  });

  it('keeps the stays while a wallet payment waits, and drops them only once it is approved', async () => {
    await signUp();
    await accountApi.putBasket(basket(bstay()));
    const { res } = await pay([stay('jazeera')], { ...WALLET, payPhone: '61 555 0197' });
    expect((await accountApi.basket()).basket?.stays).toHaveLength(1);
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0, 10));
    expect((await checkoutApi.paymentStatus(res.id)).status).toBe('confirmed');
    expect((await accountApi.basket()).basket).toBeNull();
  });

  it('keeps the stays when a wallet payment is never approved', async () => {
    await signUp();
    await accountApi.putBasket(basket(bstay()));
    const { res } = await pay([stay('jazeera')], { ...WALLET, payPhone: '61 555 0198' });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 2, 0));
    expect((await checkoutApi.paymentStatus(res.id)).status).toBe('payment_failed');
    expect((await accountApi.basket()).basket?.stays).toHaveLength(1);
  });
});
