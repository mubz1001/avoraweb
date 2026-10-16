import { Link, useHref, type LinkProps } from 'react-router';
import { prefetch, saveData } from '@/lib/prefetch';

/** In-app link. Pressing, hovering or focusing it prefetches the page (lib/prefetch), so the tap commits at once.
 *  Navigation itself is instant: pages do not animate in or out (docs/07). */
export function AppLink({ onPointerDown, onMouseEnter, onFocus, to, ...rest }: LinkProps) {
  const href = useHref(to);
  return (
    <Link
      {...rest}
      to={to}
      onPointerDown={(e) => {
        void prefetch(href);
        onPointerDown?.(e);
      }}
      onMouseEnter={(e) => {
        if (!saveData()) void prefetch(href);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        if (!saveData()) void prefetch(href);
        onFocus?.(e);
      }}
    />
  );
}
