import type { ReactNode } from 'react';
import { StarIcon } from './BrandIcons';
import { Icon } from './Icon';
import './Controls.css';
import { t } from '@/lib/i18n';

/** Small shared controls: Chip, Stepper, Rating, HeartButton (docs/05 Part 1). */

export function Chip({ tone, className, children }: { tone?: 'ok' | 'warn'; className?: string; children: ReactNode }) {
  return <span className={['chip', tone, className].filter(Boolean).join(' ')}>{children}</span>;
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Group label for screen readers, e.g. "Double Room quantity". */
  label: string;
  decLabel: string;
  incLabel: string;
  className?: string;
}

/** − value + with bounds; the buttons disable at the limits. */
export function Stepper({ value, min, max, step = 1, onChange, label, decLabel, incLabel, className }: StepperProps) {
  return (
    <div className={['stepper', className].filter(Boolean).join(' ')} role="group" aria-label={label}>
      <button
        type="button"
        disabled={value <= min}
        aria-label={decLabel}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        disabled={value >= max}
        aria-label={incLabel}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </div>
  );
}

/** ★ 4.6 (212). Nothing is shown below 3 reviews: the caller passes no rating then. */
export function Rating({ score, count }: { score: number; count: number }) {
  return (
    <span className="rate">
      <StarIcon />
      {score.toFixed(1)} <span className="muted rate-n">({count})</span>
    </span>
  );
}

export function ScoreChip({ score }: { score: number }) {
  return (
    <span className="sc">
      <StarIcon />
      {score}
    </span>
  );
}

export function HeartButton({
  on,
  onToggle,
  className,
  floating = true,
}: {
  on: boolean;
  onToggle: () => void;
  className?: string;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      className={['heart', on && 'on', !floating && 'inline', className].filter(Boolean).join(' ')}
      aria-label={on ? t('Remove from favourites') : t('Add to favourites')}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <Icon name="heart" />
    </button>
  );
}

/** Coloured initial for a reviewer or a member. */
export function Avatar({ name, hue }: { name: string; hue: number }) {
  return (
    <span className="av" style={{ '--h': hue } as React.CSSProperties}>
      {name.charAt(0)}
    </span>
  );
}
