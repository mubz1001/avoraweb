# 02 · User Flows and Navigation Map

Routes, transitions, what data travels with each hop, permissions and decision points. Browsing and booking are public: **guests can search, reserve and pay**, but they get a deliberately thinner experience than members. A guest's booking details arrive **only by email**: nothing is stored on the device, there is no booking lookup and no booking list. **Accounts** add: every booking in one place, add-to-calendar, directions and hotel contact, saved payment methods, a synced favourites and reviews of finished stays (§4.16).

---

## 1. Route map

| Route | Screen | Required params | Optional params | Reached from |
|---|---|---|---|---|
| `/` | Home | – | – | Logo, nav "Search", confirmation "Back to home" |
| `/search` | Results | – (falls back to last trip, then defaults) | `type, city, in, out, guests, rooms, sort, maxp, rating, am, pt` | Home form, city chips, nav "Wedding halls" (`?type=hall&city=`), Edit accordion |
| `/stays/:id` | Hotel / hall detail | `:id` | trip params (`type, city, in, out, guests, rooms`) | Any card, home autocomplete (property pick), reviews back link |
| `/stays/:id/reviews` | Guest reviews | `:id` | trip params, `sort` (`rel`\|`new`\|`old`\|`high`\|`low`), `sc` (`5`\|`4`\|`3`\|`low`), `topic`, `r` (review id to open) | Property page: rating next to the name, **Read all N reviews**, any review card |
| `/checkout` | Your details + payment for **the whole basket** (every stay in it) | – | – | Property page **Reserve**, basket **Checkout** |
| `/orders/:id` | Confirmation of one checkout (a booking per stay) | `:id` | – | Checkout; members' booking cards |
| `/bookings/:ref` | Confirmation | `:ref` | – | After payment, My bookings (members) |
| `/support` | Support (FAQs + WhatsApp) | – | – (open to everyone; `/account/support` redirects here) | Header, footer, drawer |
| `/account/:tab` | My bookings / Favourites / Payment methods / Profile | – (`/account` = bookings) | `:tab` = `bookings`\|`favourites`\|`payments`\|`profile`; all need an account (a guest sees a sign-in prompt) | Nav, menu, header account button, footer |
| `/signin`, `/signup`, `/signup/complete`, `/forgot-password`, `/reset-password` | Sign in / Create account / Google-Apple "Almost done" / Request a reset link / Choose a new password (`?token=` from the email) | – | `next` (an app path to return to) | Header Sign in, join prompts, checkout links, confirmation, gated tabs |
| `/legal/:doc` | Terms / Privacy | `:doc` = `terms`\|`privacy` | – | Footer, sign-up terms line |
| anything else | Not found | – | – | Old or mistyped links |

Clean paths only: old `*.html` pages do not exist and are not redirected. Query parameter names are unchanged, so trip and filter links read the same.

### Parameter reference

| Param | Format | Example | Rules |
|---|---|---|---|
| `type` | `hotel` \| `hall` | `hotel` | Default `hotel` |
| `city` | text | `Mog`, `Mogadishu`, empty | Resolved to a canonical city; empty = all cities |
| `in` / `out` | `YYYY-MM-DD` | `2026-10-14` | Past `in` resets to today+3; `out` ≤ `in` resets to `in`+2; halls ignore `out` (= `in`+1) |
| `guests` | integer | `4` | Hotels 1–8 (reset to 2 if more), halls ≥ 50 (reset to 200 if less) |
| `rooms` | integer | `2` | Hotels only; 1 to min(5, guests) |
| `sort` | `rec` \| `price-asc` \| `price-desc` \| `rating` | | Omitted = `rec` |
| `maxp` | integer | `150` | Omitted = no price cap |
| `rating` | `4` | | Minimum rating |
| `am` | comma list of amenity keys | `wifi,ac` | All must match |
| `pt` | comma list | `Hotel,Guesthouse` | Any may match |
| `:id` | property id (path) | `jazeera` | Unknown id → "We couldn't find that property" |
| `sel` | `roomTypeId:qty,…` | `double:2` | Quantities > 0 only |
| `:ref` | `AV-` + 6 characters from `A–Z` without I/O and `2–9` | `AV-5JPF4P` | Path segment, case-insensitive |
| `next` | app path + query | `/checkout` | Only known app paths starting with a single `/` are accepted (no scheme, host, `//`, backslash or control characters; auth pages excluded); anything else → `/account/bookings` (`lib/safeNext.ts`) |

**Where state lives:** trip, filters and order travel in the **URL** (shareable, survives refresh; filter changes use `replace`). Server data (properties, availability, quotes, the session, a member's bookings, favourites and payment methods) lives in the TanStack Query cache, fetched from the API. Convenience state lives in `localStorage`: last trip, the guest basket, language. Personal data is never put in a URL. See 04 for keys.

---

## 2. Navigation map

```
                         ┌──────────── Header (all pages) ────────────┐
                         │ Logo→Home · Search · Wedding halls ·        │
                         │ Support · WhatsApp · Basket · Account menu    │
                         │ (My bookings, Favourites, Payment methods, │
                         │  Profile, Support live in the account menu)   │
                         └────────────────────────────────────────────┘

 Home ──submit form (city)───────────────► Search ──card──► Hotel ──Reserve──► Checkout ──Pay──► Confirmed
   │                                          │  ▲            │  ▲                                 │
   │                                          │  └─Edit (inline)─┘  └─Edit dates (inline)           ├─► Calendar (.ics)
   ├──pick a property in autocomplete────────────────────────► Hotel                               ├─► Maps
   ├──city chip──────────────────────────────► Search                                              ├─► WhatsApp (hotel)
   ├──Featured / Newest card─────────────────────────────────► Hotel                               └─► My bookings
   └──toggle Wedding halls: same screens, type=hall

 Header basket ──Checkout──────────────────► Checkout      ──hotel name──► Hotel (#rooms)
 My bookings ──list row──────────────────────► Confirmed
 Favourites ───card────────────────────────────► Hotel
 Support ───────WhatsApp────────────────────────► wa.me (external)

 Header Sign in / join prompt / checkout "Sign in" ──► Login ──success──► back to `next`
 Login ──Continue with Google|Apple──► provider step ──known email──► back to `next`
                                                     └─new email──► Almost done (name + mobile) ──► back to `next`
 Header account button (≥ 768px) ──► Account menu ──► any account page · Sign out (guests: Create account / Sign in only)     Drawer / footer ──► Payment methods · Profile · Sign out
```

Transitions: page navigations are instant, on every device (07 §2.3). Browser Back / swipe-back use the browser's own animation.

Back behaviour: browser Back works everywhere because every step is a real navigation. Hotel → Back → Search keeps filters (they are in the URL). Checkout → Back → Hotel shows the same rooms (they are in the basket, §4.14). **Scroll position is remembered** per page and restored on Back and when returning from Reviews via **← hotel name**, so the guest lands where they left off.

---

## 3. Primary flow: search → reserve → pay (hotels)

| # | Screen | User action | System response | Decision / branch |
|---|---|---|---|---|
| 1 | Home | Types "Mog" | Autocomplete lists "Mogadishu · 4 stays" | No match → "No match – try Mogadishu, Hargeisa or Garowe" |
| 2 | Home | Picks dates in the shared calendar (check-in then check-out), sets 4 guests / 2 rooms in the guests & rooms popover, **Search** | Saves trip; navigates to Search with params | Picked a **property** instead of a city → skip to step 5 |
| 3 | Search | Reads summary "4 stays in Mogadishu · Oct 14–16 · 4 guests · 2 rooms" | Available stays listed with total price (stays full for the dates are not shown) | 0 results → empty state with city chips |
| 4 | Search | Opens Filters / changes Sort | List updates live, URL updates | Edit expands an inline panel to change dates/guests/rooms → re-search |
| 5 | Hotel | Reviews rooms; starts from **Recommended for you**, may use **Other rooms**, adjusts with steppers | Rooms go into the basket (header badge counts them); sticky bar becomes "$400 · 2 nights" + the trip pills + Reserve | Taps **Select a room** with nothing chosen → page scrolls to rooms (no dead button) |
| 6 | Hotel | **Reserve** | Navigates to `/checkout`, which pays for the whole basket (this stay and any others in it) | Hotel unavailable → bar shows **Change dates** instead |
| 7 | Checkout | Fills in their details; picks a payment method | Inline validation per field | Different wallet owner → the link "Pay from a different number" unfolds a second number field |
| 8 | Checkout | **Pay $408 now** | Validate → "Processing payment…" → create booking | Invalid → toast + focus first error. Declined → see §6 |
| 9 | Confirmed | Sees reference | Booking stored; actions offered | – |

Decision points that change the path: guest count vs room capacity (shown by the sticky bar's fit pill, never blocks), room availability vs rooms requested (hides the hotel from search), free-cancellation window (changes Pay-button sub-label and policy text), payment method (shows number vs card fields).

---

## 4. Secondary flows

### 4.1 Wedding halls
Home toggle **Wedding halls** (or nav/menu "Wedding halls" → `search?type=hall&city=`) → results for all cities (city optional) → hall page (choose Main Hall or Garden Hall; one per booking; price per day) → checkout/confirmation identical, with "day" and "event" wording.

### 4.2 Guest booking (email only)
Guest pays → **Confirmation** (reference, the full booking details a member sees except the account actions, "we've emailed your booking details", and the join prompt) → the booking details live only in the email. Reloading the page in the same tab keeps the summary; closing the tab loses it. There is no way back to a guest booking from the site (no lookup, no list).
Branches: a guest page opened after its tab was closed → "No booking found" with **Sign in** and **Start a booking**.

### 4.3 Favourites
**Members:** tap the heart on any card or hotel page → toast → saved to the account → Favourites tab shows cards → tap card → Hotel. Un-heart on the Favourites tab removes the card immediately. **Guests:** the heart opens "Sign in to save favourites" (**Sign in** and **Create account**, each returning to the page afterwards; an X in the corner dismisses it); they have no Favourites page. Favourites appear only here (`/account/favourites`), never on the Home page.

### 4.4 Change dates from a hotel page
Hotel → **Edit** (or **Change dates** when unavailable) → the trip bar expands (accordion) with dates, guests, rooms → each change saves by itself (no Update button): picking dates applies at once, guest and room taps apply 250ms after the last tap, the editor stays open so more can be changed, and the same hotel reloads with the new params. If the basket holds this stay, it moves to the new dates with its rooms; any no longer available for them are left out (§4.14).

### 4.5 Expired / invalid links
| Link | Result |
|---|---|
| `/checkout` with an empty basket | "Your basket is empty" + **Find a stay** |
| A stay's rooms are no longer available at checkout | A warning names the stay; Pay stays disabled and nothing is charged. **Edit** takes the guest to that hotel; **Remove** drops it (more than one stay) |
| A property in the basket is gone | "A property in your basket is no longer on AVORA" + **Remove it** |
| `/bookings/:ref` for a guest booking in this tab | The minimal guest confirmation (this tab only, `sessionStorage`) |
| `/bookings/:ref` for a booking that isn't confirmed (waiting for payment, payment failed, not confirmed · refunded, cancelled) | A status page that names the state and its next step (**Check again**, **Back to checkout**, refund note); never "Booking confirmed" |
| `/orders/:id` while the payment is waiting or failed | "Waiting for your payment" with **Check again**, or "Your payment didn't go through" with **Back to checkout**; no references, emailed-to line or booking actions |
| `/bookings/:ref` for a member booking | Signed out: "Sign in to view this booking" + Sign in. Signed in as someone else: "This booking isn't in your account" + My bookings (the API answers 401 / 404) |
| `/account/payments` or `/account/profile` signed out | Join prompt; after sign-in returns to that tab |
| `/signin` (or any auth page) while signed in | Redirects to `next` |
| `?next=` pointing off-site or to an unknown path | Ignored; returns to My bookings |
| `/signup/complete` without a pending Google/Apple sign-up | Redirects to `/signup` |
| `/stays/:id` with an unknown id | "We couldn't find that property" page |
| `/search` with unknown city text | "We couldn't find …" + city chips |
| Any other path (including the old `*.html` pages) | Not found page |

---

### 4.6 Reading reviews
Hotel page → (a) tap the **★ rating** by the name, (b) tap **Read all N reviews** in About this hotel, or (c) tap a review card or its "Read more" → **Reviews page, scrolled to that review** (`r=<reviewId>`; it is highlighted). There: sort, filter by type/score, toggle a topic chip, **Show more reviews**, mark reviews Helpful. **← Hotel name** returns to the hotel with the same trip, at the scroll position the guest left (there is no sticky bar on the reviews page). Properties with fewer than 3 reviews have no link and no reviews page content.

### 4.7 Create an account (email)
Any join prompt or header **Sign in** → Login (**Create account**) → first name, last name, email, +252 mobile, password → **Create account** → signed in, back to `next`, toast "Welcome to AVORA, Amina. Your account is ready."
Branches: invalid fields → inline errors; email already registered → field error + "Sign in instead" (keeps the email); storage blocked → error panel.
On joining, this device's basket merges into the account. A guest booking made earlier is **not** merged: it exists only as the email.

### 4.8 Continue with Google / Apple
Login → **Continue with Google** → provider step (email) →
- account with that email exists → provider linked, signed in → `next`;
- new → **Almost done** (first name, last name, mobile; the email comes from the provider) → **Create account** → `next`.
Branches: Back returns to the previous view; "Cancel and start again" drops the pending sign-up; it expires after 15 minutes ("That sign-up took too long").

### 4.9 Sign in / reset password
Login → email + password → `next`. Wrong details → generic error, password cleared; 5 failures for an email → locked 5 minutes. **Forgot password?** → email → "Check your email" (same answer for every email) → the emailed link opens `/reset-password?token=…` → new password → "Password updated" → Sign in. The link is single-use and lasts 30 minutes; a spent, expired or malformed one says "This link can't be used" with **Send a new link**. Resetting ends every session (this tab too) and clears a sign-in lock. **Sign out** only signs out once the server confirms: if the request fails the member stays signed in and a toast says so.

### 4.10 Guest becomes a member after booking
Confirmed (guest) → join prompt **Create account** → sign-up prefilled with the booking's name, mobile and email → create. The new account starts empty; future bookings (made while signed in) appear in My bookings.

### 4.11 Manage payment methods
Account → **Payment methods** → **＋ Add payment method** → choose WaafiPay / eDahab / card → wallet number or card details → (Use as default) → **Save payment method**. Per method: **Make default**, **Remove** → inline Keep / Remove. At checkout the saved methods are listed first with the default selected; a new method can be saved with "Save this payment method to my account".

### 4.12 Account menu and account pages
**Account menu** (≥ 768px; phones use the drawer): the header's account button ("Account" for guests, avatar + first name for members) drops a card listing every account page so each opens directly. Members: a card with name and email (informational, not a link), then **My bookings**, **Favourites**, **Payment methods**, **Profile**, a divider and **Sign out** (Support is in the header nav, so it isn't repeated). Guests: just **Create account** / **Sign in**: the menu exists to invite them to join, and Support and WhatsApp are already in the header. The current page is marked. It closes on the button, ✕, Esc, a press outside, any navigation, or when the basket opens.

**Account pages are one page** (`/account/:tab`): moving between sections shows the next section at once (they are prepared in the background) and each keeps its state; the URL follows each section.

### 4.12b Profile and account
Account → **Profile** → edit name / email (current password needed for a password account) / mobile → **Save changes**. **Change password** (password accounts). **Sign out** (also in the drawer and footer) → same page signed out, or My bookings when on a members-only tab. **Delete my account** → password → home; saved methods, favourites, basket and booking history are deleted too; confirmations already emailed stay valid.

### 4.13 Explore as a member (mock API only)
Login (either view) → **For Developer: Demo Account** (email login) or **For Developer: Google/Apple Demo** (provider login, as Omar Yusuf) → signed in as Amina Hassan with bookings, saved methods (one expired) and two favourites → back to `next`. Home then shows **Your next trip** (the hero is the same for everyone) (View booking / Directions / Contact hotel); the favourites are in the Favourites tab. Repeating it is safe (no duplicates). Delete account → guest view; the next sign-in recreates the member.

### 4.14 Basket (resume a booking)
One basket holds **stays at any number of hotels**, each with its own dates, party and rooms (one stay per property + dates; the same hotel on two date ranges is two stays). It keeps a booking in progress so the guest can always pick up where they left off, and it is paid in **one checkout** (4.15).
- **Adding:** room steppers on a hotel page put rooms in the basket as *that page's stay*; the header basket shows the room count across all stays (it takes the account icon's place on phones; the account is in the menu). Another hotel, or the same hotel on other dates, simply becomes another stay: nothing is asked and nothing is replaced. Changing one stay never touches another.
- **Editing a stay:** changing dates or guests on that hotel's page moves that stay with it (rooms kept). If the basket already holds the hotel on the new dates, the two are combined.
- **Basket panel** (tap the basket): drops from the header and floats on a shadow (the page is not dimmed).
  - **One hotel:** the plain layout. A **stay header** says it once, with no picture or price: the hotel name (a link back to its rooms), area, then 📅 dates · nights and 👤 guests · rooms. Below it only **rooms**, every row the same shape: 16:9 picture, name, "Up to N guests", beds, the stay total (bold), "$100 / night" (muted, "each" when more than one), and a stepper (to 0 removes it). Then subtotal · nights, service fee and total, and **Checkout · $408**.
  - **Several hotels:** one **card per hotel**, so each reads as its own block: a tinted header (name, area, dates, party), white room rows, and that hotel's **Subtotal · N nights**. Below the last card, once: **Subtotal · N stays**, service fee, **Total** and a single **Checkout · $X**. There is no Remove button: a room's stepper takes it out, and taking out a hotel's last room collapses the whole card away (the accordion motion). There is no Clear basket.
  - Closes on the basket, ✕, the backdrop, Esc, or any navigation.
- **States:** empty ("Your basket is empty" + "Add a room to see it visible here.", no button); loading (skeleton); a room sold out or with fewer left → flagged on the line, left out of the total, Checkout disabled until changed; fewer beds than guests → note, never blocks; dates passed → that stay shows "Your dates have passed" + **Choose new dates** and is left out of the total and of checkout ("N stays with dates that have passed won't be included"); hotel removed → note on that stay and Checkout disabled; prices failed → inline retry on that stay.
- **Where it lives:** guests on this device (every tab updates together); members on their account (every device). Signing in brings the device basket into the account **stay by stay**: stays only on one side are all kept, and a stay on both sides keeps the copy that changed last. Signing out leaves the account's basket on the account. At most 10 stays.
- **Ends:** stays leave the basket only when their payment is **paid**: at once for a card, or when the wallet approval arrives. While a mobile-money prompt is waiting, and if it is declined or expires, they stay in the basket; the others always stay.

### 4.16 Leaving a review
**Account › Bookings › Past stays** → **Write a review** on a finished, confirmed stay → review dialog for that booking → pick stars, write at least 30 characters → **Submit review** → "Thanks for your review" → **Done**; the card now shows "✓ Review sent". Members only (the page is members only), one review per booking (a server `409 ALREADY_REVIEWED` is shown as "Already reviewed" and the card updates the same way). ✕/Esc return focus to the button. What was typed is kept for the tab (reload, Back, an expired session) and dropped by an explicit sign-out. A lost connection or timeout reads "There was an unexpected error posting your review. Please try again later." and the same button resends it safely (one idempotency key until the server answers). There is no entry from hotel pages or the public reviews page. "Review sent" comes from the booking itself, so it shows after a reload and on every device; see 04 §A.5 and 06 §5b.

**Account › Bookings › Past stays** → **Rebook** on a finished, confirmed stay → the hotel page opens with the same room(s), guests and number of nights already picked, dates starting 3 days from today → change the dates if needed → **Reserve** → checkout.

### 4.15 Checkout and confirmation for the basket
**One checkout, one payment, a booking per hotel.** `/checkout` takes the basket's stays (not past dates) when it opens and keeps them: paying empties the basket, but the page does not change under the guest. It shows the **order summary** with one block per stay (hotel, dates, party, rooms, fee, subtotal and that booking's own cancellation terms; **Edit** and, with several stays, **Remove**) and one **Total**, then guest details and payment as before (one contact, one payment method). **Pay $X now** charges the total once.
- **Before charging**, the server prices every stay again and re-checks stock. If a stay's rooms are gone, nothing is charged and the warning names the stay. If a price moved, the new total is shown to accept first.
- **Paying twice is not possible:** a quote pays for one order; a retry with the same key gets the same answer; a second tap or tab is told the checkout was already paid (members are taken to it). If a mobile-money prompt was stepped away from, the guest can resume checking it.
- **Outcomes (never shown as confirmed unless the property confirmed it):** *confirmed* – every booking confirmed; *partly confirmed* – the payment went through but a property could not confirm one booking: that booking is marked **Not confirmed · refunded**, its total goes back to the payment method, the others stand; *not confirmed* – paid but no property confirmed: all refunded; *payment failed* – declined or timed out: nothing is booked or charged and the basket is kept; *waiting* – a wallet prompt not yet answered: nothing is shown as confirmed. Leaving or reloading while it waits does not lose it: back on checkout, "Your payment is still waiting for approval" offers **Check my payment** (kept for the tab, about 20 minutes).
- **Confirmation** (`/orders/:id`): one booking that confirmed keeps the single-booking page; otherwise a card per booking (its own reference, dates, rooms, total and cancellation terms; members get **View booking** and **Add to calendar**), what was paid and refunded, and for guests the join prompt.

## 5. Permissions and access

| Capability | Who | How enforced |
|---|---|---|
| Browse, search, view properties | Anyone | Public |
| Reserve and pay | Anyone (guest) or a signed-in member | Phone and email required (guests get their details by email only); an account is never required |
| View a booking | Its owning account only | Server: member session. Guests have no booking view: the confirmation is emailed. A short summary of the booking just paid for, in that tab (`sessionStorage`) |
| Change/cancel a booking | Same holder | Via WhatsApp to support/property today; production should add a cancel action on the confirmation page |
| Favourites | Per account (members only) | Guests are asked to sign in to save |
| Payment methods, profile | The signed-in member | Session; email change, password change and account deletion need the current password (re-authentication) |

Guests can always reserve and pay; the account is the better experience, not a gate. Guests are told so where it matters: a Sign in / Create account link at checkout, the join prompt as the entire guest Bookings tab, and on the guest confirmation, which is deliberately minimal (reference, hotel, dates, total, "check your email") next to a list of what an account adds.

---

## 6. Error and recovery paths

| Situation | Where | Recovery |
|---|---|---|
| Invalid form | Checkout | Toast, scroll/focus first error, nothing sent |
| Payment declined / not enough funds | Checkout | Inline panel above Pay; values kept; nothing charged; pay again or pick another method |
| Mobile-money prompt pending | Checkout | Form locked; "Approve the EVC Plus prompt on +252 61 *** 0142" with a countdown, **Resend prompt** (rate limited) and **Use another method**; polls every 3 s |
| Prompt not approved in time | Checkout | "We didn't get your approval in time" + **Send a new prompt** |
| Selected room sold out while on checkout | Checkout | Banner "Some rooms are no longer available" + **Choose rooms again**; nothing charged |
| Quote expired | Checkout | The quote refreshes (silently every 14 min, or on a `QUOTE_EXPIRED` answer) and the banner asks to check the total |
| Price changed | Checkout | Banner with the new total and **Continue with $X**; the next Pay uses the new quote and a new idempotency key |
| No network / server error / no answer within 20 s | Any | Failed loads show an inline card with **Try again** (queries retry twice first); a Pay that gets no answer retries once with the same idempotency key |
| Pay gets no answer at all | Checkout | "We couldn't confirm whether your payment went through"; details kept, and paying again replays the same request so nothing is charged twice |
| Wallet approval arrives but the order can't be loaded | Checkout | "Your payment was approved" + **Show my confirmation**; Pay stays hidden so it can't be paid twice |
| Wallet prompt expires | Checkout | The screen waits for the server's answer ("This request has run out of time. We're checking…"); only the server's `TIMEOUT` ends it |
| Session ended while paying | Checkout | "Your session has ended" + **Sign in**; the form and basket are kept |
| Session ended elsewhere | Any member page | The app signs out (all tabs) and members-only tabs show the join prompt |
| A photo fails to load | Cards, gallery, confirmation | The coloured tile shows instead of a broken image |
| A favourite can't be saved | Heart | It reverts and a toast says so |
| A review gets no answer | Review dialog | "There was an unexpected error posting your review. Please try again later." the review is kept, resending is safe |
| "Show more reviews" fails | Reviews page | The loaded reviews stay; "We couldn't load more reviews." + **Try again** |
| Clipboard blocked | Confirmation | Toast shows the reference to copy manually |
| Wrong email/password; too many attempts | Login | Generic error, password cleared and focused; after 5 failures wait 5 minutes |
| Session expired or signed out in another tab | Any | Every open tab re-renders signed out (BroadcastChannel); members-only tabs show the join prompt |
| The session check itself fails (offline, 5xx) | Account tabs | "We couldn't check your account" + **Try again**, not the sign-in prompt |
| Sign out fails | Menu, drawer, footer, Profile | Stays signed in; toast "We couldn't sign you out. Check your connection and try again." |
| Saving a payment method fails at checkout | Checkout | The booking still goes through; the method is just not saved |

---

## 7. Entry points and analytics events (suggested)

Events worth tracking, one per decision point: `search_submitted`, `filters_applied`, `result_opened`, `room_selected`, `recommended_used`, `reserve_clicked`, `checkout_started`, `field_error{field}`, `payment_method_chosen`, `payment_submitted`, `payment_failed{reason}`, `booking_confirmed`, `favourites_toggled`, `join_prompt_viewed{where}`, `signup_started{method}`, `signup_completed{method}`, `signin{method,success}`, `password_reset_requested`, `payment_method_saved{kind,where}`, `account_deleted`. Funnel: search → result_opened → room_selected → reserve_clicked → payment_submitted → booking_confirmed.
