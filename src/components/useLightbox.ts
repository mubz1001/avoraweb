import { useCallback, useEffect } from 'react';
import { onIdle } from '@/lib/prefetch';
import type { Lightbox, LightboxItem } from '@/vendor/lightbox/lightbox';
import type { PropertyImage } from '@/types';

/** One shared lightbox for the whole app: its code, styles and dialog are fetched and built while the page is idle (and
 *  at the latest on the first finger-down on a photo), so the first tap doesn't wait for them. */
let shared: Promise<Lightbox> | null = null;
let current: Lightbox | null = null;

const load = () =>
  (shared ??= import('@/vendor/lightbox/lightbox')
    .then((m) => (current = new m.Lightbox()))
    .catch((e: unknown) => {
      shared = null; // a failed chunk load (offline) can be retried on the next tap
      throw e;
    }));

/** The smallest of a photo's responsive candidates ("…-480.webp 480w, …"), for the thumbnail strip. */
const smallest = (i: PropertyImage) => {
  const w = (i.srcset ?? '').split(',').map((c) => c.trim().split(/\s+/));
  const byWidth = w.filter(([u, d]) => u && d?.endsWith('w')).sort((a, b) => parseInt(a[1]!) - parseInt(b[1]!));
  return byWidth[0]?.[0] ?? i.url;
};

/** Opens photos full screen (docs/05 Lightbox). The dialog closes when the page that opened it goes away. */
export function useLightbox() {
  useEffect(() => {
    const cancel = onIdle(() => void load().catch(() => {}));
    return () => {
      cancel();
      current?.close();
    };
  }, []);
  return useCallback((images: PropertyImage[], index: number, opener?: HTMLElement | null) => {
    // The photo on the tapped tile is already in the browser's cache, so it can stand in for the large one.
    const shown = opener?.querySelector('img')?.currentSrc;
    const items: LightboxItem[] = images.map((i, k) => ({
      src: i.url,
      alt: i.alt,
      thumb: smallest(i),
      preview: k === index ? shown || undefined : undefined,
    }));
    load()
      .then((lb) => lb.open(items, index, opener ?? null))
      .catch(() => {});
  }, []);
}

/** Warms the lightbox the moment a finger or pointer lands on a photo, ahead of the click. */
export const warmLightbox = () => void load().catch(() => {});
