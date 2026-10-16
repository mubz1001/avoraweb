import { useEffect, useRef, useState } from 'react';
import { FilterGroup } from '@/components/FilterPanel';
import { formatMoney } from '@/lib/money';
import { t } from '@/lib/i18n';

/**
 * Max-price slider. The thumb and label follow the drag at once from local state; the URL (and so the search) is
 * written 200ms after the last move, or at once on release, so a drag is not one router navigation per tick. A change
 * from elsewhere (Clear, Back) resets the draft.
 */
export function PriceFilter({
  unit,
  range,
  value,
  onCommit,
}: {
  unit: 'day' | 'night';
  range: { min: number; max: number; step: number };
  value: number;
  onCommit: (dollars: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [sent, setSent] = useState(value); // the last value written to the URL
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    // Our own write landing mid-drag must not pull the thumb back; a change from elsewhere resets it.
    if (value !== sent) {
      setDraft(value);
      setSent(value);
    }
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (v: number) => {
    clearTimeout(timer.current);
    if (v === sent) return;
    setSent(v);
    onCommit(v);
  };
  const flush = () => commit(draft);

  return (
    <FilterGroup
      title={
        <>
          {t('Max price per {unit}:', { unit: t(unit) })}{' '}
          <span>{draft >= range.max ? t('Any') : formatMoney(draft * 100)}</span>
        </>
      }
    >
      <input
        type="range"
        aria-label={t('Maximum price per {unit}', { unit: t(unit) })}
        min={range.min}
        max={range.max}
        step={range.step}
        value={draft}
        onChange={(e) => {
          const v = Number(e.target.value);
          setDraft(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(v), 200);
        }}
        onPointerUp={flush}
        onKeyUp={flush}
        onBlur={flush}
      />
    </FilterGroup>
  );
}
