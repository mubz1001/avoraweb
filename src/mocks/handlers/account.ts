import { http, HttpResponse } from 'msw';
import {
  currentUser,
  endSession,
  findByEmail,
  LOCK_MS,
  MAX_FAILS,
  methodExpired,
  newUser,
  putUser,
  pwCheck,
  pwHash,
  startSession,
  toMember,
  toMethod,
} from '../auth';
import { checkBasket, mergeBaskets } from '../basket';
import { getProperty } from '../catalog';
import { db, newRef, rid, save, type BookingRec, type OrderRec, type UserRec } from '../db';
import { fail, readJson, str, wait } from '../http';
import { publicBooking, settleOrdersOf } from './checkout';
import { quoteStay } from '../quote';
import { addDays, parseDate, today } from '@/lib/dates';
import { config } from '@/lib/config';
import { DEMO_ACCOUNTS } from '@/lib/demoAccounts';
import { phoneDigits, phoneOk, toE164 } from '@/lib/phone';
import { readCardToken } from '@/lib/payments/mockToken';
import { emailMsg, nameMsg, normEmail, pwMsg, REVIEW_TEXT } from '@/lib/validation/rules';
import type { Booking } from '@/types';

const base = config.apiBase;
const noContent = () => new HttpResponse(null, { status: 204 });
const unauthorized = () => fail(401, 'UNAUTHORIZED', 'Your session has ended. Sign in again.');
const invalid = (fieldErrors: Record<string, string>) =>
  fail(422, 'VALIDATION_FAILED', 'Some fields need attention.', { fieldErrors });

/** Field-level checks shared by register, complete and PATCH /me. Returns error codes per field. */
function checkProfile(b: Record<string, unknown>, only?: string[]) {
  const e: Record<string, string> = {};
  const want = (k: string) => !only || only.includes(k);
  if (want('firstName') && nameMsg(str(b.firstName), 'first name')) e.firstName = 'INVALID_NAME';
  if (want('lastName') && nameMsg(str(b.lastName), 'last name')) e.lastName = 'INVALID_NAME';
  if (want('email') && emailMsg(str(b.email))) e.email = 'INVALID_EMAIL';
  if (want('phone') && !phoneOk(str(b.phone))) e.phone = 'INVALID_PHONE';
  return e;
}

const pwCode = (pw: string, email?: string) =>
  pwMsg(pw, email) ? (pw.length < 8 ? 'TOO_SHORT' : 'WEAK_PASSWORD') : '';

/** Signing in on the real API sets an HttpOnly cookie; the mock keeps one server-side session (single client). */
const signedIn = (u: UserRec, status = 200) => HttpResponse.json({ member: toMember(u) }, { status });

function requireUser() {
  const u = currentUser();
  return u ?? null;
}

/** The developer demo members (mock only; `lib/demoAccounts`): Amina Hassan signs in with email and password, Omar Yusuf
 *  with Google or Apple. Each has saved methods, favourites and bookings around today. They are created on first sign-in
 *  and their seeded bookings are refreshed at every sign-in so the dates stay relative to now; anything else a visitor
 *  added is kept. */
/** A demo member saved by an older version of the mock may lack its password or providers: repair it. */
async function repairDemo(u: UserRec) {
  if (u.email === DEMO_ACCOUNTS.social.email) u.providers = ['google', 'apple'];
  else if (u.email === DEMO_ACCOUNTS.email.email && !u.pwd) u.pwd = await pwHash(DEMO_ACCOUNTS.email.password);
}

async function seedDemo(email: string): Promise<UserRec | null> {
  const social = email === DEMO_ACCOUNTS.social.email;
  if (!social && email !== DEMO_ACCOUNTS.email.email) return null;
  let u = findByEmail(email);
  const now = today();
  if (!u) {
    const mk = (m: object) =>
      ({ id: rid('pm'), token: rid('tok'), createdAt: new Date().toISOString(), ...m }) as UserRec['methods'][number];
    const evc = mk({ kind: 'waafipay', brand: 'EVC Plus', phone: '+252615550100' });
    const visa = mk({
      kind: 'card',
      brand: 'Visa',
      last4: '4242',
      expMonth: now.getMonth() + 1,
      expYear: now.getFullYear() + 2,
    });
    const old = mk({
      kind: 'card',
      brand: 'Mastercard',
      last4: '4444',
      expMonth: now.getMonth() || 12,
      expYear: now.getMonth() ? now.getFullYear() : now.getFullYear() - 1,
    });
    u = social
      ? newUser(
          { firstName: 'Omar', lastName: 'Yusuf', email, phone: '+252615550101' },
          {
            methods: [evc, visa],
            defaultMethodId: evc.id,
            favourites: ['karkaar'],
            providers: ['google', 'apple'],
            demo: true,
          },
        )
      : newUser(
          { firstName: 'Amina', lastName: 'Hassan', email, phone: '+252615550100' },
          {
            methods: [evc, visa, old],
            defaultMethodId: evc.id,
            favourites: ['lido', 'karkaar'],
            pwd: await pwHash(DEMO_ACCOUNTS.email.password),
            demo: true,
          },
        );
  }
  await repairDemo(u);
  putUser(u);
  const own = db().bookings.filter((b) => !(b.demo && b.accountId === u!.id));
  const orders: OrderRec[] = [];
  const make = (
    propertyId: string,
    startOffset: number,
    nights: number,
    roomTypeId: string,
    qty: number,
    guests: number,
  ): BookingRec => {
    const prop = getProperty(propertyId)!;
    const checkIn = addDays(now, startOffset);
    const quoteIn = startOffset < 0 ? addDays(now, 1) : checkIn; // the quote builder refuses past dates; the booking is dated back below
    const r = quoteStay({
      propertyId,
      checkIn: quoteIn,
      checkOut: addDays(quoteIn, nights),
      guests,
      selection: [{ roomTypeId, qty }],
    });
    if (!r.ok) throw new Error('demo seed failed: ' + r.code);
    const method = u!.methods[0]!;
    const orderId = rid('ord');
    const payment = {
      method: method.kind,
      brand: method.brand,
      payPhoneMasked: '+252 61 *** 0100',
      paidAt: new Date().toISOString(),
    };
    const ref = newRef();
    orders.push({
      id: orderId,
      quoteId: rid('q'),
      status: 'confirmed',
      total: r.stay.total,
      payment,
      bookingRefs: [ref],
      accountId: u!.id,
      createdAt: new Date().toISOString(),
      demo: true,
    });
    return {
      ref,
      orderId,
      status: 'confirmed',
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
      trip: { ...r.trip, checkIn, checkOut: addDays(checkIn, nights) },
      quote: { ...r.stay, checkIn, checkOut: addDays(checkIn, nights) },
      guest: { name: `${u!.firstName} ${u!.lastName}`, phone: u!.phone, email: u!.email },
      payment,
      accountId: u!.id,
      createdAt: new Date().toISOString(),
      demo: true,
    };
  };
  db().bookings = [
    make('jazeera', 3, 2, 'double', 1, 2),
    make('ambassador', 20, 3, 'double', 2, 4),
    make('nugaal', -12, 2, 'double', 1, 2),
  ].concat(own);
  db().orders = orders.concat(db().orders.filter((o) => !(o.demo && o.accountId === u!.id)));
  save();
  return u;
}

export const accountHandlers = [
  http.post(`${base}/auth/register`, async ({ request }) => {
    const b = await readJson(request);
    const e = checkProfile(b);
    const code = pwCode(str(b.password), str(b.email));
    if (code) e.password = code;
    if (Object.keys(e).length) return invalid(e);
    const pwd = await pwHash(str(b.password));
    if (findByEmail(normEmail(str(b.email))))
      return fail(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    const u = newUser(
      { firstName: str(b.firstName), lastName: str(b.lastName), email: str(b.email), phone: toE164(str(b.phone)) },
      { pwd },
    );
    putUser(u);
    startSession(u);
    return signedIn(u, 201);
  }),

  http.post(`${base}/auth/login`, async ({ request }) => {
    const b = await readJson(request);
    const email = normEmail(str(b.email));
    if (config.features.demo) await seedDemo(email);
    const now = Date.now();
    const fails = db().fails;
    for (const k of Object.keys(fails)) if (fails[k]!.until && fails[k]!.until <= now) delete fails[k];
    if (fails[email]?.until)
      return fail(429, 'RATE_LIMITED', 'Too many attempts.', {
        headers: { 'Retry-After': String(Math.ceil((fails[email]!.until - now) / 1000)) },
      });
    const u = findByEmail(email);
    if (!(await pwCheck(str(b.password), u?.pwd))) {
      const n = (fails[email]?.n ?? 0) + 1;
      fails[email] = { n, until: n >= MAX_FAILS ? now + LOCK_MS : 0 };
      save();
      return n >= MAX_FAILS
        ? fail(429, 'RATE_LIMITED', 'Too many attempts.', { headers: { 'Retry-After': String(LOCK_MS / 1000) } })
        : fail(
            401,
            'BAD_CREDENTIALS',
            'That email and password don’t match. Check them and try again, or reset your password.',
          );
    }
    delete fails[email];
    startSession(u!);
    return signedIn(u!);
  }),

  http.post(`${base}/auth/oauth/complete`, async ({ request }) => {
    await wait(300);
    const b = await readJson(request);
    const p = db().pending[str(b.pendingToken)];
    if (!p || p.exp < Date.now())
      return fail(410, 'SESSION_EXPIRED', 'That sign-up took too long. Please start again.');
    const e = checkProfile(b, ['firstName', 'lastName', 'phone']);
    if (Object.keys(e).length) return invalid(e);
    if (findByEmail(p.email)) return fail(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    const u = newUser(
      { firstName: str(b.firstName), lastName: str(b.lastName), email: p.email, phone: toE164(str(b.phone)) },
      { providers: [p.provider] },
    );
    delete db().pending[str(b.pendingToken)];
    putUser(u);
    startSession(u);
    return signedIn(u, 201);
  }),

  /** Mock provider: the authorization `code` is simply the Google/Apple account email. */
  http.post(`${base}/auth/oauth/:provider`, async ({ params, request }) => {
    const provider = String(params.provider);
    if (provider !== 'google' && provider !== 'apple') return fail(404, 'NOT_FOUND', 'Unknown provider.');
    await wait(500);
    const email = normEmail(str((await readJson(request)).code));
    if (emailMsg(email)) return fail(401, 'INVALID_ID_TOKEN', 'We couldn’t verify that account.');
    if (config.features.demo) await seedDemo(email);
    const u = findByEmail(email);
    if (u) {
      if (!u.providers.includes(provider)) u.providers.push(provider);
      putUser(u);
      startSession(u);
      return signedIn(u);
    }
    const pendingToken = rid('pend');
    db().pending[pendingToken] = { provider, email, exp: Date.now() + 15 * 60e3 };
    save();
    return HttpResponse.json({ pendingToken, email }, { status: 202 });
  }),

  /** Same answer for every email: never reveals who has an account. A known email gets a 30-minute single-use link,
   *  which a real server emails; the mock prints it to the console instead. */
  http.post(`${base}/auth/password-reset`, async ({ request }) => {
    await wait(600);
    const email = normEmail(str((await readJson(request)).email));
    if (findByEmail(email)) {
      const token = rid('rst');
      db().resets[token] = { email, exp: Date.now() + 30 * 60e3 };
      save();
      if (import.meta.env.MODE !== 'test') console.info(`[mock email] reset link: /reset-password?token=${token}`);
    }
    return noContent();
  }),
  /** A link works once: unknown, used and expired all answer the same. Success ends every session. */
  http.post(`${base}/auth/password-reset/confirm`, async ({ request }) => {
    const b = await readJson(request);
    const token = str(b.token);
    const rec = db().resets[token];
    const u = rec && rec.exp > Date.now() ? findByEmail(rec.email) : undefined;
    if (!rec || !u) return fail(410, 'TOKEN_EXPIRED', 'This reset link has expired.');
    const code = pwCode(str(b.password), u.email);
    if (code) return invalid({ password: code });
    u.pwd = await pwHash(str(b.password));
    putUser(u);
    delete db().resets[token];
    delete db().fails[u.email];
    if (db().session?.uid === u.id) db().session = null;
    save();
    return noContent();
  }),

  http.post(`${base}/auth/logout`, () => {
    endSession();
    return noContent();
  }),

  http.get(`${base}/me`, async () => {
    const u = requireUser();
    // A session restored from an older mock database never passes through sign-in, so repair the demo members here too.
    if (u && config.features.demo) {
      await repairDemo(u);
      putUser(u);
    }
    return u ? HttpResponse.json({ member: toMember(u) }) : unauthorized();
  }),

  http.patch(`${base}/me`, async ({ request }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    const b = await readJson(request);
    const e = checkProfile(b, ['firstName', 'lastName', 'email', 'phone']);
    if (Object.keys(e).length) return invalid(e);
    const email = normEmail(str(b.email));
    if (email !== u.email) {
      if (db().users.some((x) => x.email === email && x.id !== u.id))
        return fail(409, 'EMAIL_TAKEN', 'Another account already uses this email.');
      if (u.pwd && !(await pwCheck(str(b.currentPassword), u.pwd)))
        return fail(401, 'BAD_PASSWORD', 'That password is incorrect.');
    } else await wait(300);
    Object.assign(u, {
      firstName: str(b.firstName).trim(),
      lastName: str(b.lastName).trim(),
      email,
      phone: toE164(str(b.phone)),
    });
    putUser(u);
    return HttpResponse.json({ member: toMember(u) });
  }),

  http.put(`${base}/me/password`, async ({ request }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    const b = await readJson(request);
    const code = pwCode(str(b.newPassword), u.email);
    if (code) return invalid({ newPassword: code });
    if (u.pwd && !(await pwCheck(str(b.currentPassword), u.pwd)))
      return fail(401, 'BAD_PASSWORD', 'That password is incorrect.');
    u.pwd = await pwHash(str(b.newPassword));
    putUser(u);
    return noContent();
  }),

  http.delete(`${base}/me`, async ({ request }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    const b = await readJson(request);
    if (u.pwd && !(await pwCheck(str(b.currentPassword), u.pwd)))
      return fail(401, 'BAD_PASSWORD', 'That password is incorrect.');
    db().users = db().users.filter((x) => x.id !== u.id);
    db().bookings = db().bookings.filter((x) => x.accountId !== u.id); // production keeps them detached for accounting
    db().orders = db().orders.filter((x) => x.accountId !== u.id);
    endSession();
    return noContent();
  }),

  /** One review per booking, from its owner, once the stay is over (docs/06 §5b). A repeated Idempotency-Key replays
   *  the first 201, so a retry after a lost answer is never a 409. Stored on the booking; nothing is moderated here. */
  http.post(`${base}/bookings/:ref/review`, async ({ params, request }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    const ref = String(params.ref).toUpperCase();
    settleOrdersOf([ref]);
    const rec = db().bookings.find((b) => b.ref === ref && b.accountId === u.id);
    if (!rec) return fail(404, 'BOOKING_NOT_FOUND', 'No booking found.');
    if (rec.status !== 'confirmed' || parseDate(rec.trip.checkOut) >= today())
      return fail(403, 'NOT_ELIGIBLE', 'This stay can’t be reviewed yet.');
    const key = `review:${ref}:${request.headers.get('idempotency-key') ?? ''}`;
    if (db().idempotency[key]) return new HttpResponse(null, { status: 201 });
    if (rec.review) return fail(409, 'ALREADY_REVIEWED', 'You’ve already reviewed this stay.');
    const b = await readJson(request);
    const e: Record<string, string> = {};
    const score = Number(b.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) e.score = 'REQUIRED';
    const n = str(b.text).trim().length;
    if (!n) e.text = 'REQUIRED';
    else if (n < REVIEW_TEXT.min) e.text = 'TOO_SHORT';
    else if (n > REVIEW_TEXT.max) e.text = 'TOO_LONG';
    if (Object.keys(e).length) return invalid(e);
    rec.review = { score, postedAt: new Date().toISOString() };
    db().idempotency[key] = { status: 201, body: null };
    save();
    return new HttpResponse(null, { status: 201 });
  }),

  http.get(`${base}/me/bookings`, () => {
    const u = requireUser();
    if (!u) return unauthorized();
    settleOrdersOf(
      db()
        .bookings.filter((b) => b.accountId === u.id)
        .map((b) => b.ref),
    );
    const mine = db()
      .bookings.filter((b) => b.accountId === u.id && getProperty(b.property.id))
      .map(publicBooking);
    const t = today();
    const up = (b: Booking) => parseDate(b.trip.checkOut) >= t;
    return HttpResponse.json({
      upcoming: mine.filter(up).sort((a, b) => (a.trip.checkIn < b.trip.checkIn ? -1 : 1)),
      past: mine.filter((b) => !up(b)),
    });
  }),

  http.get(`${base}/me/favourites`, () => {
    const u = requireUser();
    return u ? HttpResponse.json({ propertyIds: u.favourites }) : unauthorized();
  }),

  http.put(`${base}/me/favourites`, async ({ request }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    const b = await readJson(request);
    const ids = (Array.isArray(b.propertyIds) ? b.propertyIds : []).filter(
      (x): x is string => typeof x === 'string' && !!getProperty(x),
    );
    u.favourites = [...new Set(ids)];
    putUser(u);
    return HttpResponse.json({ propertyIds: u.favourites });
  }),

  http.get(`${base}/me/basket`, () => {
    const u = requireUser();
    return u ? HttpResponse.json({ basket: u.basket ?? null }) : unauthorized();
  }),

  http.put(`${base}/me/basket`, async ({ request }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    const b = await readJson(request);
    const r = checkBasket(b.basket);
    if (!r.ok) return fail(r.status, r.code, r.message, r.fieldErrors ? { fieldErrors: r.fieldErrors } : {});
    // Merge (sign-in): combined stay by stay. Otherwise the client's basket replaces the account's.
    u.basket = b.merge === true ? mergeBaskets(u.basket, r.basket) : r.basket;
    putUser(u);
    return HttpResponse.json({ basket: u.basket });
  }),

  http.delete(`${base}/me/basket`, () => {
    const u = requireUser();
    if (!u) return unauthorized();
    u.basket = null;
    putUser(u);
    return noContent();
  }),

  http.get(`${base}/me/payment-methods`, () => {
    const u = requireUser();
    if (!u) return unauthorized();
    return HttpResponse.json({
      items: u.methods.map(toMethod),
      ...(u.defaultMethodId ? { defaultId: u.defaultMethodId } : {}),
    });
  }),

  http.post(`${base}/me/payment-methods`, async ({ request }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    await wait(400);
    const b = await readJson(request);
    const kind = str(b.kind);
    let entry: UserRec['methods'][number];
    const common = { id: rid('pm'), token: rid('tok'), createdAt: new Date().toISOString() };
    if (kind === 'card') {
      const c = readCardToken(str(b.providerToken));
      if (!c) return invalid({ providerToken: 'INVALID_CARD' });
      entry = { ...common, kind: 'card', brand: c.brand, last4: c.last4, expMonth: c.expMonth, expYear: c.expYear };
    } else if ((kind === 'waafipay' || kind === 'edahab') && phoneOk(str(b.phone))) {
      entry = { ...common, kind, brand: str(b.brand), phone: toE164(str(b.phone)) };
    } else return invalid({ kind: 'REQUIRED' });
    const dup = u.methods.some(
      (m) =>
        m.kind === entry.kind &&
        m.brand === entry.brand &&
        (entry.kind === 'card'
          ? m.last4 === entry.last4 && m.expMonth === entry.expMonth && m.expYear === entry.expYear
          : phoneDigits(m.phone ?? '') === phoneDigits(entry.phone ?? '')),
    );
    if (dup) return fail(409, 'DUPLICATE_METHOD', 'This payment method is already saved.');
    if (u.methods.length >= config.limits.savedMethodsMax)
      return fail(422, 'LIMIT_REACHED', `You can save up to ${config.limits.savedMethodsMax} payment methods.`);
    u.methods.push(entry);
    if (b.makeDefault === true || !u.defaultMethodId) u.defaultMethodId = entry.id;
    putUser(u);
    return HttpResponse.json(toMethod(entry), { status: 201 });
  }),

  http.put(`${base}/me/payment-methods/:id/default`, async ({ params }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    await wait(200);
    const m = u.methods.find((x) => x.id === String(params.id));
    if (!m) return fail(404, 'NOT_FOUND', 'Payment method not found.');
    if (methodExpired(toMethod(m))) return fail(409, 'METHOD_EXPIRED', 'That card has expired.');
    u.defaultMethodId = m.id;
    putUser(u);
    return noContent();
  }),

  http.delete(`${base}/me/payment-methods/:id`, async ({ params }) => {
    const u = requireUser();
    if (!u) return unauthorized();
    await wait(300);
    u.methods = u.methods.filter((x) => x.id !== String(params.id));
    if (u.defaultMethodId === String(params.id))
      u.defaultMethodId = u.methods.find((x) => !methodExpired(toMethod(x)))?.id ?? '';
    putUser(u);
    return noContent();
  }),
];
