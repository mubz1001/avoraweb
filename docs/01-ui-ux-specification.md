# 01 · UI/UX Specification

Defines every page, component behaviour, form, accordion, loading / empty / error state. Source of truth is the app in this repo; where it still relies on the mock API or a placeholder, the **Production note** says what the real build must do.

Conventions: "mobile" = under 768px, "desktop" = 768px and up (see 03 Design System for the other breakpoints). Prices are USD. Dates are local to the property. "Trip" = `{type, city, in, out, guests, rooms}`.

---

## Global chrome (every page)

| Element | Mobile | Desktop |
|---|---|---|
| Header (black, sticky) | Logo + "AVORA" left; WhatsApp icon, **basket**, menu button right (no account icon: the menu has the account) | Logo left; nav links (Search, Wedding halls, Support, then **List your property**, which opens `hotels.avorabookings.com/?signup=1` in a new tab; the account's pages are not in the nav), then **WhatsApp** (icon only), **basket**, and the **account button at the far right**, which opens the **account menu**; no menu button |
| Account button | Signed out: person icon → Sign in (returns to the current page). Signed in: avatar initial → Profile | Signed out: pill "👤 Sign in". Signed in: pill with avatar + first name (ellipsis after 120px). Shown on every page, the sign-in page included, so the header never shifts |
| Menu drawer | Slides in from right on a white surface (no logo; ✕ top right). Top: signed out → grey **join box** ("Get more with an account"; stacked full-width: **Create account** outlined, **Sign in** black below it, on every page including the sign-in pages: it is never hidden, so the drawer looks the same wherever you open it); signed in → avatar, full name and email (not a link; Profile is in the list below), untinted, with a divider line under it. **Members** get four sections set apart by divider lines: **Search** (· Wedding halls); an account section (no heading; the divider lines are enough) with My bookings, Favourites, Payment methods, Profile; **Support** (WhatsApp is the header icon; the drawer has no chat row and no phone number, which stays in the footer); and, in a section of its own, **List your property** (opens the host site in a new tab). **Sign out** is pinned to the bottom of the drawer under its own divider, in a quieter weight. **Guests** have no account section: Search · Support · WhatsApp, a divider, then List your property. The current page's link is highlighted. Closes on backdrop tap, ✕, or Esc | not shown |
| WhatsApp | Icon only, opens `https://wa.me/252610999082` in a new tab | Icon only, in a 38px outlined circle (the number appears in the footer) |
| Footer (black, every page) | Four sections stacked: brand + tagline · **Company** (Terms, Privacy) · **Support** (Contact support, "WhatsApp: +252 61 099 9082", "List your hotel on AVORA") · **Preferences** (the **Language** select: English / Soomaali / العربية, and the **Appearance** select: System / Light / Dark; no account links); then "© {year} AVORA. All rights reserved." | Same content in 4 columns (≥ 960px) or 2 columns (≥ 560px) |

The footer mirrors the live site's footer (avorabookings.com). Behaviour: Terms/Privacy open `/legal/terms` and `/legal/privacy` (each page: title, "Last updated", an "In short" card, a numbered "On this page" list that jumps to the sections, then the numbered sections; no tab switcher, the footer and the sign-up line link to both); Contact support opens the Support page (`/support`); the WhatsApp number opens `https://wa.me/252610999082`; "List your hotel…" opens `https://hotels.avorabookings.com/?signup=1` in a new tab; the language select switches the site to Somali or Arabic at once (Arabic right-to-left) and saves the choice (`avora.lang`). When wedding halls are re-enabled the tagline and the list link say "hotels & wedding halls" / "hotel or hall". On the hotel page the footer has extra bottom padding so the sticky bar never covers it.
| Toast | Dark pill above the bottom bar (`role=status`), auto-dismisses in 2.2 s, used for confirmations ("Added to favourites", "Reference copied", "Welcome back, Amina", "You've signed out") and form-level errors ("Please fix 2 fields"). A toast can be queued for the next page (after sign-in, sign-out, profile save) | same |

There is no floating button. Nothing overlays form fields.

---

## 1. Home (`/`)

**Purpose:** start a search; browse featured and newest listings.

**Layout (top → bottom):** black hero with the headline **"The best booking platform in Somalia"** and the line "Discover stays across Somalia, book with confidence and pay with EVC Plus, ZAAD, SAHAL, eDahab or card." (the same for everyone: it does not change when signed in; wedding-hall mode, when enabled, has its own hall wording) → white search card overlapping the hero → **Your next trip** (only with an upcoming booking) → Popular cities → Featured → Newest → three trust cards.

**Signed-in members** (**Your next trip** is members only, because guests have no bookings to show; favourites live only in the Favourites tab, never on Home)
- **Your next trip:** one card for the soonest upcoming booking (a member's own upcoming bookings, the same list as My bookings). Image (16:9 on mobile; 200px square at the side from 768px), a status chip ("Check-in in 3 days" / "Check-in tomorrow" / "Check-in today" / "You're staying here now · check-out Oct 16" / "Check-out today"), hotel name (links to the booking), area and city, a facts row (dates, guests · rooms, "Check-in from 14:00"), then **View booking** (primary, full width on mobile), **Directions** (ghost) and **Contact hotel** (green WhatsApp). Hidden when nothing is upcoming.

**Search card**
- **Type toggle** (Hotels / Wedding halls, `role=tablist`; **hidden while `config.features.halls` is off**, so the search is hotels-only). Switching preserves what was typed, swaps copy, fields, data and counts, and re-renders the sections below.
- **Fields (hotels):** City or hotel (combobox, pin icon) · **Check-in – Check-out** (one date-range field) · **Guests & rooms** (one field) · Search.
- **Fields (halls):** City (optional) · **Event date** (single-date field) · Guests · Search. No range, no rooms.
- **Defaults:** city Mogadishu, check-in today+3, check-out today+5, 2 guests, 1 room (halls: 200 guests, event day = check-in).
- **Search card styling:** a 2px black outline (`--ink`) surrounds the home search card; all three field labels share one style (13.5px, 600).
- **Layout:** desktop = one row (city | dates | guests & rooms | Search). Mobile = stacked, full-width fields, Search last. Dropdown controls use a custom chevron, never the browser default.

**Field typography:** every field in the search form (city, dates, guests & rooms) uses the same text style, 15px / weight 550, in the home form and in the Edit panels on Search and the hotel page; placeholders are regular weight in `--muted`. The Edit panel keeps generous padding (18px top, 22px bottom) and each field is at least 300px wide on desktop so the date range never truncates.

**Date-range picker (booking.com style)**
- The field label shows the stay length and updates when a range is picked: `Check-in – Check-out · 2 nights`.
- One field shows `Wed, Oct 14 → Fri, Oct 16`. Tapping it opens **one shared calendar** for both dates.
- **Desktop:** popover under the field with two months side by side, circular prev/next buttons in the month headers (prev disabled at the current month, next at 11 months ahead), a footer with the summary ("2 nights · Wed, Oct 14 – Fri, Oct 16") and **Clear** + **Done**.
- **Mobile:** bottom sheet ("Select dates", ✕) with 12 months stacked in a scroll area, same footer; the backdrop closes it.
- **Selecting:** 1st click = check-in (summary "Select your check-out date"); 2nd click later than check-in = check-out; the calendar stays open and the summary shows the range. A click on the same or an earlier day restarts the range. The calendar **never closes by itself**: **Clear** (left of Done) empties the selection, and **Done**, enabled once the range is complete, applies it and closes. Dates before today are disabled and greyed. While choosing check-out on desktop, hovering previews the range.
- **Look:** range ends are black pills (rounded on the outer side), days in between a light-grey band, today is bold, hover shows a ring.
- The field only changes when **Done** is pressed with a full range; closing any other way (Esc, outside click, ✕) keeps the previous dates. Halls: a single click picks the day and Done applies it. The footer summary is black and bold ("7 nights · Thu, Oct 15 – Thu, Oct 22"), on its own line above full-width Clear / Done on phones.

**Guests & rooms popover**
- One field shows `2 guests · 1 room`. Opens a popover with a **Guests** stepper and a **Rooms** stepper (halls: Guests only, steps of 50, 50–500).
- Hotels: guests 1–8, rooms 1–5 and never more than guests (lowering guests lowers rooms). − / + disable at their limits. **Done** closes; outside click or Esc also closes.
- Only one popover (calendar or guests) can be open at a time.

**City combobox (autocomplete)**
- Opens on focus (shows all cities with live stay counts, e.g. "Hargeisa · 3 stays"), filters as you type, adds a "Hotels" / "Wedding halls" group when the text matches a property name.
- Keyboard: ↑ ↓ move, Enter selects, Esc closes. Mouse/touch selection does not blur the field.
- Selecting a **property** and submitting goes straight to that property's page; selecting a **city** goes to results.
- Empty match: a single non-clickable line "No match – try Mogadishu, Hargeisa or Garowe".

**Popular cities:** chips "Mogadishu · 4 stays". The count is the number of listings that city's search returns for the current type, so it always equals the result count.

**Featured / Newest:** three cards each, never overlapping (Newest excludes Featured, sorted by date added). Cards show "From $X / night" (halls: per day) because no dates are committed yet.

**States**
| State | Behaviour |
|---|---|
| Loading | Production: skeleton cards (3) in each section; hero and search card render immediately |
| Empty (a type has no featured items) | Section is omitted |
| Error | Production: inline "Couldn't load stays. Retry" in the section; search still works |

---

## 2. Search results (`/search`)

**Purpose:** compare available stays for the chosen trip.

**Summary bar:** `4 stays in Mogadishu · Oct 14–16 · 4 guests · 2 rooms` (halls: date and guests, no rooms) with an **Edit** button. The title counts only stays that can be booked for the trip. The document title is the same summary, never the raw typed text. Typed text is resolved ("Mog" → Mogadishu; empty → "all cities").

**Toolbar:** `Filters (n)` button (mobile only; `n` counts active filter groups, label is plain "Filters" at zero) and Sort select (Recommended, Price low→high, high→low, Guest rating). Sort stays visible on both breakpoints.

**Filters**
- Property type (Hotel / Guesthouse / Apartments; hotels only) · Max price per night/day (range) · Guest rating (Any / 4.0+) · Amenities (6 shown, "Show all (12)").
- **Mobile:** bottom sheet (max 86vh, header with Clear all and ✕, scrollable body, footer button "Show N stays"). Closes via footer button, ✕, backdrop, Esc.
- **Desktop:** same panel as a sticky 260px left sidebar.
- Changes apply instantly; state is written to the URL (`sort, maxp, rating, am, pt`) with `replaceState`, so refresh and share work. "Clear all" resets.

**Result card** (photo, name, "area, city", rating if 3+ reviews, two amenity chips, price block, heart)
- Price block (available): **total for the stay** (`$400 total · 2 nights · 2 rooms`) and the per-room nightly rate. **No cancellation text on cards**: the policy is shown on the hotel page only.
- Whole card is one link (stretched title anchor); the heart is a separate control with `aria-pressed`.
- Layout: horizontal on both. The photo is a **square thumbnail** (mobile 112px, desktop 200px), inset with 10px radius and top-aligned like booking.com, never stretched to the card height. Desktop price is right-aligned.

**Unavailable hotels are hidden.** Search lists only stays that can be booked for the trip: ones that are sold out, blocked, or have fewer rooms than the trip asks for are left out, and the count in the title follows. Opening such a stay directly still shows its "Not available" state (see Property).

**Edit (inline accordion):** the **Edit** button in the summary bar expands, in place, a panel containing the search form (city, date-range field, guests & rooms; submit "Search"). The calendar and guests popovers open on top of the panel. The panel animates open/closed (height, 0.3 s; instant under reduced motion), the button reads **Close** while open (`aria-expanded`/`aria-controls`), contents are unreachable by keyboard while closed. There is no modal or overlay. **Change dates** links on unavailable cards open the same panel.

**States**
| State | Behaviour |
|---|---|
| Loading | Production: 4 skeleton cards; summary bar shows the typed trip with "Searching…" |
| No results | Card: "We couldn't find "xyz"." or "No stays match these filters." + "Try another city or clear your filters." + city chips |
| All unavailable | Card: "Nothing is available for Oct 14–16." + "Try different dates, or another city." + **Change dates** (opens the Edit accordion) + city chips |
| Error | Production: card with message and Retry; filters remain usable |

---

## 3. Hotel / hall detail (`/stays/:id`)

**Purpose:** show enough to decide, and pick rooms.

**Order (top → bottom):** gallery (no back link; the browser Back button and header handle navigation) → name, rating (if any; **tapping it opens the reviews page**), heart (the area and city are shown in Location below) (the single yellow ★ in the rating is the only star; there are no grey star-rating glyphs) → the about card (no heading; one container, see below: guests read the facts first) → **rooms**, which open with the trip bar (dates · guests · rooms, **Edit** → inline accordion that expands the form below the bar) so the trip is right above the choices it affects (no section heading; the recommended room type first, marked "Recommended for you"). A sticky bar is fixed at the bottom.

**Gallery:** mobile = swipeable carousel with "1 / 5" counter; desktop = 1 large + 4 small grid. Photos are CSS placeholders until the API supplies images (4:3). **Tapping a photo opens the lightbox** (full-screen over the page, which stays visible behind it softly blurred): counter, previous / next, swipe (changes photo with a cross-fade) or arrow keys, a thumbnail strip, zoom and pan (pinch or double tap on phones; zoom buttons not on phones), Esc / ✕ / backdrop to close. A room's photo opens it on its own.

**Rooms section**
- **Two groups, each with its own subheading:** **Recommended for you** (the best-fit room type, with a muted line "Best fit for 4 guests in 2 rooms") followed by **Other rooms** (every remaining type). There is no separate recommendation box and no one-tap "Select" chip; the guest uses the stepper like on any other card. If only one type exists, or nothing is available, the groups are omitted and cards are listed plainly. Halls use "Other halls".
- **Room card** per **room type** (never per physical room): photo labelled with the room type; title + availability ("Double Room · 6 available") ; row of bed, "Up to N guests" and size icons; features as grey **pills** ("Air conditioning", "TV"); scarcity chip **only if ≤ 2 left** ("Only 1 left"); price row (the stay total, then the nightly rate). Cancellation terms are not repeated on room cards: they are in the page's Cancellation section and at checkout with a **quantity stepper** (− / count / +).
- Stepper: − disabled at 0, + disabled at availability. Halls allow exactly one selection.
- **Sold-out type:** orange "Sold out" chip, no stepper.
- **No availability at all for the trip:** orange panel "Not available for Oct 14–16" with **Change dates**; sticky bar shows "Not available" and the button changes to **Change dates**.

**Sticky bar** (all breakpoints)
| State | Left | Button |
|---|---|---|
| Nothing selected | "From $80 / night", then the **trip pills** showing the search: two pills: "📅 Oct 27–29" and "👤 4 │ 🛏 2" | **Select a room** (halls: "Select a hall") → smooth-scrolls to rooms and briefly highlights the cards |
| Selected | "$400 · 2 nights", then the trip pills: two pills: "📅 Oct 27–29" and "✓ 4/4 │ 🛏 2/2" (guest segment green), a 2px fill bar under the guests and rooms segments | **Reserve** → checkout |
| Guests short | the guest segment turns orange ("👤 2/4"). Room cards carry no hint, so nothing shifts as the selection changes. Never blocks | Reserve |
| Unavailable | "Not available · for your dates" | **Change dates** |

**Desktop only:** a sticky "Your stay" card in the right column mirrors the selection (or shows "From $X" and "Select a room to see your total").

**Editing from the bar:** the bar holds two separate pills. The **dates pill** opens the same calendar as the search form (bottom sheet on phones, rising above the bar on desktop; Done applies). The **guests & rooms pill** opens the same guests & rooms panel as the search form (a bottom sheet on phones, a popover rising above the bar on desktop) with no hint text (the pills' green/orange state is the indicator). Guests & rooms apply as the steppers move, dates on Done, like the trip card's Edit: the URL, the trip card, the basket (its rooms move to the new dates) and the pill all update, while the room list keeps the last availability on screen until the new one arrives (no skeleton flash, no dropped picks). Hidden for halls and when the stay is unavailable.

**Fit rules:** beds = Σ selected rooms × the room type's max guests. Only guests can warn: fewer rooms than searched is fine when the beds are there (one family suite for four reads "4/4 guests · 1/2 rooms"), and more rooms than searched shows as "3/2 rooms" with a full bar. The pill lives only in the sticky bar (the desktop "Your stay" card and the basket panel don't show it; the basket keeps its own "Up to N guests – you have M" note). Halls show no pill.

**Selection persistence:** stored per hotel + dates, so Back from checkout restores it.

---

**About this hotel (halls: "About this venue")** is one white card under one large heading, with thin divider lines between sub-sections that have smaller headings: **Overview** · **Amenities** (halls: Services) · **Check-in & check-out** (halls: Event times) · **Location** (embedded Google Map and the address; no separate "open in maps" text link, the embed has its own button) · **Cancellation** · **Guest reviews** (last).

---

## 3b. Guest reviews (`/stays/:id/reviews`)

**Purpose:** let guests read what other guests said before they book, modelled on booking.com's review page.

**On the hotel page** (inside "About this hotel", as its **last** sub-section, after Cancellation, titled **Guest reviews**):
- Summary: a dark score badge (`4.6`), the word label (Exceptional ≥ 4.7, Excellent ≥ 4.4, Very good ≥ 4.0, Good ≥ 3.5, Okay ≥ 3.0, else Poor) and "212 reviews". Reviews are **just a star rating plus written comments**: there are no category scores or bars anywhere.
- The **4 latest** reviews as compact cards: avatar initial, first name, city, score pill (`★ 5`), title, a 3-line excerpt and a "Read more" link. **Mobile:** a horizontal swipe row with scroll-snap (cards 82% wide so the next one peeks). **Desktop:** a 2 × 2 grid. Tapping a card (or its "Read more") opens the reviews page **at that exact review**: the page scrolls to it, loads more reviews if it is further down, clears any filters hiding it, and highlights it with a brief ring (`?r=<reviewId>`, newest-first sort).
- Button **Read all 212 reviews** (ghost, full width) → reviews page.
- Properties with fewer than 3 reviews show only "New on AVORA – reviews appear after guests have stayed." (no score, no cards, no button, and the rating next to the name is also omitted).
- The **rating next to the hotel name** (`★ 4.6 (212)`) is a link to the same page.

**Reviews page layout (top → bottom):** back link "← Hotel name" (returns to the hotel with the same trip) → H1 "Guest reviews" + hotel name/area → **score panel** (big badge, word label, review count; no sub-scores) → **"Mentioned in reviews"** topic chips with counts (hotels: Breakfast, Location, Staff, Wi-Fi, Backup power, Cleanliness, Value; halls: Venue & space, Stage & sound, Catering, Parking, Staff, Decoration) → toolbar (**Filters (n)** on mobile, **Sort** always) → review list. The reviews page has **no sticky bar**; guests go back to the hotel with the "← Hotel name" link (which restores their scroll position).

**Filtering and sorting**
- **Sort:** Most relevant (longer, more detailed reviews first, then newest) · Newest first · Oldest first · Highest scores · Lowest scores.
- **Filters:** review score (All / 5 / 4 / 3 / 2 or less). **Topic chips** toggle one topic at a time (pressed = black chip). On mobile, filters are the bottom sheet used on Search (title, Clear all, ✕, footer button "Show N reviews"); on desktop a sticky 260px sidebar.
- Everything applies instantly, resets paging, and is written to the URL (`sort`, `tp`, `sc`, `topic`) so a filtered view can be shared. The count line reads "126 reviews" or "21 reviews match your filters" and announces changes (`aria-live`).

**Review card:** avatar, first name, score pill → meta line "Room type · N nights · Month Year" → title → "Reviewed Oct 11, 2026" → the review text, one paragraph → optional collapsible **"Response from {hotel}"**.

**Paging:** 10 reviews at a time; **Show more reviews** appends 10 more and disappears when all are shown.

**States**
| State | Behaviour |
|---|---|
| No reviews match filters | Card "No reviews match these filters" + **Clear filters** |
| Property has < 3 reviews | Page shows "No reviews yet" + "Reviews appear after guests have stayed." + link back |
| Unknown `id` | "We couldn't find that property" + Back to home |
| Loading (production) | Skeleton score panel and 3 skeleton cards; filters stay usable once loaded |
| Error (production) | Inline retry card; summary from the property endpoint still shown |

---

## 4. Checkout (`/checkout`)

**Purpose:** collect the booker's details and payment for **the whole basket** (stays at one or several hotels), then charge once.

**Steps:** three numbered dots joined by a line with the step name underneath: ✓ Choose room (done: ringed check) · **2 Details & payment** (now: solid dot, bold label) · 3 Confirmation (next: grey). Phones keep the labels on one or two lines under each dot.

**Order summary**
- Mobile: first element, a collapsible card. Collapsed shows "Order summary · hotel · dates" (several stays: "2 stays · hotel names") and the **total**; expanded shows, **per stay** (its own card when there are several; photo, hotel and area first, then dates and guests, then money), property, dates, guests, check-in/out times, one line per room type (`2 × Double Room · $100 × 2 nights · $400`), the service fee row **only if ≥ $1**, that stay's subtotal and its own cancellation line ("Free cancellation until Oct 13." or "This booking is non-refundable."), with **Edit** (and **Remove** when there is more than one stay); then one **Total** and "You'll be charged $408 now." (several stays: "…now, once, for 2 bookings."). The stays are taken from the basket when the page opens and kept, so paying (which empties the basket) never changes the page.
- Desktop: always open, sticky 360px right column.

**Form order:** 1 Guest details → 2 Payment → Pay. **Rooms that sell out** between the basket and Pay: the summary warns, naming the stay ("Rooms in some of your stays are no longer available. Change or remove Lido … Nothing has been charged."), Pay is disabled until it is edited or removed, and the other stays are untouched. **Confirmation** (`/orders/:id`): one confirmed booking keeps the single-booking page; several bookings, or a checkout where a property couldn't confirm one, show a card per booking and say plainly what was refunded (02 §4.15).

**1 · Your details** (guests can book and pay; an account is never required, but guests are given less)
- No info panel when signed out (the checkout stays uncluttered; sign-in lives in the header and the confirmation page invites guests to join).
- Signed in: no info panel. Name, mobile and email are prefilled from the profile and stay editable (the guest may not be the account holder).
- Full name (required, ≥ 3 chars, placeholder "Enter your name") · Mobile (required) · **Email (required)**: guests receive their booking details **only by email**. Fields have no hint lines.
- **Digit cap:** every mobile field stops accepting digits once the country's number is complete (Somalia 9; Kenya, Ethiopia, Uganda, Tanzania, UAE, Saudi Arabia 9; United States, Canada, United Kingdom, Türkiye 10; Egypt 10; Djibouti, Qatar 8; Eritrea 7; any other country 12). Spaces, a leading 0 and a pasted +252 don't count, and a longer paste is cut at the limit.
- Mobile starts with a **country code picker** (default **+252**, the native select of **every country**: a **Most common** group first (Somalia, Kenya, United States, United Kingdom, Canada), then **All countries** A–Z with those five in it again; country names come from the browser, `lib/phone` `DIAL`). Somalia: accepted input `61 555 0142`, `0615550142`, `+252 61 555 0142`; valid = 9 digits starting 6 or 7 after stripping `252` and leading zeros; formatted to `61 555 0142` on blur. Other countries: 6–12 digits after the code (a leading 0 is dropped), no regrouping, message "Enter your mobile number without the country code." The booking, sign-up and profile send E.164 (`+447700900123`), and the API rejects a phone that is not valid E.164.
- **Wallets are Somali.** When the contact number is not +252, it can't pay: the "Wallet number" field opens by itself (required, +252 only) and the "Pay from a different number" link is hidden.

**2 · Payment**
- Signed in with saved methods: a **Saved** group comes first (icon, "EVC Plus" + "+252 61 555 0142", or "Visa •••• 4242" + "Expires 08/29", **Default** chip). The default method is preselected; an expired card shows an orange **Expired** chip and cannot be chosen. Then the heading **Add a new method** and the tiles below.
- **One set of tiles**, three per row: **EVC Plus · ZAAD · SAHAL · eDahab · Premier Wallet · Card**. People pick the wallet they use by name: the provider behind it (WaafiPay or eDahab) is never shown, and there is no second level of choice. Plain white tiles; the chosen one gets an ink outline. Card fields appear under the tiles only when **Card** is chosen.
- Wallets: the guest's number is used, and one muted line says what will happen: "You'll get an EVC Plus prompt on +252 61 555 0142 to approve $408." Under it, the text link **Pay from a different number** unfolds (the shared accordion motion) a separate +252 field (validated the same way; the link then reads **Use my mobile number instead**). A saved wallet uses its own number (no link).
- Card: number (digits only, grouped 4-4-4-4; a valid Visa or Mastercard number: 16 digits, Luhn check; no hint line under the field), expiry `MM/YY` (auto-slash, month 01–12, not in the past), CVC 3–4 digits.
- Signed in, new method: checkbox **"Save this payment method to my account"** (off by default). Saving never blocks the booking (a duplicate is simply not saved again).

**Pay button** (full width, 58px, one line): **"Pay $408 now"**. The cancellation terms live in the order summary, not on the button. It scrolls with the page (it is not sticky); there is no reassurance line beneath it.

**Validation**
| Field | Rule | Message |
|---|---|---|
| Name | ≥ 3 chars | Enter your full name. |
| Mobile | see above | Enter a 9-digit Somali mobile number starting with 6 or 7, e.g. 61 555 0142. |
| Email | `x@y.z` if present | That email doesn't look right. |
| Payment number | same as mobile, when the toggle is on | Enter a 9-digit Somali mobile number starting with 6 or 7, e.g. 61 555 0142. |
| Card number | 16 digits, Luhn-valid, Visa (4…) or Mastercard (51–55, 2221–2720) | Enter a valid 16-digit Visa or Mastercard number. |
| Expiry | `MM/YY`, not before the current month | Use MM/YY. · This card has expired. |
| CVC | 3–4 digits | 3–4 digits. |

Timing (shared by every form in the app: checkout, sign-in, profile, payment methods): a field validates on **blur**; once it is invalid it re-validates on **every keystroke** so the error clears as soon as it's fixed. Valid touched fields get a green border. On submit with errors: toast "Please fix N field(s)", scroll to and focus the **first invalid field on screen**. Nothing is submitted. Each input is tied to its hint and error text with `aria-describedby` and flagged with `aria-invalid`.

**Pay in progress:** button disabled (`aria-busy`), label "Processing payment…", the form sections are locked (`inert`) so nothing can change or be submitted twice, ~1 s, then redirect to Confirmation.

**Empty / expired:** if `hotel` or `sel` is missing, a card says "Your selection expired" with **Find a stay**.

**Payment states:** declined or not enough funds (inline panel above Pay, "Nothing has been charged", form kept); mobile-money prompt pending (the form locks and the Pay area becomes "Approve the EVC Plus prompt on +252 61 *** 0142" with a countdown, **Resend prompt** and **Use another method**; it polls until approved, then opens the confirmation); prompt not approved in time ("We didn't get your approval in time" + **Send a new prompt**); price changed (banner with the new total and **Continue with $X**); rooms gone (banner + **Choose rooms again**); no answer from the server ("We couldn't confirm whether your payment went through", details kept, Pay again checks the same payment first); a wallet payment left waiting ("Your payment is still waiting for approval" + **Check my payment**); approved but the confirmation can't load ("Your payment was approved" + **Show my confirmation**); session ended ("Your session has ended" + **Sign in**, form and basket kept). Test wallet numbers for each state: 06 §9.

---

## 5. Confirmation (`/bookings/:ref`)

Members: green tick → "Booking confirmed" ("Booking complete" once the stay is over) → reference in large monospace (`AV-5JPF4P`) → "Confirmation emailed to …" → three actions → details card → cancellation card → two full-width buttons: **Book more rooms** (left, to home) and **View my bookings** (right). The page ends at those buttons, with no extra space beneath them. **Guests get a much shorter page** (see "Guest booking" below).

- **Add to calendar:** downloads an all-day `.ics` (check-in → check-out), toast "Calendar file downloaded". Not shown once the stay has ended (check-out before today), on the booking page and in the multi-booking confirmation alike.
- **Get directions:** opens Google Maps search for name + address in a new tab.
- **Contact hotel:** WhatsApp to the property with the reference prefilled (green button).
- Details card: the hotel's photo (16:9, the booking's `property.image`, else the coloured tile) above the hotel name, then dates, check-in/out, guests, one line per room type, fee (if any), "Paid with EVC Plus · +252 …" (cards: "Paid with Visa •••• 4242") and total, guest name, guest note.
- Cancellation card: "Free cancellation until Oct 13" (green) or "Non-refundable booking", then "Need to change something? **Message customer service** on WhatsApp with your reference." The link opens AVORA's WhatsApp (not the hotel's) with the reference prefilled, since changes are handled by AVORA.
- **Guest booking:** tick, "Booking confirmed", the reference, "We've emailed your booking details to {email}.", then the **same details cards a member sees**: photo, hotel name and address, dates, check-in / out times, guests, each room line, service fee, how it was paid, the guest's name, and the cancellation terms with the customer-service link. **No** add-to-calendar, directions or contact-hotel buttons (those stay with accounts). Below it the **join prompt**, titled "Create an account to manage your bookings" ("Guests get an email and nothing else. With an account you can see every booking in one place, add stays to your calendar, get directions, contact the hotel, save payment methods and leave reviews"); its **Create account** opens sign-up prefilled with the booking's name, mobile and email (handed over in `sessionStorage`, never in the URL). The summary lives in `sessionStorage` for this tab only: a reload keeps it, closing the tab loses it. The guest booking is **not** added to an account that is created afterwards.
- **Not confirmed:** a booking that is waiting for payment, whose payment failed, that a property could not confirm (refunded) or that was cancelled never shows the tick or "Booking confirmed". It opens a status page naming the state and its next step; an order waiting or failed does the same at `/orders/:id`.
- **Who can open a booking:** only its account owner. A guest sees their own summary in the tab they paid in. Anyone else opening a member booking's link: signed out → "Sign in to view this booking" + **Sign in**; signed in as someone else → "This booking isn't in your account" + **My bookings**.
- Unknown ref, or a guest page after the tab was closed → "No booking found" ("Bookings made without an account are only sent by email and aren't kept on this device.") + **Sign in** + **Start a booking**. With no `ref`, a member sees their latest booking.

---

## 6. My bookings / Favourites / Payment methods / Profile (`/account/:tab`), and Support (`/support`)

**One page:** the account's sections are one persistent page. The tabs and every section stay mounted; picking a tab only changes which section is shown (the URL follows, so links, Back and refresh work). Each section keeps its state (a half-typed form, an open row) and none shows a loading skeleton when you switch to it. Tabs (on phones **one slim row of four equal tabs** in a white rounded strip, icon above a short label ("Payments" for Payment methods), all four visible at once, the current one solid black, 56px tall; from 768px a **left sidebar** of full-width rows without icons, with the page's content to its right; `aria-current` on the active one): Bookings · Favourites · **Payment methods** · **Profile** when signed in; a guest sees only the one section they opened. There is no visible page title above the tabs (the current tile says where you are); the page keeps an accessible `h1` and the browser-tab title. An unknown `tab` shows Bookings. Bookings, Favourites, Payment methods and Profile need an account: a guest who opens one (an old link) sees that section's join prompt ("Your bookings live in your account" / "Sign in to see your favourites" / "Sign in to manage payment methods" / "Sign in to see your profile") and returns to it after sign-in.

**Bookings, signed out (guests):** only the **join prompt**, in a centred card (max 680px) with the 2px ink outline of the home search card: title "Your bookings live in your account" · "Guests only get an email confirmation. Sign in or create an account to see every booking in one place." · four benefits, each with an outline icon in a grey tile: **View all your bookings** (calendar), **Manage payment methods** (card), **Leave reviews** (speech bubble with star), **Join the best platform** (medal) · **Create account** (primary) + **Sign in** (ghost). There is **no "Find a booking" form and no list of bookings made on this device**: guests keep nothing on the device (see 04), and nothing else on the page competes with signing up. Elsewhere the same card is titled "Get more with an AVORA account" ("Guests only get an email confirmation. An account keeps every trip in one place.").

**Bookings, signed in**
- **Upcoming** (check-out today or later, soonest first) and **Past stays** groups of **booking cards**: the hotel's photo (square, 96px on phones, 128px from 420px) beside four tiers divided by hairlines: the **hotel name** (bold) with, for upcoming stays, a neutral "Check-in in 3 days" pill (today / tomorrow / in N days) and, only when something needs attention, a status badge (Pending payment orange, Cancelled / Payment failed grey; confirmed bookings have none), then a pin and "area, city"; a list with outline icons: calendar + "Oct 18–20 · 2 nights", person + "2 guests · 1 room", bed + "1 × Double Room" (all one regular-weight style); and at the foot the reference (muted) and the total (large, bold). The card shows no cancellation terms. Past stays use the same card with a slightly greyed photo and no countdown. The whole card opens the booking (the hotel name is the link, stretched over the card).
- **Write a review** (the only place a review can be started): a confirmed stay whose check-out is before today gets a full-width ghost button under a hairline, "Write a review". Upcoming, pending, cancelled, failed and payment-failed bookings get nothing. After a review is sent, the button becomes a green "✓ Review sent" chip, and stays that way after a reload (the booking carries its review, 06 §5b). The button opens the **review dialog**: "Review your stay" (halls: "Review your event"), a summary of the booking being reviewed (photo, name, area/city, dates · nights, reference; there is no hotel picker), **Overall rating** (five stars, required: "Choose a star rating."), **Your review** (6-row text area, 30–2,000 characters, live counter, placeholder inviting honest feedback; "Enter your review." / "Tell us a little more: at least 30 characters."), **Submit review** (the ✕ is the only way to dismiss it). While sending, the button reads "Sending…" and every way out is blocked. A failure shows the error above the buttons and keeps the stars and text. When there was no answer at all (lost connection, timeout, server error) the message is "There was an unexpected error posting your review. Please try again later." (your review is kept, Submit stays available and resending is safe: the same key is reused until the server answers); a rejected review says "Check your rating and review, then try again."; a stay the server says can't be reviewed swaps the dialog for "This stay can't be reviewed" + Done, with nothing to retry. The error clears as soon as the guest edits. Success swaps the dialog for "Thanks for your review" + Done. What was typed is kept for the tab as it is typed: closing (✕, Esc, backdrop), reloading, going Back or an expired session all leave it there for the next time the dialog opens; signing out on purpose clears it. A "Your session has ended. Sign in again." toast explains an expired session. Desktop: centred 520px card. Below 768px: a bottom sheet with the actions pinned at its foot. Empty state: "No bookings yet – Stays you book while signed in appear here, on every device." + **Find a stay**.

**Favourites** (members only): grid of cards; un-hearting removes the card immediately. Empty state: "You have no favourites yet" + **Browse stays**.

**Payment methods** (signed in)
- One card per method: icon tile (phone for wallets, card for cards), title ("EVC Plus" / "Visa •••• 4242"), subline ("+252 61 555 0142" / "Expires 08/29"), then **Default** chip, orange **Expired** chip, or a **Make default** text button; a trash icon button on the right ("Remove Visa •••• 4242").
- Remove asks inline, in the same card: "Remove Visa •••• 4242? You can add it again any time." **Keep** (focused) / **Remove** (red). Removing the default promotes the next usable method.
- Empty state: "No saved payment methods – Add one below, or tick 'Save this payment method' when you pay."
- **＋ Add payment method** row expands (accordion; the ＋ turns into ✕) a form with the checkout's three radio cards; wallets add **Wallet number** (prefilled with the profile mobile), cards add number / expiry / CVC (validated like checkout; the CVC is never stored). "Use as my default payment method" (shown once one method exists; the first method is always the default). **Save payment method** → toast "Visa •••• 4242 saved", the form closes and resets. Errors in a red panel above the form: "This payment method is already saved.", "You can save up to 10 payment methods. Remove one first."

**Profile** (signed in)
- **Personal details:** First name / Last name (two columns from 560px) · Email · Mobile number (country picker, default +252). **Save changes** is disabled until something changes. Changing the email of a password account reveals **Current password** ("Needed to change your email."). Errors: "Another account already uses this email.", "That password is incorrect."; success reloads with the toast "Your details are saved" (header and drawer update).
- **Sign-in & security:** one row per connected provider (no row for email and password: that is internal) ("Google · Connected"). Password accounts get an expandable row **Change password** (current + new); Google/Apple-only accounts have no password row. Then **Sign out** (ghost).
- **Delete account:** "Permanently removes your profile, saved payment methods, favourites and booking history. Confirmations already emailed to you stay valid." The red **Delete my account** row expands a confirmation: password (password accounts) or "This can't be undone." and a red **Delete account permanently** button → home with "Your account has been deleted".

**Support (`/support`, its own page, open to everyone; `/account/support` redirects to it):** title "Support" (no subtitle). Desktop (≥ 900px): FAQs on the left, a sticky 340px card on the right; phones: stacked, FAQs first. **FAQs** are accordions (the shared accordion: same height animation, chevron and focus ring as every expandable row) in three groups: **Booking** (do I need an account, where is my confirmation email, can I change dates or rooms; wedding halls only while `config.features.halls` is on), **Payments** (when charged, which methods, no payment request on my phone, is it secure), **Cancellations** (how to cancel, refunds). The card says "Still need help?" with a green **Chat on WhatsApp** button (`wa.me/<config.whatsapp>`); the number is not repeated under it. No contact form: customer service is WhatsApp.

---

## 7. Sign in / Create account (`/signin`, `/signup`)

**Purpose:** let guests join or come back in under a minute; never a gate in front of booking.

**Layout:** one white card (460px, centred; padding 28px from 560px). No benefits column: the benefits live in the join prompt on checkout and the confirmation page. The header keeps its account button (no layout shift between pages); the drawer has no join box here. When already signed in, the page redirects to `next`.

**Card contents (Sign in / Create account):** segmented toggle **Sign in | Create account** (the home type-toggle style, full width) → title + one-line subtitle → **Continue with Google** and **Continue with Apple** (white buttons with the official marks; the form button stays the only primary) → divider "or with email" → form.
- **Sign in:** Email (`autocomplete=username`), Password (show/hide eye button) with **Forgot password?** under it, **Sign in**.
- **Create account:** First name + Last name, Email, Mobile number (country code picker, default +252; no hint), Password (hint "At least 8 characters."), **Confirm password**, **Create account**, then the line "By creating an account you agree to our Terms and Privacy policy." Prefilled from the guest booking when arriving from a guest confirmation.
- Typed values (never passwords) survive switching between views.
- **Demo accounts** (mock backend only, `config.features.demo`): under the Sign in and Create account forms, two blue text links (`--link`, stacked): **For Developer: Demo Account** (label "Opening the demo…" while it works) signs in through the ordinary email login with `demo@avora.example` / `avora demo pass`, so those credentials also work typed into the form; **For Developer: Google/Apple Demo** signs in through the provider path as Omar Yusuf (`demo.social@avora.example`, linked to Google and Apple, no password; EVC Plus and a Visa, one favourite, the same three bookings), so "Continue with Google/Apple" with that email works too. The email demo is a ready-made member, Amina Hassan: EVC Plus (default), a valid Visa •••• 4242 and an **expired** Mastercard •••• 4444; two favourites (Lido Beach Suites, Karkaar Suites); bookings at Jazeera Palace (check-in in 3 days), Ambassador Plaza Hargeisa (in 20 days, 2 rooms) and a past stay at Nugaal Hotel. Toast "You're exploring a demo account", then back to `next`. Pressing it again signs in to the same account and refreshes only the seeded bookings (dates stay relative to today); anything the visitor added is kept. After deleting the account the next sign-in recreates it. Must be switched off in production.

**Google / Apple:** **Continue with …** opens the provider step (in production, the provider's own window): "← Back", provider mark + "Continue with Google", the account email, **Continue** ("Connecting to Google…"). An existing account with that email is signed in and the provider is linked to it (provider emails are verified). A new email goes to **Almost done**: "Signing up with Google as {email}" note, First name, Last name, Mobile number, **Create account**, terms line, "Cancel and start again". This step survives a reload for 15 minutes (`?mode=complete`).

**Choose a new password** (`/reset-password?token=…`, the emailed link; it works whether or not someone is signed in): "Choose a new password", **New password** (show/hide, same rule and hint as sign-up) and **Confirm new password**, **Save new password** → "Password updated – You've been signed out everywhere. Sign in with your new password." + **Sign in**. A missing, malformed, expired or already-used link all read "This link can't be used – It may have expired (links last 30 minutes) or already been used. Ask for a new one." + **Send a new link** (the page can only learn a link is spent when the password is submitted). A lost connection keeps the link usable: the field is cleared and the error says so. A weak password shows the field error and does not use up the link.

**Forgot password** replaces the sign-in card with no animation, and the page keeps the sign-in page's height so nothing below it shifts (the reset card is only as tall as its own content) (Back swaps them back, and the form starts empty each time): "← Back to sign in", "Reset your password", Email, **Send reset link** → "Check your email – If an account exists for {email}, we've sent a link to reset your password. It expires in 30 minutes." + **Back to sign in**. The answer is the same for every email. A wrong-password lockout reads "Too many attempts. Try again in N minutes.", using the time the server gives. An error banner clears as soon as the person edits the form. On the Google/Apple step, **← Back** is disabled while the provider request runs, so a late answer can't sign someone in after they left.

**Validation** (same timing as checkout)
| Field | Rule | Message |
|---|---|---|
| First / last name | required, ≤ 50, letters (any script), spaces, `' . -` | Enter your first name. · Use 50 characters or fewer. · Use letters only. |
| Email | `name@domain.tld` | Enter your email address. · That email doesn't look right. |
| Mobile | as checkout | Enter a 9-digit Somali mobile number starting with 6 or 7, e.g. 61 555 0142. |
| New password | 8–128 characters; not a very common password; not the email | The hint "At least 8 characters." turns red (no second line repeats it) · That password is too easy to guess. Try a short phrase. · Don't use your email as your password. |
| Confirm password (sign-up, reset, change password) | Same as the new password; re-checked when the new password changes | Confirm your password. · Passwords don't match. |
| Password (sign in) | required | Enter your password. |

**Form-level errors** (red panel above the fields, `role=alert`): wrong email or password "That email and password don't match. Check them and try again, or reset your password." (password cleared and focused; never says which part was wrong, so it can't reveal whether an email has an account) · after 5 failures for an email "Too many attempts. Wait 5 minutes and try again." · email already registered (sign-up): field error + "Already have an account? **Sign in instead**" · "That sign-up took too long. Please start again." · storage blocked / no secure connection. Buttons show progress ("Signing in…", "Creating your account…") and cannot be pressed twice.

**After success:** redirect to `next` (only AVORA pages are accepted; anything else goes to My bookings) with the toast "Welcome back, Amina" or "Welcome to AVORA, Amina. Your account is ready." Joining merges this device's basket into the account (guest bookings are never merged: they exist only as the email).

**Sessions:** 30 days; signing in or out in one tab updates every open tab; an expired session simply shows the signed-out state.

---

## Cross-cutting behaviour

- **Scroll memory:** every page remembers its scroll position when you leave it. It is restored on browser Back and when you return from the reviews page via **← hotel name** (e.g. you were reading Guest reviews, opened all reviews, came back: you land on the same spot, not the top). Not restored on a fresh visit or when the URL has a `#hash` (e.g. `#rooms`).
- **Maps:** the Location sub-section shows an embedded Google Map of the property, built from the property's Google Maps link (see 06), The map's built-in "Open in Maps" button opens the same place; there is no duplicate text link.

- **Hearts:** members toggle instantly with a toast, saved to the account (every device). **Guests have no favourites:** tapping a heart opens one "Sign in to save favourites" dialog ("You need an account to save a hotel to favourites."; **Sign in** primary, **Create account** below, X in the corner to dismiss), and nothing is stored on the device; the same control appears on cards and the detail page and shows its saved state (`aria-pressed`, label "Add to / Remove from favourites").
- **Wedding halls:** reuse the same screens. Rooms become halls (price per day, one hall per booking), guests = capacity, no rooms field, ci/co become event start / music end.
- **Accessibility baseline:** every control reachable by keyboard; combobox/listbox roles; steppers have group labels; inline errors are tied to their field; focus is visible (2px ring on inputs); tap targets ≥ 44px (inputs/buttons 46px; steppers 44px).
- **Copy rules:** CTA is **Reserve** everywhere (never "Book"); no internal/developer copy; urgency text only when it is true (≤ 2 left); prices always say whether they are per night or total.
