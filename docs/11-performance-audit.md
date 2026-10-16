# 11 · Performance audit

What the app costs to load and run, where the cost was, what was changed, and what was left. The rule throughout was to measure first and change only what the measurements showed. No memoisation was added: rendering was not where the time went.

## 1. How it was measured
- **Bundle:** `npm run build`, then gzip -9 of every file in `dist/assets`. "Initial" means every JS and CSS file `dist/index.html` loads or modulepreloads, i.e. everything needed before the first page can render.
- **Runtime:** `vite preview` (the production build) on localhost in Chromium, reading the Performance API: resource timing, paint, LCP, layout shifts and long tasks. Both 1024 px and 375 px wide. No network or CPU throttling.
- **Limits:** localhost has no real network, so millisecond timings show the *order* of work (the waterfall) more than real-world speed. Runs with a warm HTTP cache aren't directly comparable with the cold first baseline run. LCP on the property page couldn't be read while the browser pane was in the background. A real-API build (`VITE_API_MOCK=false`) wasn't measured. There are no field (real-user) metrics; see §6.

## 2. What was already in good shape
- Every page is its own chunk (`lazy` routes). Links prefetch their page's code and data on press, hover and focus (`lib/prefetch`), and the search and property chunks preload once the first page is idle.
- The Google map loads only when its section nears the viewport. The lightbox code loads on the first photo tap.
- **CLS was 0** on Home and the property page: images carry width and height, and slots have fixed aspect ratios.
- No long tasks (> 50 ms) were recorded. The catalogue is paginated (10 per page), so long-list virtualisation isn't needed.
- Listeners, timers and observers are removed on unmount. The toast context value is stable. TanStack Query de-duplicates requests and cancels obsolete ones through `signal`.

## 3. Findings and changes
Ranked by user-visible effect.

| # | Finding (evidence) | Change | Risk |
|---|---|---|---|
| 1 | **Photos about 4× too large.** Cards about 316 px wide (Home) and 112 or 200 px (search list) downloaded 1200 × 800 JPEGs of 86–303 KB. | `scripts/make-photos.mjs` makes 480/800/1200 px WebP copies (the JPEGs were removed). `PropertyImage` sends `srcset` plus a per-slot `sizes`. The image type gains an optional `srcset` (06 §2). The lightbox still opens the 1200 px copy. | Low |
| 2 | **Photos at the top of the page were lazy-loaded.** Every `<img>` was `loading="lazy"`, including the property page hero and the first cards, which delays LCP. | New `priority` prop (`eager` + `fetchpriority="high"`) on the first Featured card, the first search result, and the first photo of the gallery layout in use. The hidden layout's copy stays lazy, so it is never fetched. | Low |
| 3 | **React Hook Form loaded on every first visit.** `QueryError` (in the always-mounted basket panel) imported `errorMessage` from `components/forms.ts`, which imports RHF. | `errorMessage` moved to `lib/api/errors.ts` and is re-exported from `forms.ts`, so no form caller changed. RHF now loads only with a page that has a form. | Low |
| 4 | **Somali and Arabic strings loaded for every visitor.** 52 KB raw / 16 KB gz in the initial bundle, though English is the default. | Each dictionary is its own chunk, loaded when chosen. `initLang()` waits for the saved one before the first render, and `setLang()` switches once it's in (04 §i18n). | Medium. Covered by unit tests and checked in the browser: switching, RTL, reload. |
| 5 | **Availability fetched twice per property visit.** The loader fetched it, then the page refetched on mount (`staleTime: 0`). Measured: two `/availability` requests 45 ms apart. | `staleTime: 30_000`. Checkout's own availability and price re-check (`staleTime: 0` at submit) is unchanged. | Low |
| 6 | **Hashed assets weren't cached long-term.** `vercel.json` had no cache rule for `/assets/*`, so repeat visits revalidated every chunk. | `public, max-age=31536000, immutable` on `/assets/*`, and one day on `/placeholder/*` (unhashed names). | Low. Only verifiable on the deployed host. |
| 7 | **The first page's code waited for the mock API.** The page chunk only started after MSW (175 KB gz) had downloaded and its service worker had started. | `main.tsx` calls `preloadRoute(location.href)` before starting MSW, so both download together. | Low. No effect on a real-API build, which has no MSW. |

## 4. Before and after

**Initial bundle** (gzip, everything loaded before the first render; both builds from the same source apart from these changes):

| | Before | After | Change |
|---|---|---|---|
| Initial JS + CSS | **186,963 B** | **156,902 B** | **−30.1 KB (−16 %)** |
| of which i18n | 15,749 B | 1,301 B | Somali 8.5 KB and Arabic 9.0 KB now load on demand |
| of which form library + Zod chunk | 37,385 B | 23,943 B | RHF (about 13 KB) moved to the lazy `forms` chunk; Zod stays |
| MSW (mock only, loaded next) | 174,776 B | 174,857 B | unchanged |

**Photos** (bytes for all 16 placeholder photos at the size a slot downloads):

| Set | Bytes | vs. the old JPEGs (2,425,357 B) |
|---|---|---|
| 1200 px WebP (lightbox, wide desktop) | 1,698,544 B | −30 % |
| 800 px WebP (cards and gallery on 2× phones) | 841,506 B | −65 % |
| 480 px WebP (search list, small slots) | 330,084 B | −86 % |

Per photo on Home: `exterior-1` went from 96.9 KB to 30.6 KB (800 px), and `exterior-3` from 303 KB to 131.5 KB. One that didn't improve much: `exterior-3` at 1200 px is still 280 KB (a detailed, noisy photo), only 8 % smaller than the JPEG. The folder on disk grew from 2.4 MB to 2.9 MB because it now holds three sizes, but no visitor downloads more than one size of a photo.

**Requests and waterfall** (localhost):
- Property page: `/availability` went from 2 requests to **1**.
- Home: the page chunk now starts at about 72–138 ms, alongside MSW, where before it started at 416 ms, after MSW. Home's data arrived at 167–214 ms against 516 ms before. These later runs had a warm HTTP cache, so part of that gain is caching. The ordering change is the part that carries over to real networks.
- Home FCP and LCP: 720 / 804 ms before (cold). After, 256–300 ms (warm, LCP = the first card's 800 px WebP). Because the caches differ, this is **not a like-for-like comparison** and isn't claimed as an improvement. A cold, throttled comparison is in §6.
- CLS stayed at 0. There were still no long tasks. The only console errors were the expected 401s from the signed-out session check.

## 5. Checks
`npm run typecheck`, `npm run lint`, `npm test` (264 tests), `npm run i18n:check` and `npm run build` all pass. `npm run e2e` passes: 33 passed, 1 skipped. Four sign-in tests had been failing (at both viewports) because `getByLabel('Email')` also matched the reset form's inert, collapsed Email field; they now select by role (`getByRole('textbox', { name: 'Email' })`), which only sees the real field.

## 6. Left as is, and what to do next
1. **Zod is in the initial bundle** (about 24 KB gz with its chunk). It's needed to validate the session response before the header renders. `zod/mini` is tree-shakeable and would save about 10 KB gz, but it means rewriting every schema and form resolver. Worth doing as its own change.
2. **MSW is 175 KB gz and blocks the first render.** That's the single largest cost, but it only exists because the backend doesn't yet. A real-API build drops it entirely, which is the biggest remaining win and needs no frontend work.
3. **Real photos need an image service.** The backend or a CDN (for example Cloudinary, imgix or Vercel Image Optimization) should return `srcset` candidates (AVIF/WebP) in the existing `PropertyImage` shape. The frontend already uses them.
4. **Field data.** Add Web Vitals reporting (LCP, INP, CLS by route and device) to an analytics endpoint, and run a cold, throttled Lighthouse or WebPageTest pass on the deployed site (Slow 4G, mid-range phone) to confirm the gains from §3 #1, #2, #6 and #7 there.
5. **Small items not worth their risk today:** lazy-loading the closed basket drawer (a few KB, and it would slow down the first open), and loading the property's availability alongside the property itself (it needs the property's type first).
