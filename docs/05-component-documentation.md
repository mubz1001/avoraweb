# 05 · Component Documentation

Reusable components, intended use, variants, props, states and usage. "Code" points to the file under `src/` that implements it; each component's CSS sits next to it.

Shared types (`src/types`): `Trip = {type:'hotel'|'hall', city, checkIn, checkOut, guests, rooms}` (URL params stay `in` / `out`) · `Property`, `RoomType`, `Quote`, `Booking` as in 06.

---

## Part 1 · Foundation components (`components/`)

### Button
Code: `components/Button.tsx` (`Button`, `ButtonLink`, `ExternalButton`, `buttonClass`).
```ts
<Button variant="primary|ghost|whatsapp" size="md|sm" block? loading? disabled? icon? href? onClick? />
```
| Variant | Use |
|---|---|
| primary | The one main action in a region (Search, Reserve, Pay, Select a room) |
| ghost | Secondary actions (Edit, Add to calendar, Clear all) |
| whatsapp | Contact actions only |
- States: default, hover, focus-visible, disabled, `loading` (label replaced by progress text, button disabled, `aria-busy`).
- `href` renders an `<a>` with button styling (same API).
- Min height 46 (36 for `sm`); never place two `primary` buttons adjacent.
- Pay button is a Button with a **two-line label** (`label` + `sublabel`).

### IconButton
Code: `components/Button.tsx` (`IconButton`). `<IconButton icon label onClick />` — 44×44, `label` is required (becomes `aria-label`). Used for menu, close, header WhatsApp.

### Field (+ Input, Select, PasswordField)
Code: `components/Field.tsx` (`TextField`, `PhoneField`, `PasswordField`), styles in `styles/forms.css`.
```ts
<Field label hint? error? optional? touched? valid?>{control}</Field>
<PasswordField label autoComplete="current-password|new-password" hint? error? />   // eye toggle: aria-pressed, "Show/Hide password"
```
- Label always visible (no placeholder-as-label). Error text sits below; the control references hint + error via `aria-describedby` and sets `aria-invalid`.
- Validation timing is owned by the form (blur first, then live once invalid). Visual states: default, focus, invalid (red), valid-after-touch (green), disabled.

### useFieldValidation (validator)
Code: `components/forms.ts` (`rule`, `useFormSubmit`, `applyServerErrors`, `errorMessage`). `rules` maps a field id to `() => '' | message`. `all()` checks every rule, toasts "Please fix N fields" and focuses the **first invalid field in document order**. `fail()` shows a server-side error on a field (e.g. email already used). Phone inputs are reformatted on blur. In React: React Hook Form + Zod with `mode: 'onTouched'` and the same messages.

### FormError
Code: `components/Field.tsx` (`FormError`). Red panel above the fields, `role="alert"`, hidden when empty; for errors without a single field (wrong credentials, rate limit, already saved).

### Busy button
Code: `Button` `busy` + `busyLabel` props. Disables the button, sets `aria-busy`, swaps the label to progress text ("Signing in…", "Saving…"); the only double-submit guard a form needs.

### PhoneField
Code: `components/Field.tsx` (`PhoneField`), `lib/phone.ts`.
```ts
<PhoneField label value onChange error? hint? placeholder?="61 555 0142" countryName?="cc" />
```
Typing is capped by `capPhone(country, value)` (`lib/phone.ts`): once a number holds all the digits its country has (`phoneMaxDigits`: Somalia 9, other known countries per table, else 12; spaces, a leading 0 and a pasted +252 are not counted) further digits are dropped, including from a paste.
With `countryName` (the form field that holds the **ISO country code**, e.g. `GB`; several countries share a calling code such as +1) the prefix cell becomes a country picker: a "+44 ▾" label over an invisible native `<select>` (so phones get their own picker) with two `<optgroup>`s from `lib/phone`: **Most common** (`commonCountries`: Somalia, Kenya, United States, United Kingdom, Canada) and **All countries** (`allCountries`, every country with a calling code, A–Z, the common five included); only Somali numbers are regrouped on blur, and the placeholder is dropped for other countries. Helpers: `phoneOkFor`, `phoneMsgFor`, `toE164For`, `splitE164`, `e164Ok`. Without it, a fixed `+252` prefix cell. Accepts `61 555 0142`, `0615550142`, `+252 61 555 0142`; value emitted as 9 national digits; displayed `61 555 0142` on blur. Valid = `/^[67]\d{8}$/`. Used on checkout (guest + payment number).

### Chip
Code: `components/Controls.tsx` (`Chip`). `<Chip tone="neutral|ok|warn">text</Chip>`. Non-interactive. Neutral for amenities and the recommended label; ok for good-news facts; warn **only** for real scarcity/unavailability.

### Sheet (bottom sheet)
Code: `components/FilterPanel.tsx` (the filters sheet / sidebar); the calendar and guests sheets in `features/search/*Picker.tsx`. Used only for Filters; trip editing uses Accordion.
```ts
<Sheet open onClose title footer? >children</Sheet>
```
Behaviour: slides from bottom on mobile; Filters render in-page as a sidebar on desktop (a Sheet only below 768px). Closes on backdrop, ✕, Esc. Opening moves focus to its close button; closing returns focus to the trigger; while closed the panel is `inert`. `role="dialog"`, `aria-modal`, labelled by title. Motion: original sheet motion (07 §3.1). The calendar and guests sheets mount and unmount through `usePresence` (07 §4).

### Toast
Code: `components/Toast.tsx` (`ToastProvider`, `useToast`). `toast(message, action?)`; one at a time, `role="status"`, 2.2 s, or 6 s with an action. `action = {label, onClick}` adds a white pill button (e.g. an **Undo**) that runs once and dismisses the toast. For confirmations and form-level errors only; never the sole way to convey a blocking error.

### ConfirmDialog
Code: `components/ConfirmDialog.tsx`.
```ts
<ConfirmDialog open title confirmLabel cancelLabel? altLabel? onAlt? onConfirm onCancel>body</ConfirmDialog>
// no cancelLabel: a close X in the top-right corner dismisses it (the guest favourites prompt); altLabel adds a ghost button under the confirm one
```
A question that needs an answer before going on (today: the guest favourites prompt, with a close X in place of a cancel button). Native modal `<dialog>`: the browser makes the page inert, traps focus and closes it on Esc; a press on the dimmed backdrop cancels too. Focus starts on the safe choice (cancel) and returns to the opener. Centred card (max 400px), primary confirm above the ghost cancel, both full width. Motion: fades and rises 8px on `--dur-base` with `@starting-style`; closing is instant (07 §3).

### Dropdown
Code: `components/Dropdown.tsx` (+ `Dropdown.css`). `<Dropdown id open onClose trigger title closeLabel width?>children</Dropdown>` — a card that drops from a header button; used by the basket and the account menu. Opens with a soft scale-in from its top-right corner, a 10px drop and a fade over 250ms, and closes by playing the same motion back (07 §3.17), and floats on a shadow: **the page is not dimmed**. A floating card on every size: inset 8px from the edges on phones; `width` (default 400px) hanging under its button from 768px, right edges lined up (`--dd-right`, measured when it opens) with a 6px gap. Title bar with ✕ (sticky), scrolling body (`overscroll-behavior: contain`). `role="dialog"` labelled by its title, `inert` and `visibility: hidden` while closed. Closes on the button (it is excluded from the outside-press check), ✕, Esc, a press anywhere outside, or when another popover opens (`useExclusive`); the caller closes it on navigation. Focus moves to the title once the fade has settled and returns to the button on close.

### OrderConfirmation
Code: `features/booking/OrderConfirmation.tsx` (page: `app/routes/order.tsx`, route `/orders/:id`). `<OrderConfirmation order member onRefresh? />` — an order still waiting for payment, or whose payment failed, shows a status page instead ("Waiting for your payment" + **Check again**, "Your payment didn't go through" + **Back to checkout**) with no references or confirmation wording. Otherwise the confirmation for a checkout of several bookings or one that did not fully confirm (one booking that confirmed keeps `MemberConfirmation` / `GuestConfirmation`). Heading by outcome: **Bookings confirmed**; **Some of your bookings couldn't be confirmed** (payment taken, a refund on its way for the rest); **Your bookings couldn't be confirmed** (all refunded). One card per booking: photo, hotel, area, dates, guests, rooms, total, **Reference** (mono) and cancellation terms; a booking that did not confirm shows the chip **Not confirmed · refunded**, no reference, and a refund note. Members: **View booking** and **Add to calendar** per confirmed booking. Then what was paid / refunded / paid with, the join prompt for guests, and a support line when anything was refunded. A guest's order is kept for this tab only (`sessionStorage`, `lib/receipt.ts`).

### BookingStatus
Code: `features/booking/BookingStatus.tsx`. `<BookingStatus booking onRefresh? />` — the page for a booking that is not confirmed, used by `/bookings/:ref` in place of `MemberConfirmation` / `GuestConfirmation`. Title and one sentence by state: **Waiting for your payment** (with **Check again**), **Your payment didn't go through** (with **Back to checkout**), **This booking couldn't be confirmed** (refund note, support link), **This booking was cancelled**. Then the stay's facts (`StayFacts`) and reference. It never says "Booking confirmed".

### Drawer (mobile menu)
Code: `app/shell/Shell.tsx` (`Drawer`). Right-sliding white panel (mobile only; iOS spring, 07 §2.2): close button; a grey join box (signed out: stacked full-width, Create account outlined above a black Sign in) or the member card (avatar, name, email; informational, not a link; no tinted background, so it can't be mistaken for the highlighted current page, with a divider line under it); links in sections from `drawerSections(member)` (`app/shell/nav.ts`): members get Search │ **ACCOUNT** (12px uppercase muted label) My bookings · Favourites · Payment methods · Profile │ Support │ List your property (external, new tab), with a 1px `--line` divider between sections, and **Sign out** pinned to the bottom (`.drawer-foot`, muted ink) under its own divider; guests get Search · Support · WhatsApp │ List your property. Current page highlighted (`aria-current`). Same focus/Esc/backdrop rules as Sheet.

### Accordion
Code: `components/Accordion.tsx` (`Accordion`, `useAccordion`).
```ts
<Accordion open onToggle trigger="Edit|Close" id>children</Accordion>
```
Animates height (0.3 s; none under `prefers-reduced-motion`), trigger has `aria-expanded` + `aria-controls`, closed content is not focusable. `open()` expands it and scrolls it into view so other controls ("Change dates", the sticky bar's unavailable state) can use it. Also used for the expandable rows on the account page (`.rowbtn`: Add payment method, Change password, Delete account).

### Stepper
Code: `components/Controls.tsx` (`Stepper`).
```ts
<Stepper value min?=0 max onChange label />
```
− disabled at `min`, + disabled at `max`; 44px targets; value announced via `aria-live="polite"`; group labelled with the room name.

### Placeholder / PropertyImage
Code: `components/PropertyImage.tsx`. `<PropertyImage image? hue label? sizes? priority? />` — renders the real `<img>` when `image` exists, with `srcset` from `image.srcset` and the caller's `sizes` (the slot's rendered width, default `100vw`) so the browser fetches the smallest sharp candidate. It is `loading="lazy"` except with `priority` (`loading="eager"`, `fetchpriority="high"`), which only the likely-first-seen photo gets: the first Featured card on Home, the first search result and the first photo of the gallery layout in use. Without an image it shows the gradient placeholder; a photo that fails to load falls back to the same placeholder. Fixed aspect ratio always (no layout shift).

### HeartButton
Code: `components/Controls.tsx` (`HeartButton`), wired in `components/FavouriteHeart.tsx` + `lib/favourites.ts`. `<HeartButton propertyId />` — reads/writes the favourites, `aria-pressed`, label switches between "Add to favourites" / "Remove from favourites", toasts the change.

### Rating
Code: `components/Controls.tsx` (`Rating`, `ScoreChip`). `<Rating value reviews />` — renders `★ 4.6 (212)` **only if `reviews ≥ 3`**; otherwise **renders nothing** (no "New", no "0.0").

### WalletPending (checkout)
Full-screen wait for a mobile-wallet approval (`features/checkout/WalletPending.tsx`), shown instead of the Pay button after `POST /orders` answers `202 pending_payment`. A native modal `<dialog>` (focus trapped, Esc = Use another method, body scroll locked) in a blue gradient scoped to `.wp`, the one exception to the black-and-white palette. It shows the wallet's name (never an invented logo), the amount, the masked wallet number, the booking ref (or the number of bookings) and a countdown to `paymentPrompt.expiresAt`, and nothing else; guidance appears only when needed (offline, or "Still waiting?" after 30 s).
- **Status:** polls `GET /orders/{id}/payment-status` every 3 s (also while the tab is in the background, and at once on focus or reconnect) and stops at the first terminal status. A failed poll shows "Having trouble reaching AVORA" and keeps trying. `onConfirmed` runs once, after the success tick, and only once the order is paid (`confirmed`, `partially_confirmed` or `failed`: the money was taken; the order page then says what each booking came to). `onFailed(reason)` runs once, only when the server says `payment_failed` (a decline, or `TIMEOUT` once the prompt expired); a clock in the page never decides. After the countdown ends it says "This request has run out of time. We're checking…" and keeps polling. `CheckoutForm` then loads the settled order (`GET /orders/{id}`) before opening the confirmation. Starting the payment, a timeout and a network error are never shown as success.
- **Actions:** "Resend request" (the existing rate-limited endpoint; `Retry-After` shows as a toast) and "Use another method" (closes the screen; there is no cancel endpoint, so a late approval would still confirm the booking). After 30 s a "Still waiting?" hint appears above the countdown.
- **Motion:** see docs/07 section 3.20.

### Icon
Code: `components/Icon.tsx`; brand marks in `components/BrandIcons.tsx`. `<Icon name size?=24 />` — outline set with `currentColor`; names: menu, close, check, chev, heart, bed, bldg, user, size, shield, pin, cal, help, wa, home, basket, card, mobile, review, medal, lock, out, eye, eyeoff, trash, mail, plus, minus, thumb. Provider marks (`SSO.google.logo`, `SSO.apple.logo`) are brand glyphs, not part of the outline set.

---

## Part 2 · Search feature

### SearchForm
Code: `features/search/SearchForm.tsx`.
```ts
<SearchForm trip onSubmit(trip|{propertyId}) variant="home|inline" hideCity? instant? />
```
Fields by type — hotels: city (combobox), `DateRangePicker`, `GuestsRoomsPicker`, Search; halls: city (optional), single-date `DateRangePicker`, guests-only `GuestsRoomsPicker`. Hidden inputs (`in`, `out`, `guests`, `rooms`) carry the values. Layout: one row on desktop (city | dates | guests & rooms | Search), stacked on mobile; in the `inline` variant fields fill the width available and the button is right-aligned.
`instant` (the property page's trip editor) drops the Search button: `onSubmit` fires 250ms after the last change (a pending change is dropped if the form unmounts), and the form re-syncs from the `trip` prop when the URL moves on its own (Back, Forward, the basket) without being rebuilt under an open popover.
Output: a normalized `Trip`; if a property was picked in the combobox, `onSubmit` receives `{propertyId}` and the app goes straight to it.

### DateRangePicker
Code: `features/search/DateRangePicker.tsx`.
```ts
<DateRangePicker value:{in,out} onChange mode?="range|single" minDate?=today maxMonths?=12 />
```
Booking.com-style single field + shared calendar. Range mode: first click sets check-in, second (later) click sets check-out; clicking the same/earlier day restarts. Single mode (halls): one click picks the day. Picks only build a **draft** and the calendar **never closes by itself**: **Clear** (left of Done) empties the draft, and **Done** (enabled once the range, or the single day, is complete) applies it and closes.
- **Desktop:** popover, two months, month-header prev/next buttons, hover range preview, footer with the summary and Clear / Done. **Mobile (<768px):** bottom sheet, 12 stacked months, backdrop, ✕.
- Days: `button`s with `aria-label` "Wed, Oct 14" and `aria-pressed` on selected ends; past days disabled; range ends black pills, in-between grey band.
- Footer: the selection said plainly in black bold ("7 nights · Thu, Oct 15 – Thu, Oct 22"; before a range is complete it says what is missing: "Select your check-in date" / "Select your check-out date"); on phones it sits on its own line above full-width Clear and Done buttons.
- Dismiss: Esc, outside click, ✕/backdrop, Done. Only Done applies the dates; dismissing any other way discards the draft and keeps the previous dates. Only one picker popover open at a time.
- Production: arrow-key grid navigation (←→ day, ↑↓ week, PgUp/PgDn month, Home/End), focus trap in the mobile sheet, localized month/weekday names and first weekday.

### GuestsRoomsPicker
Code: `features/search/GuestsRoomsPicker.tsx`.
```ts
<GuestsRoomsPicker value:{guests,rooms} onChange type="hotel|hall" />
```
Field text `2 guests · 1 room`. Popover with two steppers (Guests, Rooms). Limits: hotels guests 1–8, rooms 1–min(5, guests) (reducing guests clamps rooms); halls guests 50–500 step 50, no rooms row. Done / outside click / Esc close.
The panel itself is `GuestsRoomsPopover` (same file), which takes any trigger as a render prop (`aria-haspopup`, `aria-expanded`, `onClick`), `placement="above"` for triggers at the bottom of the screen (phones always get the bottom sheet). The search field and the property sticky bar's trip pill both use it. `DateRangePopover` (in `DateRangePicker.tsx`) is the calendar split the same way, with the same `placement` option.

### TypeToggle
Code: `.seg` on Home (`app/routes/home.tsx`); the sign-in page uses links (`.auth-seg`): a white pill slides under the active tab (a `::before` transform, `--dur-slow`) and the form below fades and rises in (`.auth-pane`); Forgot password swaps in with no animation: the sign-in/sign-up card and the reset card share one grid cell (`.auth-stack`), the one not showing is `inert` and `visibility: hidden`, so the page is always as tall as the sign-in page and nothing below it shifts, while the reset card is only as tall as its own content (the forgot field has its own id so the two forms never share one); Sign in and Create account are one mounted page so the tab pill and form can animate, and both honour reduced motion. `<TypeToggle value onChange />` — `role=tablist`; switching preserves entered values.

### CityCombobox
Code: `features/search/CityCombobox.tsx`.
```ts
<CityCombobox value onChange(value, propertyId?) type />
```
ARIA combobox/listbox with `aria-activedescendant`. Groups: Cities (with live count "N stays") and Hotels/Wedding halls (when the text matches a name). Opens on focus, ↑ ↓ Enter Esc, pointer selection without blur. A **✕** inside the field's right edge (shown only while it has text) clears it and keeps the focus there. No match shows a non-selectable hint row. Data: `GET /suggest` (06).

### FiltersPanel
Code: `components/FilterPanel.tsx` + the groups in `app/routes/search.tsx`.
```ts
<FiltersPanel value:{ptype[],maxPrice,minRating,amenities[]} onChange resultCount type />
```
Groups: property type (hotels), max price, rating, amenities (6 + "Show all"). Header shows "Clear all". On mobile it is a Sheet with a footer button **"Show N stays"**; on desktop a sticky 260px sidebar. Changes are applied immediately (no Apply step).

### FiltersButton / SortSelect
`<FiltersButton count onClick />` renders "Filters" or "Filters (n)"; mobile only. `<SortSelect value onChange />` stays visible at all sizes.

### SummaryBar
Code: `app/routes/search.tsx` (`.sumbar`). `<SummaryBar title subtitle onEdit />` — title `"{n} stays in {city} · {dates} · {guests} guests · {rooms} rooms"`, no subtitle (the count is of bookable stays). Sets `document.title`.

### ResultCard (HotelCard)
Code: `components/PropertyCard.tsx`.
```ts
<ResultCard property trip? availability? onEditDates? />
```
| Mode | When | Price block |
|---|---|---|
| browse | `trip` absent (Home, Favourites) | "From $80 / night" |
| available | `trip` present and fits | **Total** ("$400 total · 2 nights · 2 rooms"), per-room nightly rate (no cancellation text on cards) |
| partial | fewer rooms left than requested | Orange panel "Only N rooms left for your dates" + Change dates |
Content: image, name, "area, city", `Rating` (if any), **max 2** amenity chips, `HeartButton`. The whole card is one link (stretched title anchor); the heart and Change dates stay independently clickable. Horizontal on mobile and desktop with a square, inset thumbnail (112px / 200px, 10px radius, top-aligned); desktop price right-aligned.

### ResultsList
Lists only stays available for the trip; owns loading skeletons, the empty state (nothing available → Change dates) and the error state.

---

## Part 3 · Property feature

### Gallery
Code: `features/property/Gallery.tsx`. `<Gallery images />` — mobile swipeable scroll-snap with counter, desktop 1 + 4 grid; with no images shows placeholders labelled Exterior/Lobby/Guest room/Bathroom/Restaurant (halls: Main hall, Garden, Stage, Entrance, Dining area). A tile with a real photo is a button (`aria-label` "Open photo 2 of 8", zoom-in cursor) that opens the `Lightbox` at that photo; a placeholder tile is inert. A room card's photo opens the lightbox on that one photo.

### Lightbox
Code: `vendor/lightbox/lightbox.ts` (+ `.css`, `LICENSE`), `components/useLightbox.ts`. `const openPhotos = useLightbox(); openPhotos(images, index, openerElement)`. Adapted from the MIT-licensed duccanhole/lightbox-js (pinned commit, local changes listed in the file header): a full-screen native `<dialog aria-label="Photos">` over a blurred, lightly tinted view of the page (`backdrop-filter`, with a darker plain tint where it isn't supported) (focus trap, Esc, top layer; focus starts on Close (no ring until the keyboard is used) and returns to the photo that opened it). Top bar: zoom in, reset zoom, close (44px round buttons, all labelled). The counter "2 / 8" sits centred above the thumbnail strip. Previous / next buttons, ← / → keys and a swipe step through the photos on a sliding track (it slides over `--dur-slow`; a drag follows the finger and snaps on release; it stops at the first and last photo); the thumbnail strip (always shown with several photos) jumps to one. Zoom 1–4× by buttons (not on phones), wheel or double-tap, drag to pan; a press on the backdrop closes. One photo (room card): no counter, arrows or thumbnails. The page behind is held still without hiding its scrollbar (that made the page jump): the dialog swallows wheel scrolling and uses `overscroll-behavior: contain`. It opens and closes with the basket card's motion (a soft scale-in from the top right with a 10px drop and fade over `--dur-base`, played back on close). The module is loaded on the first tap (a separate ~2 KB gzip chunk) and one instance is shared. No inline style attributes, so it works under the production CSP.

### TripBar
Code: `app/routes/property.tsx` (`.tripcard`, the first element inside the `#rooms` section, so jumping to the rooms keeps it in view). `<TripBar trip onEdit />` — "Oct 14–16 · 4 guests · 2 rooms" + Edit, which expands an Accordion containing `SearchForm` (`hideCity`, `instant`: no button, every change saves by itself and the accordion stays open).

### RoomGroups
Code: `app/routes/property.tsx`. `<RoomGroups roomTypes recommendation trip selection onChange />` renders the subheading **Recommended for you** (+ muted "Best fit for 4 guests in 2 rooms") with the best-fit `RoomTypeCard`, then the subheading **Other rooms** with the remaining cards (halls: "Other halls"). If there is no recommendation (nothing available) or only one type, cards are listed without subheadings. There is no one-tap select control.

### StayFit (sticky bar trip pills)
Code: `features/property/StayFit.tsx` + `stay-fit.css`; maths in `lib/pricing` (`stayFit`, `topUp`), wording in `fitSpoken`; all unit-tested.
```ts
<StayFit fit={stayFit(offers, sel, trip)} dates="Oct 27–29" datesSpoken="Oct 27–29, 2 nights" dateTrigger partyTrigger />
```
Two separate pills (white, `--line` border, 6px apart):
- **Dates** (`dateTrigger` from `DateRangePopover`): "📅 Oct 27–29", opens the calendar.
- **Guests & rooms** (`partyTrigger` from `GuestsRoomsPopover`): two segments, each "icon + N/M" over a 2px fill bar (`transform: scaleX`, `--dur-slow` `--ease-out`). Guests (beds vs guests searched): the person icon throughout: green when everyone has a bed, orange when short. Rooms (picked vs searched): always neutral, since rooms are a preference and beds are what matter. Nothing picked yet: just the searched numbers, no bars or colour.
- Screen readers hear "Oct 27–29, 2 nights. Change dates." and `fitSpoken` + "Change guests and rooms."; the sticky bar's live region also announces `fitSpoken` as picks change.

Sticky bar only (not the "Your stay" card or the basket); not shown for halls or while unavailable.

### RoomTypeCard
Code: `features/property/RoomCard.tsx`.
```ts
<RoomTypeCard roomType trip quantity onChange hall? freeCancelUntil? />
```
Content in order: 16:9 photo (room-type name as a small bottom-left label) → title + "· 6 available" → icon row (bed, "Up to N guests" via `guestsUpTo`, size) → feature **pills** (`Chip`, grey) → scarcity chip **only if available ≤ 2 and not a hall** → divider → price row (the **stay total** in bold with "for 2 nights", then the live "$100 / night" in muted small) + `Stepper`. The total leads because it is what the guest pays; the rate comes from availability, so it matches the sticky bar and the basket.
States: normal, selected (quantity > 0), sold out (orange chip, no stepper). Never render a card per physical room; grouping is the API's job.

### StickyReserveBar
Code: `app/routes/property.tsx` (`.sticky`).
```ts
<StickyReserveBar state:{kind:'empty'|'selected'|'unavailable', fromPrice, rooms, subtotal, nights, capacityWarning?} onAction />
```
| kind | Left | Button | onAction |
|---|---|---|---|
| empty | From $X / night | Select a room (halls: Select a hall) | scroll to rooms + highlight |
| selected | "$400 · 2 nights" + the `StayFit` trip pills (dates; guests and rooms; orange guest segment when guests > beds) | Reserve | go to checkout |
| unavailable | "Not available · for your dates" | Change dates | expand the Edit accordion |
Fixed to the viewport bottom on white with a soft upward shadow (standard black button, StayFit trip pills that open the calendar and guests & rooms) and safe-area padding; page content has bottom padding so nothing is hidden behind it.

### useStaySelection (rooms ↔ basket)
Code: `features/property/useStaySelection.ts`. `const { sel, set, moveStay } = useStaySelection(property, trip, offers)`. `sel` is the rooms of **this page's stay** (property + dates) in the basket, minus anything not bookable now; `set(roomTypeId, qty)` writes only this stay (halls: one at a time); `moveStay(nextTrip)` carries this stay to edited dates/guests. Stays at other hotels or on other dates are never read or changed, and nothing is asked when a stay is added.

### SideStayCard (desktop ≥ 960px)
Code: `app/routes/property.tsx` (`.sidecard`). Sticky summary mirroring the selection ("Your stay": dates, lines) or the "From" price when empty.

### AboutSection
Code: `app/routes/property.tsx` (`#about`). One container under the heading "About this hotel/venue" with divider-separated sub-sections and smaller headings: Overview, Amenities, Check-in & check-out, Location, Cancellation, Guest reviews (last). Composed of the blocks below and the Part 3b review components.

### AmenityList, FactsBlock, RulesList, MapBlock, PolicyBlock
Note: **MapBlock** renders a Google Maps iframe from `property.mapUrl` (or lat/lng, or name + address) at 240px tall with no separate text link (the embed's own "Open in Maps" button is the only one); `loading="lazy"`, `referrerpolicy="no-referrer-when-downgrade"`, `title` = "Map of {property}". Helpers: `features/property/map.ts` (`mapQuery`, `mapEmbedUrl`).
Content blocks inside it: amenities (check + label, 2/3 columns), check-in/out times (two big values), map (placeholder → embedded map with an "Open in Maps" link), cancellation & payment note.

---

## Part 3b · Reviews feature

### ReviewSummary
Code: `features/reviews/ReviewCards.tsx` (`ReviewScore`).
```ts
<ReviewSummary summary:{avg,count,label,topics[]} variant="inline|page" />
```
Score badge (dark, 12px radius with a squared bottom-left corner), word label and "N reviews". No category scores.

### ReviewCompactCard
Code: `features/reviews/ReviewCards.tsx` (`ReviewCompact`).
`<ReviewCompactCard review href />` — avatar, first name, score pill, title, 3-line clamped excerpt of the review text, "Read more". The whole card is one link. Used in `ReviewCarousel`.

### ReviewCarousel
Code: `.rv-row` in `app/routes/property.tsx`. `<ReviewCarousel reviews />` — mobile: horizontal scroll-snap row (cards 82% wide); ≥ 768px: 2-column grid. Always 4 items.

### ReviewCard
Code: `features/reviews/ReviewCards.tsx` (`ReviewFull`).
```ts
<ReviewCard review propertyName />
```
Header (avatar, name, score pill) → meta line → title → "Reviewed {date}" → the review text (one paragraph) → `<details>` hotel response (omitted when none).

### TopicChips
Code: `app/routes/reviews.tsx` (`.tchips`). `<TopicChips topics:{key,label,count}[] value onChange />` — toggle buttons (`aria-pressed`), one active at a time; pressed = black fill. Topics with zero mentions are hidden.

### ReviewFilters
Code: `app/routes/reviews.tsx` (`FilterPanel`). `<ReviewFilters value:{score} onChange resultCount />` — a radio group "Review score". Same Sheet/sidebar behaviour as `FiltersPanel`; footer button "Show N reviews".

### ReviewsPage
Composition: back link → title → `ReviewSummary(page)` → `TopicChips` → toolbar (`FiltersButton`, `SortSelect` with Most relevant / Newest / Oldest / Highest / Lowest) → `ReviewCard` list (10 per page) + **Show more reviews** (no sticky bar). State (`sort`, `tp`, `sc`, `topic`) lives in the URL.

---

## Part 4 · Checkout feature

### OrderSummary
Code: `features/checkout/OrderSummary.tsx`. `<OrderSummary stays quote onRemove />` — one block per stay (`StayBlock`, in the basket card's order and type scale: a 64px photo with the hotel name (16px, bold) and area, small muted **Edit** and, when there is more than one stay, **Remove** text buttons, then calendar / guests icon lines and a muted check-in/out line, then a rule and that stay's room lines (regular weight, unit price muted under each), a muted service fee, a **Subtotal** (semibold, dashed rule above) and a green ✓ cancellation line or muted "Non-refundable"; with several stays each block is its own white bordered card), then one **Total** (the strongest line, 18px) and a muted note ("Charged once, now, for N bookings." / "You'll be charged $X now.") Every number is from the server quote (`quote.stays[i]` lines up with `stays[i]`). On phones the body opens and closes through `Accordion` (height animation) and the toggle names the stays; from 900px it is always open (`useMedia`).
```ts
<OrderSummary property trip quote collapsibleOnMobile />
```
Collapsed row: "Order summary · hotel · dates" + total + chevron (`aria-expanded`, controls the body). Body: property, dates/guests, check-in/out times, one line per room type, **service fee row only when > $0**, Total, and the charge/cancellation sentence. Desktop: always open, no toggle.

### GuestForm
Code: `features/checkout/CheckoutForm.tsx` (section 1; `<CheckoutForm quote …/>` pays for the whole quote with `POST /orders`, one `Idempotency-Key` per attempt, retried once with the same key on a lost connection; `QUOTE_USED` resumes or opens the order already paid, `ROOM_UNAVAILABLE` names the stays). Fields name, `PhoneField`, **email (required: guests get their booking details by email only)**; no "Signed in as" note; `PhoneField` with the country picker (the payment number stays +252); no hint lines; signed in: prefilled from the profile, still editable. No "save my details" option: guests keep nothing on the device. Validation per 01.

### PaymentMethods
Code: `components/PaymentOptions.tsx` (`PaymentOptions`, `pickedMethod`, `paymentDefaults`), `lib/payments/methods.ts`. The card fields open and close through `Accordion` when Card is picked or left. Emptying the basket collapses the filled body while the empty note opens.
```ts
<PaymentOptions control saved?:SavedPaymentMethod[] defaultId? />   // form field `pm`: 'saved:<id>' | 'wallet:<brand>' | 'card'
```
Signed in: a **Saved** group first (icon tile, title, subline, Default / Expired chip; expired cards disabled; default preselected), then **Add a new method**. New methods: one 3-column grid of tiles (`.pmtile`), **EVC Plus · ZAAD · SAHAL · eDahab · Premier Wallet · Card**, from `WALLETS` in `lib/payments/methods.ts`; `pickedMethod` maps a wallet to the API's `kind` (`waafipay` / `edahab`) and `brand`, so the provider never appears in the UI. Every saved row and tile is a radio in one group (arrow keys move through them); the chosen tile gets an ink outline. Card fields (number with a "Visa or Mastercard." hint, expiry, CVC) appear under the tiles only for Card. Wallets show a **Pay from a different number** text link (not for a saved wallet) whose second number field unfolds on the `Accordion` and the explanatory line ("You'll get an EVC Plus prompt on +252 … to approve $408."). Only the selected method expands. `saveToAccount` renders "Save this payment method to my account" for new methods. The same component (without `saved`) is the Add payment method form. Production card entry = provider-hosted fields.

### PayButton
Primary button: `Pay {total} now` (one line). States: idle, processing ("Processing payment…", disabled), disabled-while-invalid is **not** used (clicking validates and focuses the first error). It scrolls with the page (not sticky); there is no reassurance line below it.

### ConfirmationView
Members: tick, title, reference (monospace), "Confirmation emailed to …", actions (**AddToCalendar** `.ics` download (hidden when `hasEnded(booking)`), **GetDirections** Maps link, **ContactHotel** WhatsApp with ref prefilled; the cancellation card's "Message customer service" link opens AVORA's own WhatsApp via `supportUrl`), details card, cancellation card, the "Saved to your account" card, links. When the visitor may not open the booking: lock card ("Sign in to view this booking" / "This booking isn't in your account"). Guests get `GuestConfirmation` instead.

### GuestConfirmation
Code: `features/booking/Confirmation.tsx` (`GuestConfirmation`). The confirmation a guest sees: tick, title, reference, "We've emailed your booking details to {email}.", then `StayDetails` and `CancellationCard` (the same two cards `MemberConfirmation` uses: photo, address, dates, times, guests, room lines, fee, payment, guest, cancellation terms), a `JoinPrompt` ("Create an account to manage your bookings") and Back to home. No calendar, directions or contact-hotel actions. The booking comes from `sessionStorage` (`avora.receipt`, this tab only); after the tab closes, the page shows "Sign in to view this booking".

### BookingCard
Code: `features/account/BookingsTab.tsx`, text helpers in `features/account/bookingInfo.ts` (`checkInText`, `STATUS`, `canReview`, `canRebook`, `rebookStay`; unit-tested), styles `.bkcard` in `booking.css`. `<BookingCard booking upcoming />`: `PropertyImage` (the booking's `property.image`, else the coloured tile) beside four tiers separated by hairlines: **name** (19px/700, like the Next trip card; for upcoming stays a neutral check-in pill — today / tomorrow / in N days — and, only when not confirmed, a status `Chip`) with the pin + area/city under it; a **facts list** with 16px outline icons (calendar: dates · nights; user: guests · rooms; bed: room lines from `quote.lines`; all one style, 13.5px regular, the Next trip card's facts style, black icons); and a **foot** with the reference (13.5px regular) and the total (18px/800). No cancellation terms (they are on the booking page). The hotel name is an `AppLink` stretched over the card (`.bkcard-link::after`), so the card is an `<article>` and can hold a real button. Members see Upcoming and Past stays groups; past cards grey the photo and drop the countdown. Past cards with `canReview(b)` end with `.bkcard-rv`: **Write a review** (ghost, `aria-label="Write a review of {hotel}"`) or, once sent this session, a green "Review sent" chip.
**Rebook** (finished, confirmed hotel stays only): a primary small button beside Write a review. One tap puts the same room(s), guests and number of nights in the basket for a new stay starting three days from today (`rebookStay`), remembers the trip, and opens the hotel with the rooms already picked. Price and availability are re-checked for the new dates there, and the guest can change the dates or Reserve.

### StayFacts
Code: `features/booking/StayFacts.tsx`, styles `.stay-place` / `.stay-facts` in `booking.css`. `<StayFacts booking />` — the pin + area/city line, then a hairline and icon rows (calendar: dates · nights, user: guests · rooms, bed: room lines), 13.5px, black 16px icons. One source for the booking card and the review dialog's stay summary, so a stay reads the same in both.

### ReviewDialog
Code: `features/reviews/ReviewDialog.tsx`, `useReviewed.ts`, `lib/reviewDrafts.ts`; styles `.rvd` in `reviews.css`. `<ReviewDialog booking memberId onClose onReviewed(ref) />` — native modal `<dialog>` (via `useModalDialog`, shared with ConfirmDialog), booking summary (photo, name, `StayFacts`, reference), `StarField` + `TextAreaField` (RHF + zod, `useFormSubmit` focuses the first invalid field), `FormError`, Submit. States: invalid, sending (`Button busy`, exits blocked, a second press is ignored), no answer ("There was an unexpected error posting your review. Please try again later.": input kept, same idempotency key), rejected (422: input kept, new key), refused (403/404: "This stay can't be reviewed", no retry), `ALREADY_REVIEWED`, success. The draft is saved per member and booking as it is typed and restored when the dialog opens. Limits in `lib/validation/rules.ts` (`REVIEW_TEXT` 30–2,000).

### StarRating / StarField
Code: `components/StarRating.tsx`. `<StarRating legend value onChange error? />`; `<StarField control name legend />` binds it to a form number field (0 = unset). Fieldset of five radios named "N stars, Word".

### TextAreaField
Code: `components/Field.tsx`. Same props as `TextField` plus `max`: shows a live `n / max` counter in the hint line (trimmed length). The limit is enforced by the form rule, never by cutting off typing.

### SupportPage
Code: `app/routes/support.tsx`, questions in `features/support/faq.ts` (`FAQ` groups), styles `features/support/support.css`. Two columns from 900px (FAQ accordions left, a sticky "Still need help?" card with the WhatsApp button right), stacked below. Customer service is WhatsApp only: there is no contact form. The help card shows the WhatsApp button without repeating the number.

### Tabs (account)
One persistent page: the tabs and every section stay mounted and only the active section is shown (the rest are prepared when the browser is idle and keep their state). Links: on phones one slim row of four equal tabs (icon over a short label; the long "Payment methods" shows "Payments" via a `.short` span while keeping its full accessible name; active = solid black); from 768px a sticky left sidebar (220px, full-width vertical pills) with the tab's content in the column to its right: Bookings · Favourites · (Payment methods · Profile when signed in) · Support; `aria-current` on the active tab. A members-only tab opened while signed out is shown (active) with the JoinPrompt as its content.

### FAQ
One row per question (`FaqItem` in `app/routes/support.tsx`): a `.rowbtn` with a chevron over the shared `Accordion` (height animation, `aria-expanded`/`aria-controls`), on a white `.faq-item` card; then the WhatsApp button.

---

## Part 7 · Accounts feature

### JoinPrompt
Code: `components/JoinPrompt.tsx`.
```ts
<JoinPrompt title? subtitle? next? prefillFromBooking?:Booking />
```
Outlined card (2px ink, like the home search card) with title (default "Get more with an AVORA account"), subtitle (default "Guests only get an email confirmation. An account keeps every trip in one place."), `PerksList`, and **Create account** (primary) + **Sign in** (ghost), both returning to `next`. `prefillFromBooking` hands the booking's name/mobile/email to sign-up through `sessionStorage` (never the URL). Used on: the guest Bookings tab (the whole tab; centred, 680px max), the guest confirmation, members-only tabs when signed out.

### PerksList
Code: `components/JoinPrompt.tsx` (`PerksList`). The four benefits, each an outline icon in a 40px tile + title + one line: View all your bookings (calendar) · Manage payment methods (card) · Leave reviews (review) · Join the best platform (medal). One source for every place it appears.

### NextTripCard
Code: `features/booking/NextTripCard.tsx`.
```ts
<NextTripCard booking moreCount? />
```
Image, status chip computed from today vs check-in/out ("Check-in in 3 days", "Check-in tomorrow", "Check-in today", "You're staying here now · check-out Oct 16", "Check-out today"), name, area, facts (dates, guests · rooms, check-in time) and three actions: **View booking**, **Directions**, **Contact hotel**. Home passes the soonest upcoming booking from `visibleBookings` / `splitBookings`.

### AccountMenu
Code: `app/shell/AccountMenu.tsx`, the account pages from `app/shell/nav.ts` (`accountItems`, shared with the drawer). `<AccountMenu id open onClose trigger here />` — a `Dropdown` (320px, "Your account"). Member: card (avatar, name, email; informational, not a link; untinted, divider line under it), rows with the drawer's icons for **My bookings · Favourites · Payment methods · Profile**, divider, **Sign out** (toast "You've signed out"). Support and WhatsApp are not repeated: they are in the header. Guest: only the join box (**Create account** · **Sign in**, shown on every page including the sign-in pages, so the menu is never empty). The row for the page being viewed has `aria-current="page"`.

### AccountButton (header)
Code: `app/shell/Shell.tsx` (`.acct`). A button that opens the AccountMenu (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`). Signed out: person icon + "Account" (≥ 768px). Signed in: `Avatar` + first name (≥ 768px). Always rendered (including the sign-in page) so the header layout never shifts. The drawer mirrors it (join box or member card + Payment methods, Profile, Sign out).

### AuthCard
Code: `app/routes/auth.tsx` + `features/auth/AuthForms.tsx`.
```ts
<AuthCard mode="signin|signup|forgot|complete" next onSuccess />
```
Views: `signin` (email, PasswordField, Forgot password?), `signup` (first, last, email, PhoneField, new PasswordField, terms line), `provider` (provider email; simulated window), `complete` (first, last, PhoneField for Google/Apple sign-ups, "Signing up with Google as …"), `forgot` (email → "Check your email"), `reset` (`ResetForm`: new PasswordField → "Password updated", or "This link can't be used" for a missing, malformed, expired or used `?token=`; works while signed in and signs this tab out on success). Routes `/signin`, `/signup`, `/signup/complete`, `/forgot-password`, `/reset-password`; the provider step is in-page. `signin`/`signup` show the Sign in / Create account tabs (`.auth-seg` links), `ProviderButtons` and the "or with email" divider. Typed values (not passwords) persist across views. Mock API only (`config.features.demo`): `signin` and `signup` end with two sign-in shortcuts, "For Developer: Demo Account" (`POST /auth/login` with the demo credentials) and "For Developer: Google/Apple Demo" (`POST /auth/oauth/google` with the demo provider email); there is no demo endpoint. Errors map `ApiError.code` → FormError / field errors (copy in 01 §7). Success: the session cache is updated (device basket merged), a welcome toast, then `navigate(next, { replace: true })`.

### ProviderButtons
Code: `features/auth/AuthForms.tsx` (`ProviderButtons`). `<ProviderButtons providers={['google','apple']} onPick />` — ghost buttons with the official marks, "Continue with Google / Apple". Production: render via the providers' SDKs (Google Identity Services button, Sign in with Apple) to satisfy their brand rules.

### PaymentMethodList / PaymentMethodRow
Code: `features/account/PaymentsTab.tsx`.
```ts
<PaymentMethodRow method:SavedPaymentMethod isDefault onMakeDefault onRemove />
```
Icon tile, title + subline, Default / Expired chip or **Make default** text button, trash `IconButton` ("Remove Visa •••• 4242"). Remove swaps the row into an inline confirmation (Keep focused / Remove danger); after Keep, focus returns to the trash button. List empty state + **Add payment method** expandable row containing `PaymentMethods` (no saved group), Wallet number (`PhoneField`, prefilled), "Use as my default payment method", **Save payment method**.

### ProfileForm, SecurityCard, DeleteAccount
Code: `features/account/ProfileTab.tsx`.
- `ProfileForm`: first, last, email, PhoneField; **Save changes** disabled until dirty; current password revealed when a password account changes its email.
- `SecurityCard`: sign-in method rows (Email & password On for password accounts, connected providers), expandable **Change password** (password accounts only), **Sign out**.
- `DeleteAccount`: explanation, danger expandable row → password (if any) + **Delete account permanently**.

### SignedInGate
Code: `app/routes/account.tsx` (gated tabs). Renders children for members, a `JoinPrompt` with `next` back to the same tab otherwise; if the session check itself failed it shows a `QueryError` ("We couldn't check your account", **Try again**) instead of asking a member to sign in.

---

## Part 6 · Shell

### BasketButton
Code: `features/basket/BasketButton.tsx`. `<BasketButton open controls onClick ref />` — the `basket` icon with an orange count badge (rooms; "9+" above 9; hidden at 0). Phones: 44px icon in the account icon's place (the account lives in the menu). From 768px: a 38px outlined circle between the WhatsApp circle and the account pill. Accessible name "Basket, 2 items" / "Basket, empty", `aria-expanded`, `aria-controls`. The badge bumps when the count changes (07 §3). A press does no work of its own: the panel's content (the basket's property and live prices) is rendered ahead once the browser is idle.

### BasketPanel
Code: `features/basket/BasketPanel.tsx`. `<BasketPanel id open onClose trigger />` — the basket dropdown (02 §4.14). Full width under the header on phones; the shared `Dropdown` (a 400px card hanging under the basket button from 768px, no page dimming) titled "Your basket". `Filled` renders one `StayGroup` per stay and then once the totals; each `StayGroup` owns its property and availability queries and reports its subtotal up, and animates away (`Accordion`) when its last room goes. **One stay:** the plain layout (`.bskt-group.flat`): a **stay header** (`StayHead`: hotel name as a link to its rooms with a chevron, area, calendar line "Oct 20–22 · 2 nights", person line "2 guests · 1 room"; halls: the day and the guests), no photo or price → one row per room, all the same shape (88px 16:9 picture · name, "Up to N guests" (`guestsUpTo`), beds, warning chip · stay total over "$X / night" ("each" when more than one), small `Stepper` or **Remove** for a room that can't be kept) → Subtotal · N nights, Service fee, **Total**, **Checkout · $X**. **Several stays:** a card per hotel (1px `--line` border, 14px radius): a white header (the stay header, divided from the rooms by a rule), white room rows, then **Subtotal · N nights** under a rule; below the last card **Subtotal · N stays**, Service fee, **Total** once and one **Checkout · $X**. There is no Remove button for a stay and no Clear basket: steppers remove rooms, and a stay whose last room goes collapses away. Notes (unavailable rooms; dates passed – that stay is left out of checkout) sit under the totals. States: loading skeleton, empty (basket in a grey circle, "Your basket is empty", "Add a room to see it visible here.", no button), dates passed, hotel removed, prices failed (per stay, inline retry). `role="dialog"` labelled by its heading; each stay is a `region` named by its hotel; focus moves to the heading on open and back to the button on close; closes on the button, ✕, backdrop, Esc, outside press, any navigation.

### Header
Code: `app/shell/Shell.tsx` (`Header`). Black, 56px, sticky. Left: the logo mark as a badge (the A inside a 34px white-outlined rounded square; 28px in the footer) + "AVORA". Right: nav links (desktop), WhatsApp link, `BasketButton`, `AccountButton` (far right; desktop only: phones reach the account through the menu), menu button (mobile). WhatsApp (white on the black bar) is icon only everywhere: 44px on phones, a 38px outlined circle from 768px. Active nav item highlighted.

### Footer
Code: `app/shell/Shell.tsx` (`Footer`). Black full-width block with a 1120px inner container: brand mark + "AVORA" + tagline; three link columns (Company / Support / Your account) with 12px uppercase muted headings and 14px links in `rgba(255,255,255,.7)` that go white on hover; a **Language** `<select>` (dark, white chevron) under Your account; a muted copyright line. Grid: 1 column, 2 from 560px, 4 from 960px. External links open in a new tab with `rel="noopener"`. Production: wire the language select to i18n.

---

## Usage example

```tsx
<ResultCard
  property={hotel}
  trip={{ type: 'hotel', city: 'Mogadishu', in: '2026-10-14', out: '2026-10-16', guests: 4, rooms: 2 }}
  onEditDates={openEditAccordion}
/>
// → "$400 total · 2 nights · 2 rooms", "$100 / night per room", "Free cancellation"
```

## Component checklist for "done"
Typed props · all states from this doc · keyboard operable · focus visible · tokens only (03) · empty/loading/error variants where data-driven · unit/component test · usage example.

## Language select

In the footer: English, Soomaali, العربية. Switches the language at once without a reload (see docs/04 Languages); Arabic turns the page right-to-left. The page fades in again as it changes (`.lang-switch`).

## Appearance toggle

In the footer under Language: a full-width three-way toggle of icons (monitor = System, sun = Light, moon = Dark; real radio inputs, so arrow keys work, with the names for screen readers). A white pill slides under the chosen one. `useThemePref` in `src/lib/theme.ts` saves it to `avora.theme` and the theme changes at once, without a toast or reload.

## Not found page

`app/NotFound.tsx` (styles `app/not-found.css`), the catch-all route and the target for unknown stays, bookings and legal pages. It fills the screen below the header with the title "Page not found" and one **Back to home** button; callers may pass their own title and an optional body line. The footer sits below the fold. Document title "Page not found · AVORA".
