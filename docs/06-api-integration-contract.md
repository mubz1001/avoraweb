# 06 · API Integration Contract

What the frontend expects from the backend. The app talks to this API through `src/lib/api` (typed client + Zod response schemas). Until the backend exists, a mock server (MSW, §9) implements it in the browser; this contract is **proposed** and shaped so the mock data maps 1:1. Treat it as the starting point for agreement with the backend team; any change must be reflected here first.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base URL | `/api/v1` (from env) |
| Format | JSON, UTF-8, `camelCase` fields |
| Dates | `YYYY-MM-DD` (property-local calendar dates); timestamps ISO-8601 UTC |
| Money | Integer **minor units (cents)** + `currency: "USD"`. UI formats; UI never does float math on money |
| IDs | Opaque strings (`"jazeera"`, `"double"`) |
| Phone | E.164 (`"+252615550142"`); UI sends normalized, displays formatted |
| Pagination | Cursor: `?limit=20&cursor=…` → `{items, nextCursor}` |
| Language | `Accept-Language: so|en|ar`; server returns localized `name`, `description`, `rules` |
| Caching | Read endpoints send `Cache-Control` + `ETag`; availability/quotes are `no-store` |
| Idempotency | All `POST` that create money movement require `Idempotency-Key` (UUID v4, generated per Pay attempt, reused on retry) |
| Rate limits | `429` with `Retry-After` header |

### Authentication
Accounts are optional, but guests get a deliberately thinner experience: they can reserve and pay, and receive their booking details **by email only** (no booking lookup, no guest booking view). Three access levels:
1. **Public** (search, property, suggest, quote, create booking as a guest): no auth; optionally an `X-Client-Id` header for analytics/rate limiting.
2. **Payment session** (guests): `POST /orders` returns a short-lived **payment token** (opaque, ~15 min) that authorizes only `GET /orders/{id}/payment-status` and `POST /orders/{id}/payment-prompt` while a mobile-money prompt is pending. It also lets the guest open that one order (`GET /orders/{id}`) once the wallet approval arrives, so the page can say what it came to. It cannot cancel the order or read anything else. Send as `Authorization: Bearer <paymentToken>`.
3. **Member session** (§5b): an HttpOnly, Secure, SameSite=Lax cookie set by the `/auth/*` endpoints. It authorizes `/me/*` and any booking owned by the member. Mutating requests send `X-CSRF-Token`. No auth token is ever readable by JavaScript.

### Error envelope (all non-2xx)
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields need attention.",
    "fieldErrors": { "guest.phone": "INVALID_PHONE" },
    "retryable": false,
    "requestId": "req_8f2c…"
  }
}
```
| HTTP | `code` examples | Frontend behaviour |
|---|---|---|
| 400 / 422 | `VALIDATION_FAILED` | Map `fieldErrors` keys onto form fields (copy from 01), focus first |
| 404 | `PROPERTY_NOT_FOUND`, `BOOKING_NOT_FOUND` | Not-found page / "No booking found" |
| 409 | `ROOM_UNAVAILABLE`, `PRICE_CHANGED`, `QUOTE_EXPIRED` | Blocking banner on checkout (02 §6) |
| 402 | `PAYMENT_DECLINED`, `INSUFFICIENT_FUNDS`, `PAYMENT_CANCELLED` | Inline panel above Pay, keep form, offer another method |
| 408 / 504 | `PAYMENT_TIMEOUT` | "We didn't get your approval in time" + Resend prompt |
| 429 | `RATE_LIMITED` | Disable action until `Retry-After`; on sign-in "Too many attempts. Try again in N minutes." from `Retry-After` |
| 401 | `UNAUTHORIZED`, `BAD_CREDENTIALS`, `BAD_PASSWORD` | Session gone → signed-out state; wrong sign-in → generic error; wrong current password → field error |
| 409 | `EMAIL_TAKEN`, `DUPLICATE_METHOD` | Field error + "Sign in instead"; "This payment method is already saved." |
| 5xx | `INTERNAL` | Retry UI; never lose form input |

Field-error codes the UI translates: `REQUIRED`, `TOO_SHORT`, `INVALID_PHONE`, `INVALID_EMAIL`, `INVALID_NAME`, `WEAK_PASSWORD`, `BREACHED_PASSWORD`, `INVALID_CARD`, `INVALID_EXPIRY`, `INVALID_CVC`, `DATE_IN_PAST`, `CHECKOUT_BEFORE_CHECKIN`, `TOO_MANY_ROOMS`.

### Loading and retry policy (frontend)
- Every request gives up after **20 s** and fails as `TIMEOUT` (retryable, handled like a lost connection), so a screen never waits forever.
- Queries (GET): show skeletons; **retry 2× with backoff** (1 s, 3 s) on network/5xx/timeout only; never retry 4xx.
- Search/suggest: debounce typing 200 ms; cancel in-flight requests when params change (AbortController).
- Mutations (POST): **no automatic retry** except the order create on network loss or timeout, which retries once with the **same** `Idempotency-Key`. If that also gets no answer, the key is **kept**: the next Pay replays the same request, and the server answers it with the original result, so a payment that did go through is never repeated.
- Stale-while-revalidate: property detail 5 min; search results 60 s; availability 30 s (so the page doesn't refetch what its loader or a hover prefetch just fetched; checkout re-checks on its own); quotes never cached.

---

## 2. Domain types

```ts
type PropertyType = 'hotel' | 'hall';
type Money = { amount: number; currency: 'USD' };          // amount in cents

interface PropertySummary {
  id: string; type: PropertyType; name: string;
  city: string; area: string;
  propertyType: 'Hotel' | 'Guesthouse' | 'Apartments' | 'Wedding hall';
  stars?: number;
  rating?: { score: number; count: number };               // omitted entirely if count < 3
  amenities: string[];                                     // keys, e.g. "wifi","ac" (see §7)
  fromPrice: Money;                                        // cheapest room type per night (halls: per day), for "From $X" on cards without a trip
  hue: number;                                             // placeholder tile colour until real photos exist
  images: { url: string; alt: string; width: number; height: number; srcset?: string }[];  // url = largest (lightbox); srcset = "<url> 480w, <url> 800w, …" when sizes exist
  featured: boolean; listedAt: string;
}

interface Property extends PropertySummary {
  address: string; location: { lat: number; lng: number };
  mapUrl?: string;                    // any Google Maps link (place, @lat,lng or ?query=); drives the embedded map and "Open in Google Maps"
  description: string;
  checkInFrom: string; checkOutUntil: string;              // "14:00", "12:00" (halls: event start / music end)
  cancellation: { freeUntilDaysBefore: number };           // days before check-in that cancellation stays free
  whatsapp: string;                                        // E.164
  roomTypes: RoomType[];
}

interface RoomType {                                       // a TYPE, never a physical room
  id: string; name: string;                                // "double", "Double Room"
  beds: string; maxGuests: number; sizeM2?: number;
  features: string[];
  nightlyPrice: Money;                                     // taxes included; halls: per day
  image?: PropertySummary['images'][number];               // the room's photo (omitted: the UI shows a coloured tile)
}

interface RoomAvailability { roomTypeId: string; available: number; nightlyPrice: Money }

interface Trip { type: PropertyType; city?: string; checkIn: string; checkOut: string; guests: number; rooms: number }

interface BasketStay {                                    // one hotel's stay (§5b); never holds prices
  propertyId: string; type: PropertyType; checkIn: string; checkOut: string; guests: number; rooms: number;
  lines: { roomTypeId: string; qty: number }[];            // 1–20 lines, qty ≥ 1
  updatedAt: string;                                       // ISO; the server caps it at "now" (it only orders two copies at sign-in)
}
interface Basket {                                         // stays at any number of hotels, 1–10, one per property + dates
  stays: BasketStay[];
  updatedAt: string;                                       // ISO, set by the server
}

interface StayQuote {                                      // one stay's share of a quote; it becomes one booking
  propertyId: string; checkIn: string; checkOut: string; guests: number; nights: number;
  lines: { roomTypeId: string; name: string; qty: number; unitPrice: Money; total: Money }[];
  subtotal: Money; serviceFee: Money;                      // UI hides serviceFee when amount === 0
  total: Money;
  freeCancellationUntil?: string;                          // absent = non-refundable
}
interface Quote {                                          // the price of everything paid for in one checkout
  quoteId: string; expiresAt: string;
  stays: StayQuote[];                                      // same order as the request
  taxesIncluded: true;
  total: Money;                                            // Σ stays[].total
}

interface Booking {                                        // one property's reservation
  ref: string;                                             // "AV-5JPF4P"
  orderId: string;                                         // the checkout it was paid in; several bookings can share one
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'payment_failed' | 'failed';   // failed: paid, the property couldn't confirm, refunded
  property: Pick<Property, 'id'|'name'|'address'|'location'|'checkInFrom'|'checkOutUntil'|'whatsapp'|'type'> & { image?: Image };   // image = the stay's first photo, for booking lists
  trip: Trip; quote: StayQuote;
  guest: { name: string; phone: string; email?: string };
  payment: { method: PaymentMethod; brand?: string; last4?: string; payPhoneMasked?: string; paidAt?: string };
  refundedAt?: string;                                     // set when this booking's total went back to the payment method
  accountId?: string;                                      // set when booked while signed in or added to an account
  createdAt: string;
}

interface Order {                                          // one checkout: ONE payment, a booking per stay
  id: string;                                              // "ord_…"
  status: 'pending_payment' | 'confirmed' | 'partially_confirmed' | 'failed' | 'payment_failed';
  total: Money; refunded?: Money;                          // refunded = Σ totals of the bookings that failed
  payment: Booking['payment'];
  bookings: Booking[];
  accountId?: string; createdAt: string;
}

type PaymentMethod = 'waafipay' | 'edahab' | 'card';
// waafipay brands: 'EVC Plus' | 'ZAAD' | 'SAHAL'; edahab brands: 'eDahab' | 'Premier Wallet'; card brands: 'Visa' | 'Mastercard'

interface Member {
  id: string;
  firstName: string; lastName: string;
  email: string;                                           // lowercase, unique
  phone: string;                                           // E.164, any country (+252…, +44…)
  phoneVerified: boolean;
  hasPassword: boolean;                                    // false for Google/Apple-only accounts
  providers: ('google' | 'apple')[];
  defaultPaymentMethodId?: string;
  createdAt: string;
}

interface SavedPaymentMethod {
  id: string;
  kind: PaymentMethod;
  brand: string;                                           // "EVC Plus", "Visa", …
  phone?: string;                                          // wallets, E.164
  last4?: string; expMonth?: number; expYear?: number;     // cards (display only)
  // the provider token stays server-side; never a card number or CVC
  createdAt: string;
}
```

---

## 3. Discovery endpoints

### 3.1 `GET /cities` — Home "Popular cities"
Query: `type=hotel|hall`.
```json
{ "items": [ { "name": "Mogadishu", "count": 4 }, { "name": "Hargeisa", "count": 3 }, { "name": "Garowe", "count": 3 } ] }
```
**`count` must equal the number of results `GET /search` returns for that city and type with no filters** (fixes audit issue 11). Unavailable properties are included in both.

### 3.2 `GET /suggest` — city combobox
Query: `q` (may be empty), `type`. Debounced 200 ms. Empty `q` returns all cities.
```json
{
  "cities": [ { "name": "Hargeisa", "count": 3 } ],
  "properties": [ { "id": "ambassador", "name": "Ambassador Plaza Hargeisa", "city": "Hargeisa" } ]
}
```
Max 4 properties. Matching: case-insensitive, accent-insensitive, prefix first then substring.

### 3.3 `GET /home` — Featured and Newest
Query: `type`. Server guarantees `newest` excludes ids in `featured`.
```json
{ "featured": [PropertySummary, …3], "newest": [PropertySummary, …3] }
```

### 3.4 `GET /search` — results
Query: `type, city, checkIn, checkOut, guests, rooms, sort=rec|price-asc|price-desc|rating, maxPrice (cents), minRating, amenities (csv), propertyTypes (csv), limit, cursor`.
```json
{
  "resolvedCity": "Mogadishu",
  "total": 4, "availableCount": 3,
  "items": [
    {
      "property": PropertySummary,
      "availability": "available",                 // "available" | "partial" | "unavailable"
      "roomsLeft": 18,
      "fromRate": { "amount": 10000, "currency": "USD" },     // cheapest type that holds ceil(guests/rooms) guests and has ≥ rooms available
      "stayTotal": { "amount": 40000, "currency": "USD" },    // fromRate × nights × rooms (before service fee)
      "nights": 2,
      "freeCancellationUntil": "2026-10-13"
    }
  ],
  "nextCursor": null
}
```
- `resolvedCity`: canonical city for the summary and page title ("Mog" → "Mogadishu"); `null` if unknown → UI shows the "We couldn't find…" empty state.
- **Unavailable properties are returned**, sorted after available ones regardless of sort, with `availability: "unavailable"` (no stock / blocked) or `"partial"` (`roomsLeft < rooms`), and no `stayTotal`.
- Halls: `nights = 1`, `rooms` ignored.

### 3.5 `GET /properties/{id}` — detail
Returns `Property`. Cached. 404 → `PROPERTY_NOT_FOUND`.

### 3.6 `GET /properties/{id}/availability` — rooms for the trip
Query: `checkIn, checkOut, guests, rooms`.
```json
{
  "available": true,
  "roomTypes": [ { "roomTypeId": "single", "available": 3, "nightlyPrice": { "amount": 8000, "currency": "USD" } },
                 { "roomTypeId": "double", "available": 6, "nightlyPrice": { "amount": 10000, "currency": "USD" } },
                 { "roomTypeId": "suite",  "available": 2, "nightlyPrice": { "amount": 18000, "currency": "USD" } } ],
  "recommendation": { "roomTypeId": "double", "qty": 2 },
  "freeCancellationUntil": "2026-10-13"
}
```
- **Grouped by room type** (fixes issue 1); `available` is the real count. The UI shows scarcity copy only when `available ≤ 2` (issue 2) — the server must never inflate or fake scarcity.
- `recommendation` follows the rule in 04 §B.3; the UI may compute it locally as a fallback.
- No stock at all → `available: false`, all counts 0.

---

### 3.7 Reviews

**Types**
```ts
interface ReviewSummary {
  count: number;                       // total reviews
  score: number;                       // 1-5, one decimal; equals PropertySummary.rating.score
  label: 'Exceptional' | 'Excellent' | 'Very good' | 'Good' | 'Okay' | 'Poor';
  topics: { key: string; label: string; count: number }[];       // only topics with count > 0
}
interface Review {
  id: string;
  firstName: string; city: string;
  roomTypeName: string; nights: number; stayMonth: string;      // stayMonth "2026-09"
  postedAt: string;                    // YYYY-MM-DD
  score: number;                       // integer 1-5
  title: string; text: string;
  topics: string[];                    // topic keys mentioned (positive or negative)
  response?: { text: string; postedAt: string };                // the property's reply
}
```
`Property` (3.5) includes `reviewSummary` (omitted when `count < 3`) and `latestReviews: Review[]` (the 4 newest) so the hotel page needs no extra request.

**`GET /properties/{id}/reviews`** — the reviews page.
Query: `sort=relevant|newest|oldest|highest|lowest` (default `relevant`), `score=5|4|3|low` (`low` = 1-2), `topic`, `limit` (default 10, max 50), `cursor`.
```json
{
  "summary": ReviewSummary,
  "total": 126,                         // matching the filters
  "items": [Review, ...],
  "nextCursor": "c_10"                  // null when no more; drives "Show more reviews"
}
```
Rules: `relevant` = longer, more detailed reviews first, then newest. Counts in `summary.topics` are for the **whole** property (not the filtered set) so chips and filter labels stay stable. A property with `count < 3` returns `items: []` and no `summary`. Only reviews from verified stays may be published; the property's `rating.score` and `rating.count` must be computed from the same set.

**Submitting reviews:** members write one from Past stays (§5b). The post-stay email/WhatsApp link is not built.

## 4. Checkout endpoints

### 4.1 `POST /quotes` — authoritative price
Called when checkout opens and whenever the stays change there. **One quote prices every stay being paid for together**; each stay is priced on its own (own lines, fee, total and cancellation terms) and `total` is their sum.
```json
// request: 1–10 stays, each one property + dates (no repeats)
{ "stays": [
    { "propertyId": "jazeera", "checkIn": "2026-10-14", "checkOut": "2026-10-16", "guests": 4,
      "selection": [ { "roomTypeId": "double", "qty": 2 } ] },
    { "propertyId": "lido", "checkIn": "2026-10-20", "checkOut": "2026-10-23", "guests": 2,
      "selection": [ { "roomTypeId": "suite", "qty": 1 } ] } ] }
// 200
Quote
```
Example (first stay): 2 × $100 × 2 nights → subtotal 40000, serviceFee 800 (2%), total 40800 → UI "Pay $408 now" for a one-stay checkout.
Errors: `409 ROOM_UNAVAILABLE` (reported for **every** affected stay at once: `fieldErrors: {"stays.1.selection.double": "ONLY_1_LEFT"}` and `stays: [1]`, the positions), `422 VALIDATION_FAILED` (`stays: REQUIRED | TOO_MANY | DUPLICATE_STAY`, or a stay's own field keys prefixed `stays.<i>.`), `422 DATE_IN_PAST`, `404 PROPERTY_NOT_FOUND`.
Quotes expire (`expiresAt`, suggested 15 min). The UI refreshes silently if the user is idle past expiry.

### 4.2 `POST /orders` — pay for the whole checkout (replaces creating a booking per property)
Headers: `Idempotency-Key`. **One request, one payment, one booking per stay.**
```json
{
  "quoteId": "q_91c…",
  "guest": { "name": "Amina Hassan", "phone": "+252615550142", "email": null },
  "payment": {
    "method": "waafipay", "brand": "EVC Plus",
    "payPhone": "+252615550142"               // the guest phone unless "Use a different number" is on
  }
}
```
Card payments send **only** a provider token (`"cardToken": "tok_…"` from the provider's hosted fields), never raw card data. The body carries **no stays, rooms or prices**: they come only from the stored quote, so a manipulated request can't change what is booked or charged.

Server rules (all before any money moves unless stated):
1. The quote must exist and be unexpired (`409 QUOTE_EXPIRED`).
2. **A quote pays for one order.** If an order for it is already pending or paid → `409 QUOTE_USED` with `{ orderId }`. Only an order whose payment failed (`payment_failed`) frees its quote to be paid again.
3. The `Idempotency-Key` replays the stored answer (success *and* error). A key used with a different `quoteId` → `422 IDEMPOTENCY_KEY_REUSED`.
4. **Every stay is re-quoted and stock re-checked.** Any stay gone → `409 ROOM_UNAVAILABLE` (as in §4.1, `stays: [positions]`) and **nothing is charged or booked**. If a price differs from the quote → `409 PRICE_CHANGED` with the new quote.
5. One charge for `quote.total`, then one booking per stay is created with the same `orderId` and payment. Wallet payments wait for approval (below).
6. After a successful charge each property confirms its own booking. If a property **refuses** one, only **that** booking is marked `failed` and **its** total is refunded to the same method (`refundedAt`, `order.refunded`); the others are confirmed. A booking is never `confirmed` before the payment is.

Order `status`: `pending_payment` (waiting for the wallet approval) → `confirmed` (every booking confirmed) · `partially_confirmed` (some `failed` and refunded) · `failed` (paid, none confirmed, everything refunded) · `payment_failed` (declined or timed out: no money taken, bookings are `payment_failed`, retry or resend).

Responses:
| Status | Body | UI |
|---|---|---|
| `201` `confirmed` / `partially_confirmed` / `failed` | `Order` (+ `paymentToken` for guests) | Go to `/orders/{id}`; the page says what each booking came to |
| `202` `status: "pending_payment"` | `Order` (+ `paymentToken`, `paymentPrompt: {expiresAt}`) | Waiting state "Approve the EVC Plus prompt on +252 61 555 0142" with countdown; poll §4.3 |
| `409 PRICE_CHANGED` | `{ newQuote: Quote }` | Banner, user accepts new total, resubmit with new `quoteId` and a **new** idempotency key |
| `409 ROOM_UNAVAILABLE` | error + `stays` | Banner naming the stays; Pay stays disabled until they are edited or removed |
| `409 QUOTE_EXPIRED` | error | Refresh the quote |
| `409 QUOTE_USED` | `{ orderId }` | Open that order (members) or resume checking its payment |
| no answer (`NETWORK` / `TIMEOUT`) | – | "We couldn't confirm whether your payment went through"; details and idempotency key kept, Pay again replays the request |
| `401 UNAUTHORIZED` | error | "Your session has ended" with **Sign in**; the form and basket are kept |
| `402 PAYMENT_*` | error | Inline panel, try another method; nothing was booked |
| `422` | error with `fieldErrors` keys `guest.name`, `guest.phone`, `guest.email`, `payment.payPhone`, `payment.cardToken` | Field errors |

**Reconciliation:** the provider's callback settles the **order** (not each booking) and the backend then applies step 6 to the order's bookings. A refund for a refused booking is a partial refund of the one charge (`refund(order.charge, booking.total)`); the provider must support partial refunds. A callback that arrives after the prompt expired must still be applied exactly once (idempotent on `orderId`).

### 4.3 `GET /orders/{id}/payment-status` — mobile money polling
Auth: payment token or member session. Poll every 3 s up to `paymentPrompt.expiresAt` (≈ 90 s), stop on terminal status.
```json
{ "status": "pending_payment" | "confirmed" | "partially_confirmed" | "failed" | "payment_failed", "reason": "USER_DECLINED" }
```
`confirmed`, `partially_confirmed` and `failed` all mean the money was taken; the UI then opens the order. Production may use Server-Sent Events instead; the states are the same.

### 4.4 `POST /orders/{id}/payment-prompt` — resend prompt
Auth: payment token or member session. `204`. Rate-limited (1 / 30 s). `409 ORDER_NOT_PENDING` once the order is paid.

### 4.5 `GET /orders/{id}` — the order and its bookings
Auth: payment token or member session (the order must belong to the member; another account's order → `404`). Members' confirmation page. A guest reads it once, with the payment token, when a wallet approval arrives; the answer becomes their receipt for the tab (the email is their record). The page shows the order's real `status`: `pending_payment` and `payment_failed` are never presented as a confirmation.

---

## 5. Booking access (members only)

### 5.1 `GET /bookings/{ref}` — one booking
Auth: member session (the booking must belong to the member; another account's booking → `404`). Guests have no equivalent: their details are emailed. `401` → the UI shows the sign-in prompt.

### 5.2 `POST /bookings/{ref}/cancel` (recommended addition)
Auth: member session. Allowed until `freeCancellationUntil`; returns updated `Booking` with refund info. After the deadline → `409 CANCELLATION_WINDOW_CLOSED`.

### 5.3 `GET /bookings/{ref}/calendar.ics` (optional)
Server-generated `.ics` (the app generates it client-side today, `features/booking/ics.ts`: all-day `DTSTART`=checkIn, `DTEND`=checkOut, summary "Hotel (REF)", location = address).

### 5.4 Notifications (server-side, no endpoint)
On each booking's `confirmed`: an **email** to the booker (guest or member) with ref, property, dates, total, cancellation deadline, address and hotel contact (one email can list every booking of an order; a refused booking is mentioned as refunded): for a guest it is the only record of the booking. WhatsApp/SMS may repeat it. The UI copy "We've emailed your booking details to …" depends on this.

---

## 5b. Member accounts

All responses that sign someone in set the session cookie (HttpOnly, Secure, SameSite=Lax, rotated) and return `{ member: Member }`. Errors never reveal whether an email is registered except `EMAIL_TAKEN` on sign-up (acceptable because the email still has to be verified before the account can be used for anything sensitive; alternative: always answer "check your email").

| Endpoint | Body | Success | Errors |
|---|---|---|---|
| `POST /auth/register` | `{firstName, lastName, email, phone, password}` | `201` member; verification email + phone code sent | `409 EMAIL_TAKEN`, `422` field errors (`WEAK_PASSWORD`, `BREACHED_PASSWORD`, `INVALID_PHONE`, …) |
| `POST /auth/login` | `{email, password}` | `200` member | `401 BAD_CREDENTIALS` (same for unknown email), `429 RATE_LIMITED` (5 failures / 15 min per account and per IP) |
| `POST /auth/oauth/{google\|apple}` | `{code, codeVerifier, nonce}` (authorization-code + PKCE from the provider SDK) | `200` member (known email → linked), or `202 {pendingToken, email, firstName?, lastName?}` for a new person | `401 INVALID_ID_TOKEN` |
| `POST /auth/oauth/complete` | `{pendingToken, firstName, lastName, phone}` | `201` member | `410 SESSION_EXPIRED` (15 min), `409 EMAIL_TAKEN` |
| `POST /auth/password-reset` | `{email}` | `204` always; a known email gets a single-use link `/reset-password?token=…` (30 min) by email, including a Google/Apple-only account (setting a password then adds that sign-in method) | `429` |
| `POST /auth/password-reset/confirm` | `{token, password}` | `204`; the link is used up, all sessions revoked, a sign-in lock cleared | `410 TOKEN_EXPIRED` for an unknown, used or expired token (one answer for all three), `422` `password` (`TOO_SHORT`, `WEAK_PASSWORD`; the link stays usable) |
| `POST /auth/logout` | – | `204`, cookie cleared | – |
| `GET /me` | – | member | `401` → UI shows signed out |
| `PATCH /me` | `{firstName?, lastName?, email?, phone?, currentPassword?}` (`currentPassword` required to change email when `hasPassword`) | member; a changed email/phone must be re-verified | `409 EMAIL_TAKEN`, `401 BAD_PASSWORD` |
| `PUT /me/password` | `{currentPassword?, newPassword}` (`currentPassword` required when `hasPassword`) | `204`; other sessions revoked | `401 BAD_PASSWORD`, `422` |
| `DELETE /me` | `{currentPassword?}` | `204`; personal data and vaulted tokens removed; bookings kept, detached | `401 BAD_PASSWORD` |
| `GET /me/bookings` | – | `{upcoming: Booking[], past: Booking[]}` | – |
| `GET /me/favourites` · `PUT /me/favourites` | `{propertyIds: string[]}` (replaces the list; unknown ids and repeats are dropped) | `{propertyIds}` | `401` signed out (guests have no favourites) |
| `GET /me/basket` | – | `{basket: Basket \| null}` | – |
| `PUT /me/basket` | `{basket: Basket, merge?: boolean}` | `{basket}` (as stored) | `404 PROPERTY_NOT_FOUND`, `422 DATE_IN_PAST`, `422 VALIDATION_FAILED` (`stays: REQUIRED \| TOO_MANY`, `stays.<i>: DUPLICATE_STAY`, and per stay `stays.<i>.checkOut: CHECKOUT_BEFORE_CHECKIN \| STAY_TOO_LONG`, `.guests`/`.rooms: OUT_OF_RANGE`, `.lines: REQUIRED \| INVALID_LINE \| TOO_MANY \| ONE_HALL`) |
| `DELETE /me/basket` | – | `204` | – |
| `GET /me/payment-methods` | – | `{items: SavedPaymentMethod[], defaultId?}` | – |
| `POST /me/payment-methods` | wallet: `{kind, brand, phone}` · card: `{kind: 'card', providerToken}` (from hosted fields) · `makeDefault?` | `201 SavedPaymentMethod` | `409 DUPLICATE_METHOD`, `422 LIMIT_REACHED` (10), `402` card verification failed |
| `PUT /me/payment-methods/{id}/default` | – | `204` | `409` expired card |
| `DELETE /me/payment-methods/{id}` | – | `204` (next usable method becomes default) | – |

**Basket** (02 §4.14): `Basket = {stays: BasketStay[], updatedAt}`, one basket per account, 1–10 stays, at most one per property + dates (a stay sent twice is refused, not guessed at). The server owns it: for **each** stay it takes `type` from the property, sets a hall's `checkOut` to the next day, sums repeated lines, refuses unknown room types, quantities outside 1–5 (halls: exactly one hall), parties outside the search limits and stays over 30 nights, and stamps `updatedAt` itself. It never stores prices and never checks stock (rooms can sell out after they were added; the quote refuses them at checkout). `merge: true` (sign-in) **combines the two baskets stay by stay**: stays on only one side are all kept; a stay on both sides keeps the copy with the later `updatedAt` (the client's stamp is used only to order the two and is capped at now). When an order is paid (at once for a card, or when the wallet approval arrives) it removes **only the stays it booked** from the account's basket; the others stay. While a wallet prompt is waiting, and if the payment fails or expires, the basket is untouched.

**Orders while signed in:** `POST /orders` with the session cookie sets `accountId` on the order and each booking; `payment` may be `{ savedMethodId }` instead of new details, and `saveMethod: true` stores a new method after a successful charge (failure to save never fails the booking).


**Reviews:** `POST /bookings/{ref}/review`, session cookie + CSRF + `Idempotency-Key`. Body `{ score: 1-5 integer, text: string }` (text trimmed, 30–2,000 characters); the server derives `title`, `firstName`, `roomTypeName`, `nights`, `stayMonth`, `topics` from the booking and stamps `postedAt`. Responses: `201` (empty body is fine); `401` signed out; `403 NOT_ELIGIBLE` not the booking's owner, not confirmed, or not checked out yet (the client's own gate is only a convenience: always check on the server); `404` unknown booking; `409 ALREADY_REVIEWED`; `422` with `fieldErrors` `score` / `text` (`REQUIRED`, `TOO_SHORT`). Escape text on output; moderate before publishing (the dialog promises a check). `Booking.review?: { score, postedAt }` is returned on every booking (list, detail, order) once a review exists, so cards show "Review sent" after a reload. A repeated `Idempotency-Key` for the same booking answers `201` again instead of `409`, so a resend after a lost answer is safe; the client keeps the key only while the outcome is unknown and uses a new one after any definite answer. `reviewSummary`/`rating` should be refreshed from the same set (§3.7) once the review is published; the client invalidates the property and reviews queries after a send. The mock API implements the endpoint (§9) and stores the review on the booking, but does not publish it to the hotel's reviews.

---

## 6. Payment integration notes

- **Mobile money (WaafiPay: EVC Plus, ZAAD, SAHAL; eDahab; Premier Wallet):** the backend initiates a push-to-approve request to `payPhone`; the user approves on their phone; the backend receives the provider callback and moves the booking to `confirmed`. The frontend only shows waiting/resend/failed states (§4.2–4.4). Provider credentials never touch the frontend.
- **Card:** use the provider's hosted fields/redirect to obtain a token; 3-D Secure challenges are handled by the provider SDK before `POST /orders`.
- **Charge timing:** the order is charged in full, once, at Pay (one charge covers every booking in it). All copy says "Pay $X now"; there is no "You won't be charged yet" state (fixes issue 4).
- **Refunds:** free cancellation refunds that booking's full `total` (including service fee) to the original method; a booking a property refuses after payment is refunded the same way, automatically. Each is a partial refund of the order's single charge.

---

## 7. Reference data

**Amenity keys (hotels):** `wifi` Free Wi-Fi · `ac` Air conditioning · `bf` Breakfast included · `park` Free parking · `power` 24h backup power · `rest` Restaurant · `shuttle` Airport shuttle · `beach` Beach access · `sec` 24/7 security · `lift` Elevator · `prayer` Prayer room · `family` Family rooms.

**Service keys (halls):** `stage` Stage & sound system · `cater` Catering available · `park` · `ac` · `power` · `bride` Bridal suite · `sec` · `decor` Decoration service.

Labels are localized server-side (or in the frontend copy file); the keys are stable.

---

## 8. Frontend expectations checklist (per endpoint)

| Endpoint | Loading UI | Empty UI | Error UI | Retry |
|---|---|---|---|---|
| `/cities`, `/home` | skeleton chips/cards | hide section | inline retry | auto 2× |
| `/suggest` | none (keep last list) | "No match – try …" | silent (no list) | next keystroke |
| `/search` | 4 skeleton cards, summary "Searching…" | empty-state card | card + Retry | auto 2× |
| `/properties/{id}` + availability | skeleton gallery/rooms | 404 page | inline retry | auto 2× |
| `/quotes` | summary skeleton, Pay disabled with "Updating price…" | – | banner naming the stays | manual |
| `/orders` (create) | Pay "Processing payment…", form locked | – | per §4.2 | same idempotency key on network loss only |
| `/auth/*` | button progress label, form locked | – | form error panel / field errors | manual; never auto-retry credentials |
| `/me`, `/me/bookings` | skeleton rows | empty-state card | inline retry | auto 2× |
| `/me/payment-methods` (mutations) | button progress label | empty-state card | form error panel / toast | manual |

---

## 9. Mock server

Until the backend exists, every endpoint above is served by **MSW** (Mock Service Worker) inside the browser: `src/mocks/`. The app code is the production code: it calls `fetch('/api/v1/…')` through `src/lib/api`, and the service worker answers. Switching to the real API is configuration only: `VITE_API_MOCK=false` (MSW is then never loaded) and `VITE_API_BASE` if the API is not same-origin.

| File | Role |
|---|---|
| `src/mocks/handlers/discovery.ts` | `/cities`, `/suggest`, `/home`, `/search`, `/properties/{id}`, `/availability`, `/reviews` |
| `src/mocks/handlers/checkout.ts` | `/quotes`, `/orders` (with `Idempotency-Key`), `/orders/{id}`, `/orders/{id}/payment-status`, `/orders/{id}/payment-prompt`, `GET /bookings/{ref}` (owner only) |
| `src/mocks/handlers/account.ts` | Everything in §5b, including `POST /bookings/{ref}/review` (owner of a confirmed, finished stay only) (a reset link is stored in the mock state and printed to the console as `[mock email] reset link: …` instead of being emailed), (the demo members are created on first sign-in, below) |
| `src/mocks/catalog.ts`, `reviews.ts`, `quote.ts` | Search, availability and pricing (using the same `src/lib/pricing` the UI uses), deterministic reviews, quotes |
| `src/mocks/auth.ts`, `db.ts` | The "server" state: accounts (PBKDF2-SHA256, 600,000 iterations, per-user salt, constant-time compare, 5 failures lock an email for 5 minutes, identical errors for unknown emails), session, bookings, quotes, idempotency records. Stored in `localStorage` under `mock.db` so a refresh keeps them and every tab shares one "server". **Not secure storage**: this exists only because there is no backend yet |
| `src/mocks/data/properties.json`, `review-phrases.json` | Seed data (prices in cents). Dates are relative to today |

**Fixtures and test triggers.** The last four digits of the wallet number (or of the card, for card payments) choose the outcome; every other number succeeds immediately.

| Ends in | Outcome |
|---|---|
| `0199` (wallet) / `0002` (card) | `402 PAYMENT_DECLINED` |
| `9995` | `402 INSUFFICIENT_FUNDS` |
| `0197` | `202 pending_payment`; confirms about 6 s later (the waiting state; every booking of the order together) |
| `0198` | `202 pending_payment`; fails with `TIMEOUT` when the 90 s prompt expires; **Resend** then confirms it |
| `0196` | `409 PRICE_CHANGED` once (every stay +10%); paying again with the new quote succeeds |
| `0195` | Paid, then the **last stay's** property refuses its booking: that booking is `failed` and refunded, the others confirm (`partially_confirmed`; one stay → `failed`) |

Also seeded: one sold-out property (`ocean`), scarce room types (≤ 2 left, e.g. Jazeera's Family Suite), properties with fewer than 3 reviews (no rating), and the two demo members, created at first sign-in (Omar Yusuf: Google/Apple account `demo.social@avora.example`, no password, same bookings; and Amina Hassan, `demo@avora.example` / `avora demo pass`: three saved methods, one expired; two favourites; two upcoming and one past booking).

**Cards in the mock.** `src/lib/payments/hostedFields.ts` stands in for the provider's hosted fields: it turns the typed card into a token (`tok_<Brand>_<last4>_<MMYY>_<random>`) and only the token reaches the API. The real provider SDK replaces that file.
