# AVORA – booking app (React + Vite)

The improved AVORA booking flow as a React 19 + TypeScript single-page app (Vite, React Router, TanStack Query, React Hook Form + Zod). Until the backend exists, a mock API (MSW) runs in the browser and implements the contract in 06, so the app code is already the production code. Mobile-first; works from 375px to large desktops. All data is demo data.

## Run it
- **Windows:** double-click `start.cmd` in the project folder (installs on first run, builds the optimised site, then opens http://localhost:5173).
- **Any OS:** `npm install` once, then `npm start` (production build + preview). For development with hot reload: `npm run dev`.
- Checks: `npm run typecheck`, `npm run lint`, `npm test` (unit, component and mock-API tests), `npm run e2e` (Playwright at 375px and 1440px). Production build: `npm run build`, then `npm run preview`.
- Real API instead of the mock: `VITE_API_MOCK=false` (and `VITE_API_BASE` if it isn't `/api/v1`). See 04 §B.1.

## Documentation
| Doc | What |
|---|---|
| [01 UI/UX specification](01-ui-ux-specification.md) | Every screen, its states and copy |
| [02 User flows and navigation](02-user-flows-and-navigation.md) | Routes, parameters, flows, permissions, error paths |
| [03 Design system](03-design-system.md) | Tokens, components, tone |
| [04 Frontend architecture](04-frontend-architecture.md) | How the app is built; moving to production |
| [05 Components](05-component-documentation.md) | Each component, where it lives, its props and states |
| [06 API contract](06-api-integration-contract.md) | Endpoints, types, errors; the mock server and its test triggers (§9) |
| [07 Animations](07-animations.md) | Motion tokens, the iOS spring, the drawer and basket; instant page navigation |
| [08 Theming](08-theming.md) | Light, dark and system themes: tokens, runtime, contrast, what is deliberately not themed |
| [08 Unexpected-states audit](08-unexpected-states-audit.md) | What happens when payments, requests, sessions and data go wrong: what was fixed, what was left and why |
| [09 Authentication audit](09-authentication-audit.md) | The sign-in, sign-up, provider, reset, session and sign-out edge cases: what was fixed, what was left and why |
| [10 Reviews audit](10-reviews-audit.md) | Review eligibility, the form, submission outcomes and the review pages: what was fixed, what was left and why |
| [11 Performance audit](11-performance-audit.md) | Bundle, photo and request measurements before and after; what was changed, what was left and why |

> **Wedding halls are parked.** The hall toggle, nav/menu links and hall results are hidden by `config.features.halls` in `src/lib/config.ts` (set it to `true` to bring them back). Everything below that mentions halls describes the behaviour that returns when the switch is on; `?type=hall` is ignored while it is off.

## Pages
| Route | Page |
|---|---|
| `/` | Home |
| `/search` | Results (`?type=hotel|hall&city=&in=&out=&guests=&rooms=&sort=&maxp=&rating=&am=&pt=`) |
| `/stays/:id` | Hotel / hall detail (+ trip params) |
| `/stays/:id/reviews` | Guest reviews (`sort, tp, sc, topic, r`) |
| `/checkout` | Checkout for the whole basket (every stay in it, one payment) |
| `/orders/:id` | Confirmation of a checkout: a booking per stay |
| `/bookings/:ref` | Confirmation (`AV-XXXXXX`) |
| `/support` | Support: FAQs and a WhatsApp prompt, open to everyone (`/account/support` redirects here) |
| `/account/:tab` | My bookings / Favourites / Payment methods / Profile; all need an account (guests see a sign-in prompt) |
| `/signin`, `/signup`, `/forgot-password`, `/reset-password` | Sign in / Create account (incl. Google and Apple) / Request a reset link / Choose a new password |
| `/legal/terms`, `/legal/privacy` | Terms of Service / Privacy Policy (text in `src/features/legal/content.ts`; contact avorabookings@gmail.com) |

Full route and parameter rules: 02 §1. Code layout: 04 §A.3. Default dates are always today +3 to +5 nights, so the demo never goes stale.

## Audit issue → change → screen
| # | Live-site issue | What AVORA now does | Screen |
|---|---|---|---|
| 1 | Every physical room listed separately (Room 101…); duplicates | Rooms grouped by type: "Double Room · 6 available" with a quantity stepper; a "Recommended for you" group above "Other rooms" | Hotel |
| 2 | "Only 1 room left" on every card (fake urgency) | Scarcity text only when ≤ 2 remain (e.g. Family Suite at Jazeera); otherwise just "N available" | Hotel |
| 3 | $1 rooms, "Price on request", "0.0 (0)" ratings | Test data removed; a rating is shown only once a property has 3+ reviews (otherwise omitted, no placeholder); every price is real | Home, Search, Hotel |
| 4 | "Pay $2 now" vs "You won't be charged yet"; "Service fee $0" next to "Taxes included" | One message everywhere: "Pay $204 now · Free cancellation until Oct 13". Fee row hidden when it rounds to $0; the fee is only mentioned at checkout (no tax or fee wording on browse, hotel or sticky-bar screens) | Checkout |
| 5 | Internal copy ("room list will surface the right CTAs…") | Internal copy removed; the room list has no helper text under it, just the "Recommended for you" / "Other rooms" groups | Hotel |
| 6 | WhatsApp button covers fields | Floating button removed; WhatsApp is an icon in the header (left of the logo) on every page, so it can never cover a field; contextual "Contact hotel" on confirmation | All |
| 7 | Results start ~1,200px down under expanded filters | Filters in a bottom sheet behind "Filters (n)", Sort inline, results first; desktop gets the same panel as a sidebar | Search |
| 8 | No results summary; title echoes raw input | "4 stays in Mogadishu · Oct 14–16 · 2 guests" + inline Edit accordion; "Mog" resolves to Mogadishu in the title; hotels that are full for the dates are left out of the list | Search |
| 9 | Summary below Pay; first card is only optional notes | Collapsible summary on top (mobile) / sticky sidebar (desktop); order your details → payment → Pay (the notes box was later removed) | Checkout |
| 10 | Sticky "Book" greyed out, no feedback | "Select a room" button that scrolls to and highlights the rooms; then "1 room · $200 · 2 nights · Reserve" | Hotel |
| 11 | "Mogadishu 3" but search returns 2 | City counts computed from the same data the search uses | Home, Search |
| 12 | City combobox shows no suggestions | Working autocomplete (focus, typing, arrow keys, hotels, live counts) | Home, Search edit |
| 13 | Featured and Newest identical | Newest excludes Featured and sorts by date added | Home |
| 14 | Thin hotel page, blank photos | Gallery, description, amenities, check-in/out, rules, map placeholder, cancellation policy | Hotel |
| 15 | "Book" vs "Reserve" | "Reserve" everywhere | Hotel, Checkout |
| 16 | Menu lacks My bookings / Favourites / Support; wedding halls not browsable | Menu (and desktop nav) includes them; Hotels / Wedding halls toggle with its own data | All, Home |
| 17 | Phone field has no +252 hint | Fixed +252 prefix, placeholder, inline validation (accepts `61 555 0142`, `0615550142`, `+252…`), "Pay from a different number" | Checkout |

## Guests and accounts
Guests can still reserve and pay, but they get a deliberately thinner experience so that signing up is the obvious choice.
- **Guests**: checkout says "Booking as a guest" (email required: the booking details are sent **only by email**), with Sign in / create an account links. The confirmation is minimal (reference, hotel, dates, total) with no calendar, directions, hotel contact or copy buttons, and it exists only in that browser tab. Nothing is stored on the device: **no booking lookup, no booking list, no saved details**. The guest Bookings tab is just the **join prompt** (4 benefits with icons: view all bookings, manage payment methods, leave reviews, join the best platform).
- **Accounts** (`/signin`, `/signup`): email + password, or **Continue with Google / Apple** (simulated provider step, then "Almost done" asks for the mobile number providers never share). Every account has first name, last name, email and +252 mobile.
- **Signed in**: header shows the avatar + first name; checkout prefills from the profile, lists saved payment methods first and offers "Save this payment method to my account"; bookings join the account; **Payment methods** (add / make default / remove) and **Profile** (details, password, sign out, delete account) tabs appear.
- **One basket, many hotels.** Rooms from different hotels and dates share the basket and are paid in one checkout; each hotel becomes its own booking. **Joining brings the device basket along** (merged stay by stay). A guest booking made earlier is not merged: it only exists as the email. Guests have no favourites: the heart asks them to sign in.
- Try it: book as a guest (email required) → the confirmation offers **Create account** (prefilled from the booking) → the new account starts empty; bookings made while signed in appear in My bookings.
- **See the member experience in one tap:** on the sign-in page choose **For Developer: Demo Account** (it signs in with `demo@avora.example` / `avora demo pass` through the normal email login, which you can also type) or **For Developer: Google/Apple Demo** (the provider path: `demo.social@avora.example`, a Google/Apple-linked account with no password); both exist only with the mock API (`config.features.demo`). The first gives you Amina Hassan with upcoming and past bookings, three saved payment methods (one expired), two favourites, and a Home that shows **Your next trip**.
- **Planned, not built yet:** cancelling a booking from the confirmation page, one-time-code phone verification, and notification preferences.
- Security notes for the mock (PBKDF2 hashing, lockout, no account enumeration, safe redirects, booking access rules): docs/04 §A.6, docs/06 §5b and §9.

## Footer
A black footer on every page, modelled on avorabookings.com: brand + tagline, Company (Terms, Privacy), Support (Contact support, WhatsApp number, List your hotel), Your account (signed out: Sign in, Create account; signed in: My bookings, Favourites, Payment methods, Profile, Sign out; plus the language select) and the copyright line. See docs/01 (Global chrome) and docs/05 (Footer).

## Maps and scroll memory
- **Location** on the hotel page is an embedded Google Map. A property can carry `mapUrl` (any Google Maps link: `/maps/place/Name…`, `…@lat,lng…` or `?query=…`); the embed is derived from it, falling back to "name, address". Jazeera Palace Hotel uses an explicit link as the example. The keyless `output=embed` URL suits the demo; production should use the Maps Embed API with a key.
- **Scroll position** is restored on browser Back/Forward (per history entry) and when returning from the reviews page with "← Hotel name".

## Guest reviews
- **Hotel page → About this hotel → Guest reviews (last row of the card):** score badge, label, the 4 latest reviews (swipeable on mobile, 2 × 2 on desktop) and **Read all N reviews**. The `★ rating` by the hotel name opens the same page. Properties with fewer than 3 reviews show "New on AVORA" text instead.
- **`/stays/:id/reviews`:** (`?r=<reviewId>` jumps to one review, expands paging or clears filters if needed, and highlights it) score panel (rating, label, count), topic chips, score filter (bottom sheet on mobile), sort, 10-at-a-time paging, review text, hotel responses.
- Review data is **generated deterministically per property** by the mock server (`src/mocks/reviews.ts`) from lists of names, cities and phrases, so the rating, count and topic counts always agree. The generator nudges scores so each property's average equals its listed rating.
- Spec: docs/01 §3b · API: docs/06 §3.7 · components: docs/05 Part 3b.

## Search form controls
The form uses one **date-range field with a shared calendar** (two months on desktop, bottom sheet with 12 months on mobile; click check-in then check-out) and one **Guests & rooms popover** with steppers, instead of separate date inputs and dropdowns. See docs/01 and docs/05.

## Rooms selector
Hotel searches have a **Rooms** field (1–5, never more than guests) next to Guests, in the home form, the search page's inline Edit accordion and the hotel page's. It travels as `rooms=` and drives:
- the card price (total = per-room rate × nights × rooms, using the cheapest room type that holds guests ÷ rooms),
- availability (a hotel with fewer rooms left than requested moves to "Only N rooms left for your dates"),
- the hotel page's **Recommended for you** room group ("Best fit for 4 guests in 2 rooms"), shown above **Other rooms**.
Wedding halls have no rooms field.

## Notes for the developer
- Money is integer cents end to end; the service fee is 2% rounded to whole dollars and its row is omitted when it is $0. The server quote is authoritative (04 §B.3).
- Cancellation deadline = check-in minus `cancellation.freeUntilDaysBefore` (per property). If that is in the past, the UI says "Non-refundable".
- "Ocean View Inn" is permanently sold out in the mock data, to demonstrate the unavailable state. Test wallet numbers for declined, pending, timed-out and price-changed payments: 06 §9.
- Payments are simulated by the mock API. Card numbers and CVCs never reach the API layer: `src/lib/payments/hostedFields.ts` turns them into a token (the provider SDK replaces it in production). Saved cards keep only brand, last 4 digits and expiry.
- The mock account service hashes passwords with WebCrypto, which needs `localhost` or https.
- Rooms are grouped by type server-side (issue 1): availability returns `{roomTypeId, available, nightlyPrice}` per type.
- Photos are placeholders (fixed aspect ratios) until `images` are supplied by the API.
- Wedding halls reuse the property page: "rooms" become halls, price is per day, guests = capacity.
