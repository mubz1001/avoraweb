# 03 · Design System

Keeps the live site's identity (black header, white cards, dark primary buttons) so the redesign reads as UX, not rebrand. All values below are the ones in `src/styles/tokens.css` (and the component stylesheets next to each component); when porting to a framework, define them once as tokens (CSS variables, Tailwind theme, or a theme file) and never hard-code them in components.

---

## 1. Colour tokens

The table lists the **light** values. Dark values, the extra theme tokens (buttons, calendar, shadows, focus ring) and the contrast results are in **[08 · Theming](08-theming.md)**; components never hard-code a theme-dependent colour.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#111111` | Primary text, primary buttons, selected states, header-adjacent blacks |
| `--ink2` | `#333333` | Secondary body text (room facts) |
| `--muted` | `#6b6b66` | Helper text, labels, captions, meta lines |
| `--line` | `#e4e4e1` | Dividers, card/field borders (light) |
| `--bg` | `#f4f4f2` | Page background, neutral chips, input prefix, hover and current-page rows |
| `--card` | `#ffffff` | Cards, sheets, inputs |
| `--ok` / `--okbg` | `#0a7a4a` / `#e6f4ec` | Free cancellation, valid field, success chip, tick |
| `--warn` / `--warnbg` | `#9a3412` / `#fff1e6` | Scarcity ("Only 1 left"), unavailable panel, guest fit meter when beds are short |
| `--err` / `--errbg` | `#c0262d` / `#fdecec` | Field errors |
| `--link` | `#1d4ed8` | Text links that are not part of the brand chrome (today: the developer demo-account link) |
| Header | `#000000` | Header bar, hero; text `#fff`, nav `#ddd` |
| WhatsApp | `#fff` (header icon, on the black bar) · `#25d366` (icon in the white menu drawer) · `#128c4a` (solid buttons) | Only for WhatsApp actions |
| Input border | `#cfcfca` | Default field border (darker than `--line` for affordance) |

Rules: colour never carries meaning alone (errors have text, scarcity has text, success has a check). Green is reserved for **good-news facts** (free cancellation, valid, confirmed) — don't use it for generic CTAs. Orange is reserved for **real constraints** (limited stock, unavailable).

Contrast: `--ink` on `--bg`/`#fff` ≈ 17:1; `--muted` on `#fff` ≈ 5.3:1 (passes AA for body); `--ok` on `--okbg` and `--warn` on `--warnbg` pass AA for 13px+ text.

## 2. Typography

Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (no web font download; matches the native feel of the audience's devices).

| Style | Size / line | Weight | Used for |
|---|---|---|---|
| Display (hero) | 28 / 1.2 | 700 | Hero headline (mobile) |
| H1 | 24 / 1.2 | 700 | Hotel name, page titles; summary bar uses 17 |
| H2 | 19 / 1.2 | 700 | Section titles ("About this hotel"); card titles on checkout use 17 |
| H3 | 16–17 / 1.2 | 700 | Card/room titles |
| Body | 15 / 1.45 | 400 | Default |
| Small | 13–13.5 | 400–600 | Meta lines, helper text, chips |
| Tiny | 12–12.5 | 600 | Chips, field messages |
| Price (large) | 19–22 | 800 | Nightly/total price emphasis |
| Reference code | 26, monospace (`ui-monospace, Consolas`), letter-spacing .12em | 700 | Booking reference |
| Logo wordmark | 19, letter-spacing .22em | 800 | "AVORA" |

Inputs use 16px on phones (< 768px) so iOS Safari never zooms on focus; 15px from 768px (`styles/forms.css`).

## 3. Spacing, radii, elevation, layout

- **Spacing scale:** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 24 · 26 (px). Section rhythm 22–26px; card padding 16; card inner gaps 8–12; page gutter **16px**.
- **Container:** max-width **1120px**, centred, 16px side padding.
- **Radii:** cards 14 · buttons/inputs 12 · small buttons 10 · sheets 20 (top corners) · chips and switches 99 (pill) · hearts/WhatsApp circle 50%.
- **Shadow:** `0 1px 2px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.05)` on cards. Search card uses a stronger `0 8px 30px rgba(0,0,0,.18)`. Sticky bar `0 -4px 16px rgba(0,0,0,.08)`. Dropdowns `0 12px 30px rgba(0,0,0,.18)`.
- **Borders:** 1px `--line` for dividers; 1–1.5px for fields and payment cards; no heavy outlines. The selected state of a card is communicated by content (chips, steppers), **not** a thick border.
- **z-index layers:** header 50 · sticky booking bar 60 · drawer backdrop 80 · drawer 90 · sheet backdrop 95 · sheets 100 · toast 200.

## 4. Breakpoints

| Name | Min width | What changes |
|---|---|---|
| base | 0 | Mobile-first single column |
| sm | 560px | Two-column field grids (`grid2`), facts grid |
| **md** | **768px** | Primary switch: header nav replaces menu button; WhatsApp and basket become 38px outlined circles and the account a pill (far right); the account page's tabs become a left sidebar; filters become a sidebar; result cards go horizontal with right-aligned price; gallery becomes a grid; search form becomes one row |
| lg-checkout | 900px | Checkout becomes two columns with sticky summary; summary toggle disabled and always open. Also: the guest Bookings tab moves the join prompt into a sticky 360px right column |
| lg-hotel | 960px | Hotel page gets the right-hand "Your stay" card |

Design checks happen at **375px** and **1440px**; nothing may scroll horizontally between them.

## 5. Components and variants

### Buttons (`.btn`)
| Variant | Look | Use |
|---|---|---|
| Primary | `#111` bg, white text, 46px tall, 12px radius, 650 weight | One per view region: Search, Reserve, Pay, Select a room |
| Ghost | white bg, `--line` border | Secondary: Edit, Add to calendar, Get directions, Clear all |
| Small (`.sm`) | 36px tall, 14px text | Inline: Edit, Select, Change dates |
| Block | full width | Forms, sheets |
| WhatsApp | `#128c4a` bg | Contact hotel, Support |
| Danger (`.danger`) | `--err` bg, white text | Only the final step of a destructive action (Remove a payment method, Delete account) |
| Disabled | 55% opacity, `not-allowed` cursor | Save changes with nothing changed |
| Busy (`aria-busy`) | Disabled + `wait` cursor, label becomes the progress text | Pay, Sign in, Create account, Save |
| Sign-in provider (`.sso-btn`) | Ghost + the provider's official mark (Google "G" in brand colours, Apple logo), "Continue with Google / Apple" | Sign-in page only; never restyle or recolour the marks |
| Text button (`.linkbtn`) | No box, underlined 650 text | Inline actions: Forgot password?, Make default, Sign in instead |
States: hover (primary lightens to `#2a2a2a`; ghost fills `--bg`), focus-visible ring, disabled. Icon buttons are 44×44 (`.icon-btn`).

### Fields (`.field`, `.inp`, `.phone`)
46px tall, 12px radius, `#cfcfca` border; focus = `--ink` border + 3px `rgba(0,0,0,.1)` ring; invalid = `--err` border + message beneath (12.5px); valid-after-touch = `--ok` border. Phone field = grey `+252` prefix cell + input in one bordered group. Password field (`.pw`) = input with a 44px muted eye button inside on the right (show/hide, `aria-pressed`). Selects share `.inp`. Textarea min-height 84.
**Form error panel** (`.formerr`): `--errbg` panel, `--err` 13.5px/600 text, 10px radius, above the fields, `role=alert`; for errors that belong to no single field (wrong password, already saved, too many attempts).

### Listing cards: no blue
Cards use no browser-blue anywhere: title links stay `--ink` in every state (hover, visited, active), the mobile tap highlight is transparent, keyboard focus shows a 2px `--ink` ring on the whole card.

### Picker fields (`.pick`)
Typography: all search-form fields (city input, date and guests buttons) share one style, 15px / 550, so they read as a set; placeholders stay 400 in `--muted`.
Dates and guests/rooms are **button-style fields**: same 46px height, border and focus ring as inputs, a leading 18px muted icon (calendar / user; the city input has a pin), text left-aligned. Open state = ink border + ring. Date text reads `Wed, Oct 14 → Fri, Oct 16` (arrow in `--muted`).

### Calendar
White card, 16px radius, large soft shadow (`0 12px 40px rgba(0,0,0,.22)`), 290px months (two on desktop, 12 stacked on mobile), 42px day cells in a 7-column grid with **no gaps** so the range band is continuous. States: default · disabled (`#c4c4bf`) · today (bold) · hover (2px ink ring, circular) · in-range (`#ececea` band) · start/end (`--ink` fill, white text, 21px radius on the outer side only) · single/solo (fully rounded). Month header has circular 36px prev/next buttons (disabled at 30% opacity). Mobile = bottom sheet like Filters (20px top radius, z-index 100, backdrop 95).

### Review components
- **Score badge** (`.score`): `--ink` fill, white 20px/800 text, 48px tall (60px on the reviews page), 12px radius with a **4px bottom-left corner** (booking.com-style speech-bubble shape). The compact **score pill** (`.sc`, `★ 5`) is a black pill, 13px/700.
- **Avatar** (`.av`): 38px circle with the first initial, background `hsl(h 38% 40%)` where `h` is derived from the name so the same person always gets the same colour.
- **Review card** (`.rv`): standard white card; the review is one paragraph; hotel response is a `--bg` panel with a `<details>` summary.
- **Carousel** (`.rv-row`): scroll-snap row, cards 82% wide on mobile; 2-column grid from 768px.
- **Topic chips** (`.chip.tp`): 36px tall white pills with a count; pressed = black fill.

### Selects
Native `<select>` elements are restyled with `appearance:none`, a custom 16px chevron on the right and 42px right padding; never use the browser's default arrow.

### Choice controls
checkbox/radio 18–19px with `accent-color:#111` · payment tile (`.pmtile`: white, 1.5px `--line` border, selected = ink outline, three per row) and saved-method row (`.pmopt`) · type toggle (`.seg`, white thumb on grey track).

### Cards
Surface card (`.card`: white, 14 radius, shadow, 16 padding) · hotel card (`.hcard`: photo + body; whole card clickable via stretched title link; heart separate) · room card (`.room`: photo, details, price row + stepper) · summary card (`.sumcard`, zero padding with toggle row) · info panels (blue recommended, orange unavailable, grey guest note).

### Account components
- **Join prompt** (`.join`): a `.card` with the home search card's **2px `--ink` outline**, 20px padding, 19px H2, a muted one-line subtitle, the benefits list and two buttons (primary **Create account** + ghost **Sign in**; side by side from 560px).
- **Benefits list** (`.perks`): rows of a 40px **icon tile** (`.pi`: 12px radius, `--bg` fill, 20px `--ink` outline icon; white with the card shadow when it sits on the page background) + bold title + muted 13px line. Icons: calendar, card, review (speech bubble with a star), medal.
- **Header account pill** (`.acct`): mobile = 44px icon button (person icon, or a 30px avatar); desktop = 38px pill at the far right of the header, with a `#3a3a3a` border like the WhatsApp and basket circles, person icon + "Sign in" or a 28px avatar + first name.
- **Avatar** (`.av`): the review avatar (initial on `hsl(h 38% 40%)`, hue from the name) reused for the signed-in member.
- **Saved method row** (`.pmrow`): card with icon tile, title, muted subline, chips (Default neutral, Expired warn) or a text button, and a trash icon button that turns `--err` on hover. Removing confirms inside the same card (Keep ghost + Remove danger).
- **Expandable row** (`.rowbtn`): full-width 52px row button (icon, label, optional chevron) that opens an accordion beneath it; danger variant uses `--err` text. Used for Add payment method (＋ rotates into ✕), Change password, Delete account.
- **Next-trip card** (`.nexttrip`): a `.card` with 14px padding (16px from 768px) holding the property image (`.ph`, 16:9, 10px radius; 200px square at the side from 768px, like the result cards), then a column: neutral `.chip` status, 19px/700 name (link, underlined on hover), muted area line, a facts row of 16px icons + 13.5px `--ink2` text, and an action row: **View booking** (primary, full width on mobile, first on desktop), **Directions** (ghost) and **Contact hotel** (`.wa`), all `.btn.sm`, two per row on mobile, one row from 768px. Only existing tokens.
- **Sign-in card** (`.auth-card`): 460px card, 28px padding, full-width `.seg` toggle on top, provider buttons, an "or with email" divider (1px `--line` rules either side of 13px muted text).

### Chips (`.chip`)
Pill, 12.5px/600. Variants: neutral (`--bg`), ok (green), warn (orange). Used for amenities (max 2 on cards), recommended label, scarcity, saved payment method state (Default / Expired).

### Photo placeholder (`.ph`)
Gradient from `hsl(h 38% 34%)` to `hsl(h+30 42% 52%)` with a subtle vertical stripe pattern, a centred icon and a bottom-left label. `h` (hue) comes from the property so lists don't look identical. Replace with real `<img>` (keep aspect ratios: card 16:9, gallery 4:3, room 16:6 mobile).

### Navigation
Header (56px black), drawer (320px max, 86vw), nav links (14px), pills for tabs on the account page. The drawer and the property page's sticky Reserve bar are white for legibility against the black header: `--line` dividers, `--bg` cards and hover, the standard black primary button, and the sticky bar keeps a soft upward shadow (`0 -4px 16px rgba(0,0,0,.08)`) to lift it off the page.

### Star rating input (`.stars`)
Five 34px stars in 44px touch targets, empty `--line`, filled `--ink` (up to the hover on a mouse, or the chosen value); the word (Poor · Fair · Good · Very good · Excellent) sits beside them. Native radios in a fieldset: arrows, Tab and screen readers just work; focus ring on the star. Error message in `--err` under the row. Transitions are colour and a 0.88 press scale only.

### Review dialog (`.cdlg.rvd`)
The ConfirmDialog shell (fade + 8px rise) at 520px; below 768px a bottom sheet (full width, top radius, max 92dvh) whose action row sticks to the foot. Booking summary in a `--bg` panel with a 72px photo. Text areas use `.inp` (min 140px, vertical resize) with a right-aligned counter in the hint line that turns `--err` past the limit.

### Overlays
Bottom sheet (20px top radius, max 86–92vh, backdrop `rgba(0,0,0,.5)`) used for Filters (mobile only). Editing a trip is **not** a modal: it uses the inline accordion (below). Combobox listbox (white, 12 radius, max-height 300). Toast (black pill).

### Accordion (inline edit)
Content region that animates its height from 0 to auto (`grid-template-rows: 0fr → 1fr`, 0.3 s ease) with the trigger button toggling its label (Edit ↔ Close) and `aria-expanded`. Used for editing the trip on Search and Hotel. Content gets a top divider and 14px padding; hidden content is `visibility:hidden` so it is not focusable.

### Content container with sections
`.about`: one white card; sub-sections separated by 1px `--line` dividers with 18px vertical padding; sub-headings are 15px/700, the card is introduced by a 19px H2 ("About this hotel").

### Icons
Single-weight outline set, 24px grid, `stroke-width:2`, round caps/joins, `currentColor`. The **WhatsApp mark is the official filled brand glyph** (not an outline); use it only for WhatsApp actions and keep it unmodified. In use: menu, close, check, chevron, heart, bed, building, user, size, shield, pin, calendar, help, WhatsApp, card, mobile, review, medal, lock, sign-out, eye / eye-off, trash, mail. The Google and Apple marks are official brand glyphs (like WhatsApp): only on their sign-in buttons and connected-account rows. Inline 16px in meta rows, 24px for controls. Brand mark is `assets/logo.svg` (white on black header, inverted in the white drawer); favicon is the mark on a black rounded square.

## 6. Motion

Original motion everywhere, tokens on `:root`: `--dur-fast` 150ms, `--dur-base` 250ms, `--dur-slow` 320ms; `--ease-out` (enter), `--ease-in` (exit), `--ease-standard` (in place). Sheets slide up on enter (320ms ease-out) and down on exit (250ms ease-in); popovers fade with a 4px drop (150ms); the inline edit accordion animates its height (320ms).

**Mobile only (< 768px), one thing gets iOS motion** on `--ios-spring` (a critically damped spring: duration 0.3, bounce 0, as a CSS `linear()` curve, 440ms to rest): the **menu drawer** and its backdrop. Everything else uses the original motion (the basket dropdown is a plain fade); pages never animate: navigation is instant. Desktop is never affected.

Reduced motion turns all of it off. Figures, sources, inventory and implementation are in **[07 · Animations and Motion](07-animations.md)**.

## 7. Content and tone rules (part of the system)

- CTA vocabulary: **Reserve**, **Select a room**, **Pay $X now**, **Search**, **Edit**, **Change dates**. Never "Book" next to "Reserve". Accounts: **Sign in**, **Create account**, **Continue with Google / Apple**, **Sign out** (never "Log in" / "Register" / "Log out").
- Account copy never blocks booking (guests can always reserve and pay; the copy says what they miss, never that they can't book) and never reveals whether an email has an account.
- Price copy: always state the basis ("/ night", "total · 2 nights", "per room"). Do not write "taxes included" anywhere. The 2% service fee is mentioned **only at checkout** (summary row, and the confirmation receipt); never on browse, hotel or sticky-bar copy. Hide a fee row when it rounds to $0.
- Urgency copy only when real (≤ 2 left).
- No placeholders in user-visible copy: ratings without 3 reviews are omitted entirely (no "0.0 (0)", no "New" badge).
- Sentence case everywhere; dates as "Oct 14–16"; phone as "+252 61 555 0142".

## 8. Do / don't

| Do | Don't |
|---|---|
| Use tokens for every colour/radius | Hard-code hex values in components |
| One primary button per region | Two black buttons side by side |
| Pair every error colour with text | Colour-only status |
| Keep the header black and flat | Tint the header or add gradients |
| Keep the WhatsApp action in the header | Float anything over inputs |
