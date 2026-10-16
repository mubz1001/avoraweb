import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Calls `done` once the element's longest transition has ended (its transitionend, or a safety timer at that length +
 * 50 ms), or at once when nothing animates (reduced motion, or a breakpoint without a transition). Exits therefore
 * never wait on guessed timings. Returns a cancel function.
 */
export function afterTransition(el: Element, done: () => void): () => void {
  const cs = getComputedStyle(el);
  const secs = (v: string) => v.split(',').map((x) => parseFloat(x) * 1000 || 0);
  const dur = secs(cs.transitionDuration);
  const del = secs(cs.transitionDelay);
  const total = Math.max(0, ...dur.map((d, i) => d + (del[i % del.length] ?? 0)));
  if (total < 1) {
    done();
    return () => {};
  }
  let finished = false;
  const fin = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener('transitionend', end);
    clearTimeout(timer);
    done();
  };
  const end = (e: Event) => {
    const t = e as TransitionEvent;
    if (t.target === el && t.elapsedTime * 1000 >= Math.max(...dur) - 5) fin();
  };
  el.addEventListener('transitionend', end);
  const timer = setTimeout(fin, total + 50);
  return () => {
    finished = true;
    el.removeEventListener('transitionend', end);
    clearTimeout(timer);
  };
}

/**
 * Animated mount/unmount (docs/07 §4). While `open`, the element is mounted and, one frame after its first layout,
 * gets `shown` (the `.show` class) so its CSS transition runs. On close, `shown` drops first and the element unmounts
 * only after the exit transition finishes.
 */
export function usePresence<T extends HTMLElement>(
  open: boolean,
): { ref: RefObject<T | null>; mounted: boolean; shown: boolean } {
  const ref = useRef<T | null>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  // Render-phase adjustments: mount as soon as it opens, drop `.show` as soon as it closes.
  if (open && !mounted) setMounted(true);
  if (!open && shown) setShown(false);

  useEffect(() => {
    if (!open || !mounted) return;
    ref.current?.getBoundingClientRect(); // lay out the hidden state first so the transition has a start
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open, mounted]);

  useEffect(() => {
    if (open || shown || !mounted) return;
    const el = ref.current;
    if (el) return afterTransition(el, () => setMounted(false));
    const id = requestAnimationFrame(() => setMounted(false));
    return () => cancelAnimationFrame(id);
  }, [open, shown, mounted]);

  return { ref, mounted, shown };
}

/** Only one popover (calendar, guests, menu) is open at a time: claiming one closes the previous. */
let openClose: (() => void) | null = null;

export function useExclusive(open: boolean, close: () => void) {
  const latest = useRef(close);
  useLayoutEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const mine = () => latest.current();
    if (openClose && openClose !== mine) openClose();
    openClose = mine;
    return () => {
      if (openClose === mine) openClose = null;
    };
  }, [open]);
}

/** Esc closes the overlay while it is open. */
export function useEscape(open: boolean, close: () => void) {
  const latest = useRef(close);
  useLayoutEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
}

/** A press outside every given element closes the popover. */
export function useOutsidePress(open: boolean, refs: RefObject<HTMLElement | null>[], close: () => void) {
  const latest = useRef(close);
  useLayoutEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (refs.every((r) => !r.current?.contains(t))) latest.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ref objects are stable
  }, [open]);
}

/** Moves focus back to the element that opened an overlay once it closes (docs/04 B.6 accessibility). */
export function useReturnFocus(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    return () => {
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, [open]);
}

/** Whether a media query matches, live. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Matches the single 768px breakpoint, live. */
export function useIsMobile(): boolean {
  return useMedia('(max-width: 767px)');
}
