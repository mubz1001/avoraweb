import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import { session } from '@/lib/storage';

/**
 * Remembers a page's scroll position per path and restores it when the page is reopened by an in-app "back" link that
 * passes `state={{ returning: true }}` with `preventScrollReset` (e.g. reviews → property). Browser Back/Forward is left
 * to the router's ScrollRestoration. Call once the page's content has rendered (`ready`), so the target exists.
 */
export function useReturnScroll(ready: boolean) {
  const { pathname, state } = useLocation();
  const key = `avora.scroll.${pathname}`;
  const returning = !!(state as { returning?: boolean } | null)?.returning;

  useLayoutEffect(() => {
    if (!ready || !returning) return;
    const y = session.get<number>(key, 0);
    if (y > 0) window.scrollTo({ top: y, behavior: 'instant' });
  }, [ready, returning, key]);

  useLayoutEffect(() => () => void session.set(key, Math.round(window.scrollY)), [key]);
}
