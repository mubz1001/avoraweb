import type { CSSProperties } from 'react';
import './Skeleton.css';

/** Loading placeholder (docs/06 §8). Pulses opacity only, so it stays on the compositor. Hidden from assistive tech;
 *  the region that is loading carries aria-busy instead. */
export function Skeleton({
  width,
  height = 14,
  radius,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={['skel', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** A result-card-shaped skeleton (thumbnail + three lines). */
export function CardSkeleton({ horizontal }: { horizontal?: boolean }) {
  return (
    <div className={['card skel-card', horizontal && 'h'].filter(Boolean).join(' ')} aria-hidden="true">
      <Skeleton className="skel-img" height="auto" />
      <div className="skel-lines">
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" />
        <Skeleton width="30%" />
      </div>
    </div>
  );
}
