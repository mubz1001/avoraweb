import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { catalogApi, queryKeys } from '@/lib/api/endpoints';
import { plural } from '@/lib/money';
import type { PropertyType } from '@/types';
import { t } from '@/lib/i18n';

interface Option {
  label: string;
  sub: string;
  value: string;
  propertyId?: string;
}

interface Props {
  type: PropertyType;
  value: string;
  onChange: (v: { city: string; propertyId: string }) => void;
}

/**
 * City / property autocomplete (docs/05 CityCombobox, ARIA 1.2 combobox). Opens on focus, filters as you type (GET
 * /suggest, debounced 200 ms, previous list kept while loading), arrow keys + Enter, Esc closes. A ✕ at the right clears the field. Picking a property
 * makes the search go straight to it.
 */
export function CityCombobox({ type, value, onChange }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [q, setQ] = useState(value);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setQ(value), 200);
    return () => clearTimeout(t);
  }, [value]);
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const { data } = useQuery({
    queryKey: queryKeys.suggest(q.trim().toLowerCase(), type),
    queryFn: ({ signal }) => catalogApi.suggest(q.trim(), type, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const cities: Option[] = (data?.cities ?? []).map((c) => ({
    label: c.name,
    sub: plural(c.count, type === 'hall' ? 'hall' : 'stay'),
    value: c.name,
  }));
  const props: Option[] = (data?.properties ?? []).map((p) => ({
    label: p.name,
    sub: p.city,
    value: p.name,
    propertyId: p.id,
  }));
  const items = [...cities, ...props];
  const optId = (i: number) => `${id}-o${i}`;

  const pick = (i: number) => {
    const o = items[i];
    if (!o) return;
    onChange({ city: o.value, propertyId: o.propertyId ?? '' });
    setOpen(false);
    setActive(-1);
  };

  useEffect(() => {
    if (active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optId is derived from the stable id
  }, [active]);

  const option = (o: Option, i: number) => (
    <li
      key={`${o.propertyId ?? 'c'}-${o.value}`}
      id={optId(i)}
      role="option"
      aria-selected={i === active}
      onMouseDown={(e) => {
        e.preventDefault();
        pick(i);
      }}
    >
      <span>{o.label}</span>
      <small>{o.sub}</small>
    </li>
  );

  return (
    <div className="field combo">
      <label className="lbl" htmlFor={id}>
        {type === 'hall' ? t('City (optional)') : t('Where are you going?')}
      </label>
      <div className="fwrap">
        <Icon name="pin" />
        <input
          ref={inputRef}
          id={id}
          className="inp ic"
          name="city"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
          autoComplete="off"
          placeholder={t('City or hotel name')}
          value={value}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
          }}
          onChange={(e) => {
            onChange({ city: e.target.value, propertyId: '' });
            setOpen(true);
            setActive(-1);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && open && active >= 0) {
              e.preventDefault();
              pick(active);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {value ? (
          // mouse-down is held back so the input keeps focus (and the list stays open) while it is cleared
          <button
            type="button"
            className="fclear"
            aria-label={t('Clear location')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange({ city: '', propertyId: '' });
              setActive(-1);
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>
      <ul ref={listRef} id={listId} role="listbox" className={['sugg', !open && 'hidden'].filter(Boolean).join(' ')}>
        {cities.length ? (
          <li className="gh" role="presentation">
            {t('Cities')}
          </li>
        ) : null}
        {cities.map((o, i) => option(o, i))}
        {props.length ? (
          <li className="gh" role="presentation">
            {type === 'hall' ? t('Wedding halls') : t('Hotels')}
          </li>
        ) : null}
        {props.map((o, i) => option(o, cities.length + i))}
        {data && !items.length ? (
          <li className="gh" role="presentation">
            {t('No match – try Mogadishu, Hargeisa or Garowe')}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
