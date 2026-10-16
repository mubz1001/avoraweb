# 07 · Animations and Motion

Motion in AVORA has one job: show **where something came from and where it went** (a sheet rising from the bottom, a drawer sliding in from the side) and confirm actions. It is never decorative.

One thing gets **iOS motion on mobile (< 768px)** and nothing else does: **the menu drawer** (and its backdrop).

Everything else, on every screen size, uses the original motion (§1, §3). Desktop (≥ 768px) is never affected by the iOS rules: they all live in `@media (max-width:767px)` blocks: the spring tokens in `src/styles/motion.css`, the drawer in `src/app/shell/shell.css`.

---

## 1. Original tokens (`:root`, all screen sizes)

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | `150ms` | Popovers (calendar, guests & rooms), small state changes (chevron) |
| `--dur-base` | `250ms` | Exits of sheets, backdrop fades |
| `--dur-slow` | `320ms` | Entrances of sheets, accordion height |
| `--ease-out` | `cubic-bezier(.2, .8, .2, 1)` | **Entering** elements: fast start, gentle landing |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | **Leaving** elements: gentle start, quick finish |
| `--ease-standard` | `cubic-bezier(.4, 0, .2, 1)` | Elements that change in place (accordion, backdrops) |

Rules: enter with `--ease-out` at `--dur-slow`, leave with `--ease-in` at `--dur-base`; nothing longer than 320ms except the room highlight (§3.7); small distances for popovers (4px), full height for sheets.

---

## 2. iOS motion (mobile only)

### 2.1 The spring
`--ios-spring` is a critically damped spring at **duration 0.3 s, bounce 0**: the same family as Apple's system spring (`spring(duration:bounce:)` in SwiftUI, `UIView.animate(springDuration:)` in UIKit; [Apple docs](https://developer.apple.com/documentation/swiftui/animation/spring(duration:bounce:blendduration:))), with a quicker response than its 0.5 s default (734ms to rest). It settles in 440ms, close to the original 320ms motion, and keeps the iOS shape.

It is sampled from the physical model (mass 1, stiffness (2π / 0.3)², damping ratio ζ = 1; [WWDC23 "Animate with springs"](https://developer.apple.com/videos/play/wwdc2023/10158/)) into 21 CSS `linear()` stops (max error 0.2%). `--ios-spring-dur` = **440ms** is the settle time (residual < 0.1%), so the CSS transition ends exactly when the spring comes to rest; the curve is 62% done at 100ms, 92% at 200ms, 98.6% at 300ms, with no overshoot. A critically damped spring is self-similar: normalised to its settle time, every duration has the same curve. Retuning it only changes `--ios-spring-dur` (= 1.468 × duration); the stops stay. `linear()` needs Chrome 113 / Safari 17.2 / Firefox 112; older engines get the `cubic-bezier(.2,.8,.2,1)` fallback through `@supports`.

Regenerating the curve: `x(t) = 1 − (1 + ωt)e^(−ωt)`, `ω = 2π / duration`. Sample 400 points over the settle time, simplify with Ramer–Douglas–Peucker at 0.002, write the stops as `value pct%`. (Other springs: underdamped `x(t) = 1 − e^(−ζωt)(cos ω_d t + (ζω/ω_d) sin ω_d t)`, `ζ = 1 − bounce`, `ω_d = ω√(1 − ζ²)`.)

### 2.2 Menu drawer
`translateX(100%) ↔ 0` on `--ios-spring` in and out; the backdrop (`.drawer-bg`) fades on the same spring; `visibility` is delayed by the spring duration on exit so hidden links cannot be focused but the panel still animates out; `overscroll-behavior: contain` so scrolling the menu never drags the page behind it. Closing: ✕, backdrop, Esc, as before.

### 2.3 Page navigations are instant
Moving between pages does not animate, on any device. A page push (View Transitions) was built and removed: the document ignores input while one runs, it waits on data before it starts, Back/Forward replays it on top of the browser's own animation, and it only exists in some browsers, so the app behaved differently per browser. Instead navigation is made to *feel* instant: links prefetch their page on press, hover and focus (04 §A.4), loaders wait at most 100ms for data (a skeleton shows after that), a thin progress bar (3.16) appears when a navigation waits on data, and scroll position is restored on return.

---

## 3. Inventory (everything else: original motion on all screen sizes)

| # | Element | Motion |
|---|---|---|
| 3.1 | **Calendar** | Desktop: popover, opacity + `translateY(-4px)`, `--dur-fast` `--ease-out`. Mobile: bottom sheet `translateY(100%) ↔ 0`, in `--dur-slow` `--ease-out`, out `--dur-base` `--ease-in`; backdrop `.cal-bk` fades over `--dur-base`; it never closes by itself (picks only build a draft; Done applies it) |
| 3.2 | **Guests & rooms** | Same as 3.1 |
| 3.3 | **Filters** | Desktop: sidebar, no motion. Mobile: bottom sheet as 3.1 |
| 3.4 | **Menu drawer** | Not shown on desktop. Mobile: iOS spring (§2.2) |
| 3.5 | **Inline edit accordion** (`.acc`) | `grid-template-rows 0fr → 1fr`, `--dur-slow` `--ease-standard`; content clipped while animating, then `.settled` (overflow visible) when the transition ends, so popovers can escape; then scrolls into view |
| 3.6 | **Expandable account rows** (`.rowbtn`) | Same accordion; chevron rotates 180° / ＋ rotates to ✕ (`transform`, `--dur-fast`, `--ease-standard`) |
| 3.7 | **Room highlight** (`.flash`) | Smooth-scroll to the rooms, each card pulses an orange ring twice (1s × 2); attention cue |
| 3.8 | **Order summary chevron** | `rotate(0 → 180deg)`, 200ms; body shows/hides instantly |
| 3.10 | **Toast** | Appears instantly, removed after 2.2s (6s with an action such as Undo) |
| 3.15 | **Skeletons** | Loading blocks pulse opacity (1.4s, alternating); compositor-only; static under reduced motion |
| 3.16 | **Navigation progress** | 3px bar at the top while a navigation waits on data; appears after 150ms, `transform: scaleX` only |
| 3.11 | **Gallery, review carousel** | Native scroll-snap |
| 3.12 | **Busy buttons** (Pay, Sign in, Save) | Label → progress text, dims (`aria-busy`) |
| 3.13 | **Sign-in views, inline confirmations, chips, hearts** | Instant swaps / fills; focus moves to the first field / Keep |
| 3.14 | **Hover / focus** | Instant colour and ring changes; focus rings never animate |
| 3.17 | **Basket panel** (and account menu) | Opens with a soft scale-in from its top-right corner (`scale(.97)` + a 10px drop + fade, `opacity` + `transform` only, `--dur-base` `--ease-out`) and closes by playing back the same way (`--dur-base` `--ease-standard`; an `ease-in` exit read as no exit), on every screen size (a floating card, inset on phones, so the motion reads the same); the page is not dimmed (the card floats on a shadow). The shared `Dropdown` (basket, account menu). Its content is rendered ahead once the browser is idle, so the card never changes size as it opens; `visibility` flips after the fade-out so hidden controls can't be tapped or focused |
| 3.18 | **Basket badge** | Each count change re-mounts the badge, which bumps `scale(.6) → 1.18 → 1` (`transform` only, `--dur-slow` `--ease-out`) |
| 3.19 | **Confirm dialog** (guest favourites prompt) | Native `<dialog>`: card fades in and rises 8px + scale .98 → 1, backdrop fades, both `--dur-base` (`@starting-style`; engines without it show it instantly); closes instantly |
| 3.20 | **Wallet pending screen** (`WalletPending`) | Full-screen native `<dialog>` (a centred 420px card on desktop) shown while a mobile-wallet approval is pending. Enters with a 24px rise + fade (`--ease-out`, 420ms); content rises in with staggers (title 200ms, facts 320ms). Loops, all `transform`/`opacity`: icon float (4s; a blue phone in a white circle with the wallet name badge beneath), three halo rings (3.6s, 1.2s apart). On a polled `confirmed` only: the icon fades, a white disc scales in and its check draws (`stroke-dashoffset`, 500ms), then the booking page opens after 1.1s. Reduced motion: rings are hidden, loops stop, and the screen goes straight to the booking on `confirmed` |
| 3.21 | **Trip pill** (`StayFit`) | The guests and rooms segments' 2px fill bars scales with the selection (`transform: scaleX`, `--dur-slow` `--ease-out`); segment colours cross-fade over `--dur-fast`; each of its two buttons presses to `scale(.97)`. They open the calendar (3.1) and guests & rooms (3.2): bottom sheets on phones, on desktop popovers that rise 4px into place above the bar (`.cal.up`, `.trp.up`). The room card hint fades in (opacity, `--dur-base`) |
| 3.22 | **Photo lightbox** | Native full-screen `<dialog>`: fades in over `--dur-base` `--ease-out` (`@starting-style`) and fades out the same way; no scale or movement. Photos are stacked and cross-fade (opacity only, `--dur-base` `--ease-standard`), with no sliding, so it is gentle for anyone sensitive to motion; a swipe changes photo on release. Under `prefers-reduced-motion` the fades are 1ms. Pinch, double-tap, wheel and button zoom and pan are instant `transform`s. Thumbnail/counter updates are instant |

---

## 4. Mount / unmount pattern

```ts
// src/lib/motion/presence.ts
const { ref, mounted, shown } = usePresence<HTMLDivElement>(open);   // render while `mounted`; add `.show` while `shown`
afterTransition(el, done);  // transitionend of the longest transition, or a timer at its length + 50ms; at once when nothing animates
```
- Enter: `open` → mounted (rendered without `.show`) → the hidden state is laid out (`getBoundingClientRect`) → next frame `.show` is added, so the CSS transition runs.
- Exit: `.show` is removed first; `afterTransition` reads the element's computed transition and unmounts after it, so a popover leaves after its 150ms and a mobile sheet after its 320ms, with no hard-coded timings. Elements with no transition (reduced motion) unmount immediately.
- Used by the calendar and the guests & rooms popover / sheets. One overlay at a time (`useExclusive`); Esc (`useEscape`), outside press (`useOutsidePress`) and focus return (`useReturnFocus`) come from the same module.
- A row being removed (a basket room, set to 0) stays in place as a closed accordion and unmounts through the accordion's `onClosed` once its height transition ends, so the list collapses instead of jumping; the same for a whole stay (a hotel card in the basket) when its last room is removed, and for the filled basket when it empties; the mobile checkout Order summary opens and closes through the same accordion.
- The accordion (`components/Accordion.tsx`) marks itself `.settled` and scrolls into view (`reveal()`) through the same helper, i.e. when its height transition has really ended.
- Elements that always exist (filters panel, drawer, accordion) toggle a class (`.open`); `visibility` is delayed on exit so hidden content cannot be focused but still animates out, and closed panels are `inert`.

---

## 5. Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important;
    animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
}
```
- Covers everything, including the drawer (the `!important` beats the mobile block). `afterTransition` sees a ~0 duration and unmounts immediately.
- The room highlight and smooth scrolling become instant; nothing essential depends on motion.

---

## 6. Performance and quality checklist
- Only `transform` / `opacity` animate, except the accordion's `grid-template-rows` (the only CSS way to animate to content height).
- The drawer spring is a CSS `linear()` curve: compositor-driven, no JS per frame, interruptible (a reversed transition continues from where it is).
- Sheets keep `will-change: transform` only while mounted; no animation on first load; one overlay at a time (`useExclusive`).
- No work per animation frame or input tick in React: the price slider moves from local state and writes the URL 200ms after the last move or on release (`features/search/PriceFilter`), not one router navigation per tick.
- Judge motion in the production build (`npm start`): the dev server's unminified React, StrictMode double renders and HMR make everything feel slower than it is.
- Test at 375px on iOS Safari and a mid-range Android (Chrome), and at 1440px to confirm desktop is unchanged (diff computed `transition`/`transform`/`animation` of animated elements).

---

## 7. Planned / removed ideas (not built)

A broader iOS treatment was built and then deliberately narrowed to the two items above. These were removed and can return if wanted; the figures come from Apple's own docs and WebKit (Apple's engine) source:

| Idea | Figures |
|---|---|
| Sheets, backdrops, accordions and chevrons on the iOS spring | `--ios-spring` as in §2.1 |
| Toast as an iOS HUD | Rises 16px + scale .92 on a small-bounce spring (duration 0.5, bounce 0.15: [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10158/) "small bounce", 696ms to rest), fade 350ms (`easeInOut` default 0.35s, [Apple docs](https://developer.apple.com/documentation/swiftui/animation/easeinout)) |
| iOS switch | WebKit's iOS values: thumb spring mass 1, stiffness 322.27, damping 31.24 (487ms to rest vs WebKit's 488ms toggle duration); held for 200ms, the thumb stretches over 507ms (`RenderThemeIOS.h`, `RenderThemeCocoa.mm`, `CheckboxInputType.cpp`) |
| Press feedback | Controls dim to opacity .75 (WebKit `RenderThemeIOS.mm`); cards sink to .97 on SwiftUI `interactiveSpring` (response 0.15, damping fraction 0.86) |
| Segmented-control thumb, heart bounce | Small-bounce spring; 1 → .85 → 1.15 → 1 |
| Drag to dismiss sheets | Project the release with `(v/1000)·d/(1−d)`, `d = 0.998` ([WWDC18 "Designing Fluid Interfaces"](https://developer.apple.com/videos/play/wwdc2018/803/)); dismiss past 50% of the sheet height, else spring back; rubber-band `x·c·dim/(dim + c·x)`, c = 0.55 (reverse-engineered UIScrollView); add a 36 × 5 grabber only together with the gesture |
| Pay button processing | 16px spinner beside the label; a countdown ring around the mobile-money timer (today: a text countdown) |
| Sticky bar state change | Cross-fade the left text when switching from "From $80" to "1 room · $200 · 2 nights" |
