# 08 · Theming (light, dark, system)

AVORA has two themes. The user picks **System** (default), **Light** or **Dark** with the *Appearance* select in the footer, next to Language. The choice is stored in `localStorage` under `avora.theme` (a JSON string) and applies instantly, with no reload.

## Architecture

- `src/styles/tokens.css` is the single source. `:root` holds the light values; `:root[data-theme='dark']` overrides only colours and shadows. Each sets `color-scheme` so native controls follow.
- `src/lib/theme.ts` resolves the preference (`system` follows `prefers-color-scheme` and updates live; an explicit choice wins) and sets `data-theme` on `<html>`. `initTheme()` runs from `main.tsx`; `useThemePref()` backs the footer select.
- `index.html` has a small inline script that sets `data-theme` before first paint (same key, same rules), so there is no flash of the wrong theme. `html` has `background: var(--bg)` so overscroll and loading never show white.
- Components use tokens only. There are no `data-theme` checks in React.

## Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` page | `#f4f4f2` | `#111111` |
| `--card` (= `--surface-elevated`) | `#ffffff` | `#1a1d20` |
| `--surface-2` nested sections, chips, prefixes | `#f4f4f2` | `#22262a` |
| `--surface-hover` hover and current rows | `#f4f4f2` | `#292e33` |
| `--surface-hover-strong` (review-rating link hover) | `#ececea` | `#292e33` |
| `--ink` / `--ink2` / `--muted` | `#111` / `#333` / `#6b6b66` | `#f5f5f3` / `#d0d3d5` / `#a0a5aa` |
| `--line` / `--input-border` | `#e4e4e1` / `#cfcfca` | `#30353a` / `#454b52` |
| `--link` | `#1d4ed8` | `#8ab4ff` |
| `--on-ink` (text on an `--ink` fill) | `#fff` | `#111111` |
| `--ok` / `--okbg` / `--success-border` | `#0a7a4a` / `#e6f4ec` / `#bfe3cf` | `#54d49a` / `#153b2b` / `#1f5a41` |
| `--warn` / `--warnbg` / `--warning-border` | `#9a3412` / `#fff1e6` / `#f6cfb0` | `#ffb477` / `#42291c` / `#6b4529` |
| `--err` / `--errbg` / `--error-border` | `#c0262d` / `#fdecec` / `#f1c0c2` | `#ff777c` / `#421f23` / `#6e3238` |
| `--button-primary-bg/-text/-hover` | `#111` / `#fff` / `#2a2a2a` | `#f5f5f3` / `#111111` / `#e1e3e3` |
| `--button-secondary-bg/-text/-border` | `#fff` / `#111` / `var(--line)` | `#1a1d20` / `#f5f5f3` / `var(--input-border)` (brighter than card outlines so ghost buttons read as buttons) |
| `--button-danger-bg/-hover` | `#c0262d` / `#a51f26` | same (white text must stay readable) |
| `--focus-ring` | `#111` | `#f5f5f3` |
| `--field-ring` | `rgba(0,0,0,.1)` | `rgba(245,245,243,.18)` |
| `--calendar-bg/-day-text` | `#fff` / `#111` | `#1a1d20` / `#f5f5f3` |
| `--calendar-disabled-text` / `--calendar-range-bg` | `#c4c4bf` / `#ececea` | `#6a7077` / `#2f353b` |
| `--calendar-selected-bg/-text` | `#111` / `#fff` | `#f5f5f3` / `#111111` |
| `--card-outline` (home search card, join prompt ring) | `var(--ink)` | `#454b52` |
| `--backdrop` | `rgba(0,0,0,.5)` | `rgba(0,0,0,.65)` |
| `--shadow-card`, `--shadow-overlay`, `--shadow-pop`, `--shadow-search`, `--shadow-sticky` | the existing light shadows | quieter, with a 1px `--line` ring so cards read by border |

Header, hero and footer stay black in both themes (`--header-bg/-text/-line/-hover`; `--header-muted` is `#ddd` in light and `#c7c7c7` in dark). Descriptive aliases (`--text-primary`, `--border-default`, `--surface-primary` …) point at the tokens above.

Rule: `var(--bg)` is for the page only. Anything nested in a card uses `--surface-2` (resting) or `--surface-hover`. A fill of `--ink` always pairs with `--on-ink`.

## Not themed on purpose

Property and room photos and the `.ph` placeholders; the lightbox; the WalletPending blue screen; Google, Apple and WhatsApp marks and the WhatsApp button green; avatar colours (`hsl(h 38% 40%)`); the pink heart, star gold and basket-count orange; the heart's white circle on photos.

## Contrast (WCAG ratios, computed from the token values)

Body and secondary text, muted text, links, and each status colour on its own background pass 4.5:1 in both themes (lowest: muted on `--surface-hover` 5.5 dark / 4.7 light; `--ok` on `--okbg` 4.75 light). Selected calendar dates, range text, primary buttons and the score badge are 15:1 or better.

Known gap: `--input-border` against `--card` is 1.56:1 in light (unchanged from before) and 1.92:1 in dark, below the 3:1 non-text guideline. Fields are also separated by their fill and label; raising it would change the light design, so it is left for a design decision. The disabled calendar day colour is exempt from contrast rules and measures 1.75 light / 3.4 dark.

No colour in the proposed palette was changed. Additions beyond it: `--card-outline`, `--seg-thumb`, `--skeleton`, `--map-bg`, `--star-empty-bad`, `--select-chevron`, and the status border and shadow tokens.
