import { useCallback, useEffect } from 'react';
import type { Lightbox, LightboxItem } from '@/vendor/lightbox/lightbox';
import type { PropertyImage } from '@/types';

/** One shared lightbox for the whole app, created (with its code and styles) on the first photo tap. */
let shared: Promise<Lightbox> | null = null;
let current: Lightbox | null = null;

const load = () =>
  (shared ??= import('@/vendor/lightbox/lightbox')
    .then((m) => (current = new m.Lightbox()))
    .catch((e: unknown) => {
      shared = null; // a failed chunk load (offline) can be retried on the next tap
      throw e;
    }));

/** Opens photos full screen (docs/05 Lightbox). The dialog closes when the page that opened it goes away. */
export function useLightbox() {
  useEffect(() => () => current?.close(), []);
  return useCallback((images: PropertyImage[], index: number, opener?: HTMLElement | null) => {
    const items: LightboxItem[] = images.map((i) => ({ src: i.url, alt: i.alt }));
    load()
      .then((lb) => lb.open(items, index, opener ?? null))
      .catch(() => {});
  }, []);
}
