# 04 · Frontend Architecture

How the app is built (**A**), and what changes when it moves from the mock API to production (**B**).

---

## A. The app as built

### A.1 Stack
- **React 19 + TypeScript (strict)**, built with **Vite**. Single-page app, client-side routing with **React Router** (data router: lazy route modules, loaders, `ScrollRestoration`).
- **Server state:** TanStack Query. **Forms:** React Hook Form + Zod (`mode: 'onTouched'`). **Mock API:** MSW (06 §9).
- **Styling:** plain CSS with the design tokens in `src/styles/tokens.css` (03) and one stylesheet per component, next to it. Class names are the design system's (`.btn`, `.field`, `.hcard` …).
- **Tests:** Vitest + Testing Library (unit, component, mock-API contract tests); Playwright for the flows in B.7.

### A.2 Run it
| Command | What |
|---|---|
| double-click `start.cmd` (Windows) or `npm start` | Install on first run, build the optimised production bundle and serve it (with the mock API) at http://localhost:5173 |
| `npm run dev` | Development server with hot reload (slower: unminified React, StrictMode double renders) |
| `npm run dev` | Dev server only |
| `npm run build` / `npm run preview` | Production build (`dist/`) and a local server for it |
| `npm run typecheck` · `npm run lint` · `npm test` · `npm run e2e` | Checks; `e2e` starts the dev server if needed |

WebCrypto (used by the mock's password hashing) needs a secure context: `localhost` or https.

### A.3 Folder structure (feature-first)
```
index.html                    entry; the production build adds the Content-Security-Policy meta (vite.config.ts)
public/                       logo.svg (mark, transparent), favicon.svg, favicon.ico, apple-touch-icon.png, icon-*.png, og-image.png (made by scripts/make-icons.mjs), site.webmanifest, theme-init.js, mockServiceWorker.js (MSW), placeholder/ (16 free Pexels photos for the mock catalog: exterior, lobby, room, bathroom, restaurant, each as `<name>-480/-800/-1200.webp` made by scripts/make-photos.mjs; Vite copies it to dist/placeholder; delete it with src/mocks/ when real photos exist)
src/
├─ main.tsx                   starts MSW when VITE_API_MOCK isn't "false", then mounts the router
├─ app/
│  ├─ router.tsx              route table (below); every page is a lazy chunk
│  ├─ RootLayout.tsx          header, drawer, footer (sticky: `#root` is a column ≥ 100dvh, `main` grows), toast host, scroll restoration, boot shell
│  ├─ shell/                  Header, Drawer, Footer, AccountMenu, nav.ts (the nav lists) (+ shell.css)
│  ├─ routes/                 one thin module per page: loader + composition (home, search, property, reviews,
│  │                          checkout, booking, account, auth, legal)
│  ├─ NotFound.tsx  RouteError.tsx
├─ features/                  search · property · reviews · checkout · booking · auth · account · basket
├─ vendor/                    third-party code we copied in and adapted (lightbox/, MIT: each folder keeps its LICENSE and a header listing local changes and the upstream commit)
├─ components/                shared UI (05 Part 1): Button, Field family, Dropdown (basket + account menu), PaymentOptions, PropertyCard, FilterPanel …
├─ lib/
│  ├─ api/                    client.ts (fetch, ApiError, retry policy), errors.ts (`errorMessage`: plain-language text for an API error; kept apart from the form helpers so pages that only show errors don't load React Hook Form), schemas.ts (Zod), endpoints.ts (one function per endpoint + query keys), queries.ts (property + availability queries shared by pages and the basket)
│  ├─ basket/                 the basket's stay rules, device copy and sign-in merge (index.ts) and its React state (useBasket.ts)
│  ├─ pricing/                quote rules, recommend, fits (B.4.1), used by UI and mock alike
│  ├─ motion/                 usePresence + afterTransition (07 §4)
│  ├─ payments/               hostedFields (card tokenizer stand-in), method helpers, mock token format
│  ├─ validation/             field rules and their copy (phone, email, name, password, card, expiry, CVC)
│  ├─ session.ts  favourites.ts  tripState.ts  trip.ts  safeNext.ts  storage.ts  useLocalValue.ts  useUrlState.ts
│  ├─ dates.ts  money.ts  phone.ts  reference.ts  receipt.ts  scroll.ts  config.ts  queryClient.ts
├─ mocks/                     the mock backend (06 §9); never imported by app code
├─ styles/                    tokens.css, base.css, forms.css, surfaces.css, motion.css
└─ types/                     domain types, mirroring 06 §2
tests/                        setup.ts (Vitest), e2e/ (Playwright)
```
Rules: features never import each other (shared code lives in `components/` or `lib/`); route modules compose features and own no business logic; no `dangerouslySetInnerHTML` (ESLint `react/no-danger`); inline styles only for dynamic values (the placeholder hue).

### A.4 Routing
Routes are in 02 §1. Trip and filters are **URL state**: `lib/trip.ts` (`parseTrip` / `serializeTrip`) applies the defaults and clamps (past check-in → today+3, check-out ≤ check-in → +2 nights, hotel guests 1–8, rooms 1–min(5, guests), halls one day). Filter and sort changes go through `useUrlState` (optimistic, `replace`), so controls respond instantly and Back leaves the page instead of stepping through filter states.

- **Loaders** prefetch a page's data with a 100 ms head start (`warm()` in `lib/queryClient.ts`): a fast answer renders complete, a slow one shows skeletons. Same-path query changes don't re-run loaders (`shouldRevalidate`); the page's queries react to the URL.
- **Intent prefetch** (`lib/prefetch.ts`): `AppLink` (and so `ButtonLink`) imports the target route's chunk and runs its loaders on press (`pointerdown`), hover and focus. Loaders only warm the query cache, so running them early is side-effect free; calls are de-duplicated while in flight and failures are silent (the real navigation shows the error UI). Hover, focus and idle prefetch are skipped under Data Saver. Once the first page is idle, the search and property chunks are preloaded (code only, no data). At start-up `main.tsx` calls `preloadRoute(location.href)` (router.tsx), so the first page's chunk downloads while the mock API starts instead of after it. The router registers its table with `registerRoutes`, so the module never imports the router.
- **Scroll:** `ScrollRestoration` restores per history entry (Back/Forward). The reviews page's "← Hotel" link restores the property page's position through `lib/scroll.ts` (`state.returning`).
- **Titles:** each page renders a React 19 `<title>`.
- **`next`:** `lib/safeNext.ts` accepts only known app paths (no scheme, host, `//`, backslash or control characters); anything else goes to `/account/bookings`.
- **Errors:** every route has an error boundary; a failed lazy chunk (a deploy while the tab was open) offers a reload. Unknown paths render Not found.
- **Hosting:** an SPA. The host must serve `index.html` for every non-file path (a rewrite rule), send `Cache-Control: no-cache` for `index.html` and long-lived immutable caching for `assets/*` (content-hashed), and send the headers a meta tag can't (`frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, HSTS).

### A.5 State
| Kind | Where | Examples |
|---|---|---|
| Trip, filters, sort, room selection handed to checkout | URL | `?city=…&in=…&rooms=2`, `sel=double:2` |
| The stays in progress (basket) | account (members) or device (guests), via `useBasket` | per stay: property, dates, party, room quantities |
| Server data | TanStack Query | search, property, availability, quote, session (`['me']`), bookings, favourites, basket, payment methods |
| Forms | React Hook Form | guest + payment, sign-in, profile, review |
| UI | component state | sheet open, accordion open |
| Device conveniences | `localStorage` / `sessionStorage` (below) | last trip, guest basket |

The signed-in member is server state: `useSession()` reads `GET /me` (`null` on 401). Signing in or out updates the cache, drops member data and tells other tabs over a `BroadcastChannel('avora-session')`, so every open tab follows. On sign-in the device basket is merged into the account (`PUT /me/basket`, merge: the basket changed last wins; one the server refuses, e.g. dates passed, is dropped). Favourites are account-only: guests have none (the heart asks them to sign in), so there is no device copy to merge.

**The basket** (02 §4.14) holds stays at any number of hotels: `{stays: [{propertyId, type, checkIn, checkOut, guests, rooms, lines: [{roomTypeId, qty}], updatedAt}], updatedAt}`, one stay per property + dates (`stayKey`), at most `config.limits.basketStaysMax` (10). It never holds prices; the panel prices each stay from live availability and checkout asks for a server quote as always. The pure rules are in `lib/basket/index.ts` (`withStay` gives one stay these rooms or removes it, `moveStay` carries a stay to new dates, `withoutStays` drops booked ones): each returns a new basket in which every other stay is the same object, so changing one stay can't change another. `useBasket()` reads the account's basket for members and the device copy for guests, with the same API either way (`stays`, `set(stay, lines)`, `move(from, to)`); every change is worked out from the basket as it is *at that moment*, so quick taps on different stays never undo each other. Member writes are optimistic, roll back with a toast on failure, and run one at a time (TanStack mutation scope `basket`), so they reach the server in order. The device copy is parsed with the API schema on every read (localStorage is user-editable). The property page's steppers (`features/property/useStaySelection`) read and write this page's stay; stays leave the basket only once they are paid (`staysBooked`, called when the order settles; the server does the same for members).

**Reviews from booking history.** `features/reviews/ReviewDialog` is opened only by `features/account/BookingsTab` (`canReview(booking)`: confirmed and checked out). `accountApi.submitReview` is the real call for `POST /bookings/{ref}/review` (06 §5b), served by the mock API like any other endpoint. The `Idempotency-Key` is kept only while the outcome is unknown (lost connection, timeout, 5xx) so a resend can't post twice, and replaced after any definite answer. "Review sent" comes from `booking.review` in the bookings payload (so it survives a reload); the session list `['me','reviewed']` (`useReviewed`) only bridges the moment between sending and the refreshed list. Unsent drafts are kept per member and booking in `sessionStorage` (`avora.reviewDrafts`, `lib/reviewDrafts.ts`, written as the guest types): they survive a reload, Back and an expired session, and are dropped by an explicit sign-out.

**Persisted browser state.** Every read and write goes through `lib/storage.ts` (never throws; the app works with storage blocked).

| Key | Value | Written when |
|---|---|---|
| `avora.trip` | last `Trip` | Search submit, trip edit, Reserve |
| `avora.basket` | the guest's `Basket` (schema-checked on read) | Any room stepper change while signed out; cleared at sign-in (merged into the account, stay by stay); booked stays are removed from it |
| `avora.lang` | `en` \| `so` \| `ar` | Footer language select |
| `sessionStorage` `avora.payment` | the order of a wallet payment still waiting for approval, with its short-lived payment token (parsed with the API schema, dropped after ~20 min); lets a reload resume checking it | Wallet prompt sent; cleared when the payment settles |
| `sessionStorage` `avora.reviewDrafts` | `{ "<memberId>:<ref>": {score, text} }`, unsent reviews (parsed with a schema on read) | Typing in a review; cleared on send and on explicit sign-out |
| `sessionStorage` `avora.receipt` | the booking a guest just paid for (this tab only; no payment token) | Guest payment confirmed |
| `sessionStorage` `avora.prefill` | `{firstName, lastName, phone, email}` (read once) | Guest confirmation → Create account |
| `sessionStorage` `avora.pending` | `{token, email, provider, exp}` for a Google/Apple sign-up awaiting "Almost done" | Provider step |
| `sessionStorage` `avora.scroll.<path>` | scroll Y | Leaving a property page (for the reviews back link) |

Nothing else is stored by the app. The mock backend's own store (`mock.db`) belongs to the mock server, not the app (06 §9).

### A.6 Security in the client
- The client is never trusted: prices, availability, ownership and validation are the API's decisions (the mock enforces them the same way). Client validation is for feedback only; server field errors are mapped back onto the fields (`applyServerErrors`).
- No tokens in JavaScript: sessions are HttpOnly cookies (B.4.2); the client sends `credentials: 'include'` and a double-submit `X-CSRF-Token` read from a `csrf` cookie on mutating requests.
- Card numbers and CVCs never reach the API layer: `lib/payments/hostedFields.ts` returns a token (production: the provider's hosted fields / SDK). A guest's payment token is kept only for a wallet payment still waiting (`avora.payment`, this tab, ~20 min; it can only check that payment and ask for a new prompt).
- Bookings are created with an `Idempotency-Key` per Pay attempt; a lost connection retries once with the same key, so a charge is never repeated.
- Production build ships a Content-Security-Policy (`default-src 'self'`, no inline scripts, `frame-src https://www.google.com` for the map); external links use `rel="noopener noreferrer"`; personal data never goes in URLs.

### A.7 Feature switches
`src/lib/config.ts`: `features.halls` (wedding halls; off) and `features.demo` (the two "For Developer" demo sign-ins, accounts in `lib/demoAccounts.ts`; on only with the mock API). Environment: `VITE_API_MOCK` (`false` to use a real API), `VITE_API_BASE` (default `/api/v1`).

---

## B. Moving to production

### B.1 Replace the mock with the API
1. Build the backend to 06; then set `VITE_API_MOCK=false`. `src/mocks/`, `public/mockServiceWorker.js` and `public/placeholder/` can then be deleted; nothing in `src/app`, `features`, `components` or `lib` imports them.
2. Replace `lib/payments/hostedFields.ts` with the provider SDK (hosted fields, 3-D Secure) and `lib/payments/mockToken.ts` with nothing (the API returns display data).
3. Replace the provider step in `features/auth` with Google Identity Services / Sign in with Apple (OIDC + PKCE) and send the authorization code to `/auth/oauth/{provider}`.
4. Real photos: `PropertySummary.images` drives `PropertyImage`; the placeholder hue stays as the fallback.
5. Consider server rendering for SEO (property and city pages are organic entry points); the route modules and loaders map onto a framework router (e.g. React Router framework mode) without changing features.

### B.2 Performance budget
Home and search under 150 KB of JavaScript (gzip) on the critical path; today ≈ 145 KB (React DOM, React Router, TanStack Query and Zod are most of it; each page is a separate chunk, and the mock server is a separate chunk that production never loads). No web fonts (system stack). Images lazy-load with fixed aspect ratios. Only `transform` / `opacity` animate (07 §6).

### B.3 Pricing and rules: one module, used everywhere
Cards, property page, sticky bar, checkout summary and confirmation never compute prices independently: the UI shows server numbers (search totals, availability, the quote), and `lib/pricing` holds the same rules for the mock and for display fallbacks. **The server quote is authoritative.**
- `nights = daysBetween(in, out)` (halls: 1 day)
- `line = roomPrice × qty × nights`; `subtotal = Σ lines`
- `serviceFee = round(subtotal × 0.02)` to whole dollars; **hidden in the UI when 0**; amounts are integer cents
- `total = subtotal + serviceFee`; taxes are included in `roomPrice`
- `cancelDate = checkIn − property.cancelDays`; free cancellation only if `cancelDate ≥ today`
- `recommend(trip, roomTypes)`: guests per room = `ceil(guests / rooms)`; cheapest type with `maxGuests ≥ perRoom` and `available ≥ rooms` → quantity = `rooms`; fallback: the largest type, quantity `min(available, max(rooms, ceil(guests / maxGuests)))`
- `fits(property, trip)`: total rooms available ≥ `rooms`
- Card price: cheapest type that fits × nights × rooms

### B.4 Authentication (production)
- **Sessions:** server-issued, HttpOnly + Secure + SameSite=Lax cookie; rotated on sign-in and on password change; 30-day idle expiry; `POST /auth/logout` revokes it. No tokens in `localStorage`. State-changing requests carry a CSRF token (double-submit, as the client already sends) or rely on `SameSite` + an `Origin` check.
- **Passwords:** hashed server-side with Argon2id; 8–128 characters, checked against a breached-password list (k-anonymity range API), no composition rules (NIST SP 800-63B). Re-authentication for email change, password change, payment-method changes on new devices and account deletion.
- **Google / Apple:** official SDKs, OAuth 2.0 / OpenID Connect authorization-code flow with PKCE, `state` and `nonce`; the server verifies the ID token signature, `aud`, `iss` and `exp`, and links by verified email. Apple may return a private relay email and shares the name only on first sign-in: store it then. Phone is never provided, hence "Almost done".
- **Enumeration and abuse:** identical responses for unknown emails on sign-in and reset; rate limits per IP and per account; CAPTCHA only after repeated failures.
- **Payment methods:** collected by the provider's hosted fields / SDK and vaulted by the provider; AVORA stores the provider token + display data. Mobile-money "methods" store the wallet number and brand only; each charge still needs approval on the phone.
- **Account deletion:** removes personal data and vaulted tokens. Bookings are retained for legal/accounting reasons, detached from the account (the mock simply deletes them).

### B.5 Data flow (happy path)
```
URL ──parseTrip──► useQuery(search) ──GET /search──► results
                                          │ card
                                          ▼
     useQuery(property) + useQuery(availability) ──► RoomCard[] ── steppers ──► useStaySelection (basket)
                                          │ Reserve
                                          ▼
              /checkout (the basket's stays) ──POST /quotes──► OrderSummary (a block per stay), Pay label
                                          │ Pay (Idempotency-Key)
                                          ▼
              POST /orders ──201──► /orders/:id      ──202──► poll order payment-status ──► /orders/:id
```
Checkout always requests a fresh quote on load and refreshes it before it expires; if the price changed, the banner asks before charging (02 §6).

### B.6 Conventions
- **TypeScript strict** (`noUncheckedIndexedAccess`); domain types in `types/` mirror 06; every response is parsed with Zod in `lib/api` (a mismatch is an `ApiError('BAD_RESPONSE')`, never a crash deep in the UI).
- **Components:** function components, typed props, file name = component name; CSS next to the component; tokens only.
- **Accessibility is part of "done":** keyboard path works, roles and labels present (combobox, dialog, radiogroup), focus returns to the trigger when an overlay closes, errors are tied to fields, the first invalid field gets focus.
- **Copy:** in the components today; move to i18n files when Somali/Arabic land. Money and dates always go through `money.ts` / `dates.ts`.
- **Errors:** every query has loading, empty and error UI (06 §8); one `ApiError` type with `status`, `code`, `fieldErrors`, `retryable`, `retryAfter`. Queries retry twice (1 s, 3 s) on network/5xx only; mutations never retry, except a booking that lost the connection (same idempotency key).

### B.7 Testing
- **Unit (Vitest):** `lib/pricing`, `parseTrip` clamping, phone parsing, card rules (Luhn, Visa/Mastercard incl. 2221–2720, expiry month boundary), password rules, `safeNext`, storage when blocked.
- **Mock API contract (Vitest + MSW node):** city counts = search totals, newest excludes featured, identical errors for unknown email / wrong password, lockout after 5 failures, owner-only booking access, idempotent booking create, decline / pending / timeout / price-change fixtures, saved methods.
- **Component:** Stepper bounds, Accordion ARIA, validation timing and first-invalid focus.
- **E2E (Playwright, 375px and 1440px):** guest booking end to end (nothing kept, booking not viewable from another tab), unavailable dates, filters, decline and price change, guest → create account (prefilled), Google sign-up with "Almost done", 5 failed sign-ins → locked, member checkout with a saved method, sign-out reflected in another tab, member booking locked when signed out.

## Theming

`src/lib/theme.ts` sets `data-theme` on `<html>` from the stored `avora.theme` preference (System, Light, Dark); `index.html` applies it before first paint. All colours come from `src/styles/tokens.css`. See [08 · Theming](08-theming.md).

## SEO and sharing

- `index.html` carries the site-wide tags: title and description, canonical, robots, theme colour, Open Graph and Twitter cards, icons, the web manifest and JSON-LD (Organization and WebSite for Avora Bookings). `__SITE_URL__` is filled at build from `VITE_SITE_URL` (default `https://avorabookings.com`); share-card and canonical URLs must be absolute.
- `src/lib/seo.ts` `useSeo({ description, path, image, noindex })` overrides those tags while a page is shown and restores the defaults afterwards (no duplicate tags). Hotel pages set their own description, canonical and photo; private and transactional pages (account, sign-in, checkout, orders, bookings, search results, 404) are `noindex`. Page titles are plain `<title>` elements ending in "Avora Bookings".
- The build writes `robots.txt` (private paths disallowed) and `sitemap.xml` (home, search, support, legal and every stay in the mock catalogue; a real API should generate the stays part on the server) from `vite.config.ts`.
- Icons come from the supplied mark: `public/logo.svg` (transparent, used in the header) and `public/favicon.svg`. `node scripts/make-icons.mjs` regenerates `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` and the 1200 × 630 `og-image.png`. `node scripts/make-photos.mjs` turns any `public/placeholder/*.jpg` master into the 480/800/1200 px WebP set and removes the JPEG (same Chromium, no extra dependency).

## Languages

- `src/lib/i18n` holds the translations: `t('English text', { vars })` returns the text in the chosen language (English when a string has no translation), and `plural(n, 'night')` translates the noun. The English text is the key. Somali (`so.ts`) and Arabic (`ar.ts`) cover the header, menu, footer, home, search, hotel page, basket, checkout, wallet approval, booking pages and 404; hotel names, descriptions, reviews, legal pages and the account area stay in English. The two dictionaries are separate chunks loaded when chosen: `initLang()` (awaited in `main.tsx`) fetches the saved one before the first render, so English visits download neither; `setLang()` switches once the chunk is in, and `useLang()` re-renders the layout at that moment.
- The footer Language select calls `setLang`; the choice is saved as `avora.lang`, the layout remounts so every string is read again, and `<html lang dir>` is set (Arabic is right-to-left). `public/theme-init.js` applies the saved language before first paint. Direction-sensitive CSS uses logical properties or `[dir='rtl']` overrides (drawer side, select chevron, calendar arrows).
`npm run i18n:check` fails when a string has no translation.
