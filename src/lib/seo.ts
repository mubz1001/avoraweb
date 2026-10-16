import { useEffect } from 'react';

/** Per-page search and share tags. index.html carries the site-wide defaults (title, description, canonical, Open Graph,
 *  Twitter, robots); a page overrides some of them while it is shown and the defaults come back when it goes away, so
 *  there is never a second copy of a tag in the head. The page title itself is a plain <title> in the page. */
export interface Seo {
  description?: string;
  /** Path of this page's canonical address on the site, e.g. `/stays/lido`. */
  path?: string;
  /** Absolute or site-relative URL of the share image. */
  image?: string;
  /** Keep the page out of search results (private, transactional or thin pages). */
  noindex?: boolean;
}

const meta = (attr: 'name' | 'property', key: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);

export function useSeo({ description, path, image, noindex }: Seo) {
  useEffect(() => {
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const origin = canonical ? new URL(canonical.href).origin : window.location.origin;
    const abs = (u: string) => (/^https?:/.test(u) ? u : origin + u);
    const undo: (() => void)[] = [];
    const set = (el: HTMLMetaElement | HTMLLinkElement | null, attr: 'content' | 'href', value: string) => {
      if (!el) return;
      const prev = el.getAttribute(attr);
      el.setAttribute(attr, value);
      undo.push(() => (prev === null ? el.removeAttribute(attr) : el.setAttribute(attr, prev)));
    };
    if (description) {
      set(meta('name', 'description'), 'content', description);
      set(meta('property', 'og:description'), 'content', description);
      set(meta('name', 'twitter:description'), 'content', description);
    }
    if (path) {
      set(canonical, 'href', origin + path);
      set(meta('property', 'og:url'), 'content', origin + path);
    }
    if (image) {
      set(meta('property', 'og:image'), 'content', abs(image));
      set(meta('name', 'twitter:image'), 'content', abs(image));
    }
    if (noindex) set(meta('name', 'robots'), 'content', 'noindex, nofollow');
    // Share cards use the page title, so they follow it.
    const title = document.title;
    set(meta('property', 'og:title'), 'content', title);
    set(meta('name', 'twitter:title'), 'content', title);
    return () => undo.reverse().forEach((u) => u());
  }, [description, path, image, noindex]);
}
