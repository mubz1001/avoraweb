import { matchRoutes, type Params, type RouteObject } from 'react-router';

/**
 * Intent prefetch (docs/04 §A.4). When a link is pressed, hovered or focused, the target route's chunk is imported and
 * its loaders run ahead of the click. The router later imports the same (now cached) module, and the loaders only warm
 * the query cache, so the navigation commits without waiting on the network.
 */
type Loader = (args: { params: Params; request: Request }) => unknown;
type Lazy = () => Promise<{ loader?: Loader }>;

let table: RouteObject[] = [];
const inflight = new Map<string, Promise<void>>();

/** The router hands over its route table once, so this module never imports the router (no import cycle). */
export function registerRoutes(routes: RouteObject[]) {
  table = routes;
}

/** Data Saver on: no speculative work (hover, focus, idle). A press still prefetches; the user is about to go there. */
export const saveData = () =>
  typeof navigator !== 'undefined' &&
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

async function run(url: URL, withData: boolean) {
  const matches = matchRoutes(table, url.pathname) ?? [];
  const request = new Request(url);
  await Promise.all(
    matches.map(async ({ route, params }) => {
      const mod = typeof route.lazy === 'function' ? await (route.lazy as Lazy)() : undefined;
      const loader = (route.loader ?? mod?.loader) as Loader | undefined;
      if (withData && loader) await loader({ params, request });
    }),
  );
}

function start(href: string, withData: boolean): Promise<void> {
  if (typeof window === 'undefined' || !table.length) return Promise.resolve();
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return Promise.resolve();
  const key = `${withData ? 'd' : 'c'}:${url.pathname}${url.search}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = run(url, withData)
    .catch(() => undefined) // a failed prefetch is silent; the real navigation shows the error UI
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Imports the route chunk and runs its loaders for `href` (same-origin only, de-duplicated while in flight). */
export const prefetch = (href: string) => start(href, true);

/** Imports the route chunks for `href` now, without data (used at start-up, before the API is ready). */
export const preloadChunks = (href: string) => start(href, false);

/** Runs `fn` once the browser is idle (or after 1.5s where there is no idle callback). Skipped under Data Saver.
 *  Returns a cancel function, so an effect can return it. */
export function onIdle(fn: () => void): () => void {
  if (typeof window === 'undefined' || saveData()) return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(fn, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 1500);
  return () => clearTimeout(id);
}

/** Imports the route chunks only (no data), once the browser is idle. Used for the pages most visits go to next. */
export const preloadWhenIdle = (paths: string[]) => onIdle(() => paths.forEach((p) => void start(p, false)));
