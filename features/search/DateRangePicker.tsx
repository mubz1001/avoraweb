import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { fmtWeekday, iso, monthName, nightsBetween, parseDate, today } from '@/lib/dates';
import { plural } from '@/lib/money';
import type { PopoverTrigger } from './GuestsRoomsPicker';
import {
  useEscape,
  useExclusive,
  useIsMobile,
  useOutsidePress,
  usePresence,
  useReturnFocus,
} from '@/lib/motion/presence';
import { t } from '@/lib/i18n';

interface Props {
  hall: boolean;
  checkIn: string;
  checkOut: string;
  onChange: (range: { checkIn: string; checkOut: string }) => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MAX_MONTHS_AHEAD = 10;

/**
 * One date-range field with a shared calendar (docs/05 DateRangePicker): click check-in, then check-out. Desktop: a
 * popover with two months and prev/next. Mobile: a bottom sheet with 12 scrolling months. Halls pick a single date.
 * The calendar never closes by itself: picks only build a draft, **Clear** empties it, and **Done** (enabled once the
 * range is complete) applies it. Closing any other way keeps the previous dates.
 *
 * `DateRangePopover` is the calendar around any trigger (render prop), with `placement="above"` for triggers at the
 * bottom of the screen (phones always get the sheet); `DateRangePicker` is the search form's field built on it.
 */
export function DateRangePopover({
  hall,
  checkIn,
  checkOut,
  onChange,
  className,
  placement = 'below',
  children,
}: Props & {
  className?: string;
  placement?: 'below' | 'above';
  children: (trigger: PopoverTrigger) => ReactNode;
}) {
  const mobile = useIsMobile();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(checkIn);
  const [end, setEnd] = useState<string | null>(checkOut);
  const [hover, setHover] = useState<string | null>(null);
  const base = new Date(today().getFullYear(), today().getMonth(), 1);
  const [view, setView] = useState(base);
  const { ref: popRef, mounted, shown } = usePresence<HTMLDivElement>(open);
  const close = () => setOpen(false);

  useExclusive(open, close);
  useEscape(open, close);
  useOutsidePress(open, [boxRef, popRef], close);
  useReturnFocus(open);

  const monthsFromBase = (d: Date) => (d.getFullYear() - base.getFullYear()) * 12 + d.getMonth() - base.getMonth();

  function toggle() {
    if (open) return close();
    const s = parseDate(checkIn);
    setStart(checkIn);
    setEnd(hall ? null : checkOut);
    setHover(null);
    setView(mobile ? base : new Date(Math.max(+base, +new Date(s.getFullYear(), s.getMonth(), 1))));
    setOpen(true);
  }

  // Mobile sheet: scroll the month holding check-in into view when it opens.
  useLayoutEffect(() => {
    if (!mounted || !mobile) return;
    const holder = popRef.current?.querySelector<HTMLElement>('.cal-months');
    const idx = Math.max(0, monthsFromBase(parseDate(checkIn)));
    const m = holder?.querySelector<HTMLElement>(`.cal-m[data-i="${idx}"]`);
    if (holder && m) holder.scrollTop = m.offsetTop - 4;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount of the sheet
  }, [mounted]);

  /** A pick only builds the draft; Done applies it. */
  function pick(dt: string) {
    if (hall) return setStart(dt);
    if (!start || end || dt <= start) {
      setStart(dt);
      setEnd(null);
      setHover(null);
      return;
    }
    setEnd(dt);
    setHover(null);
  }

  const complete = hall ? !!start : !!(start && end);

  function clear() {
    setStart(null);
    setEnd(null);
    setHover(null);
  }

  function done() {
    if (!start || (!hall && !end)) return;
    onChange({ checkIn: start, checkOut: hall ? iso(new Date(+parseDate(start) + 864e5)) : end! });
    close();
  }

  /** While only check-in is chosen, pointing at (or tabbing to) a day previews the range. */
  const preview = (e: React.SyntheticEvent) => {
    const d = (e.target as HTMLElement).closest<HTMLButtonElement>('.cd');
    if (start && !end && d && !d.disabled && hover !== d.dataset.d) setHover(d.dataset.d ?? null);
  };

  const effEnd = end ?? (start && hover && hover > start ? hover : null);
  const todayIso = iso(today());
  const count = mobile ? 12 : 2;
  const months = Array.from({ length: count }, (_, i) => new Date(view.getFullYear(), view.getMonth() + i, 1));
  const nights = start && end ? nightsBetween(start, end) : 0;
  const summary = hall
    ? start
      ? fmtWeekday(start)
      : t('Select a date')
    : end && start
      ? `${plural(nights, 'night')} · ${fmtWeekday(start)} – ${fmtWeekday(end)}`
      : start
        ? t('Select your check-out date')
        : t('Select your check-in date');

  const popover = mounted ? (
    <div
      ref={popRef}
      className={['cal', placement === 'above' && 'up', mobile && 'mob', shown && 'show'].filter(Boolean).join(' ')}
      role="dialog"
      aria-label={hall ? t('Choose event date') : t('Choose your dates')}
      onMouseOver={preview}
      onFocus={preview}
    >
      <div className="cal-top">
        <b>{hall ? t('Event date') : t('Select dates')}</b>
        <button type="button" className="icon-btn" aria-label={t('Close')} onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="cal-months">
        {months.map((d, i) => {
          const y = d.getFullYear();
          const m = d.getMonth();
          const offset = (new Date(y, m, 1).getDay() + 6) % 7;
          const days = new Date(y, m + 1, 0).getDate();
          return (
            <div className="cal-m" data-i={i} key={`${y}-${m}`}>
              <div className="cal-mh">
                {!mobile && i === 0 ? (
                  <button
                    type="button"
                    className="cal-nav prev"
                    aria-label={t('Previous month')}
                    disabled={monthsFromBase(view) <= 0}
                    onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                  >
                    <Icon name="chev" />
                  </button>
                ) : null}
                <span>
                  {monthName(m)} {y}
                </span>
                {!mobile && i === count - 1 ? (
                  <button
                    type="button"
                    className="cal-nav next"
                    aria-label={t('Next month')}
                    disabled={monthsFromBase(view) >= MAX_MONTHS_AHEAD}
                    onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                  >
                    <Icon name="chev" />
                  </button>
                ) : null}
              </div>
              <div className="cal-wd">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{t(w)}</span>
                ))}
              </div>
              <div className="cal-g">
                {Array.from({ length: offset }, (_, k) => (
                  <span key={`o${k}`} />
                ))}
                {Array.from({ length: days }, (_, k) => {
                  const dt = iso(new Date(y, m, k + 1));
                  const isS = dt === start;
                  const isE = dt === effEnd;
                  const mid = !!(start && effEnd && dt > start && dt < effEnd);
                  const cls = [
                    'cd',
                    mid && 'in',
                    isS && 's',
                    isE && 'e',
                    isS && !effEnd && 'solo',
                    dt === todayIso && 'today',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      key={dt}
                      type="button"
                      className={cls}
                      data-d={dt}
                      disabled={dt < todayIso}
                      aria-label={fmtWeekday(dt)}
                      aria-pressed={isS || dt === end}
                      onClick={() => pick(dt)}
                    >
                      {k + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="cal-foot">
        <span className="cal-sum" aria-live="polite">
          {summary}
        </span>
        <div className="cal-actions">
          <Button variant="ghost" size="sm" disabled={!start} onClick={clear}>
            {t('Clear')}
          </Button>
          <Button size="sm" disabled={!complete} onClick={done}>
            {t('Done')}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={className} ref={boxRef}>
      {children({ 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: toggle })}
      {mobile && mounted
        ? createPortal(
            <>
              <div
                className={['cal-bk', shown && 'show'].filter(Boolean).join(' ')}
                onClick={close}
                aria-hidden="true"
              />
              {popover}
            </>,
            document.body,
          )
        : popover}
    </div>
  );
}

/** The search form's date field. */
export function DateRangePicker(props: Props) {
  const labelId = useId();
  const { hall, checkIn, checkOut } = props;
  return (
    <DateRangePopover {...props} className="field dr">
      {(trigger) => (
        <>
          <span className="lbl" id={labelId}>
            {hall
              ? t('Event date')
              : `${t('Check-in – Check-out')} · ${plural(nightsBetween(checkIn, checkOut), 'night')}`}
          </span>
          <button type="button" className="inp pick dr-btn" aria-labelledby={labelId} {...trigger}>
            <span className="fic">
              <Icon name="cal" />
            </span>
            <span className="dr-txt">
              {hall ? (
                fmtWeekday(checkIn)
              ) : (
                <>
                  <span>{fmtWeekday(checkIn)}</span>
                  <i className="dr-arrow">→</i>
                  <span>{fmtWeekday(checkOut)}</span>
                </>
              )}
            </span>
          </button>
        </>
      )}
    </DateRangePopover>
  );
}
