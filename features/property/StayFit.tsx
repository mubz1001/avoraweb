import { Icon, type IconName } from '@/components/Icon';
import type { PopoverTrigger } from '@/features/search/GuestsRoomsPicker';
import { plural } from '@/lib/money';
import type { StayFit as Fit } from '@/lib/pricing';
import './stay-fit.css';
import { t } from '@/lib/i18n';

/**
 * The property sticky bar's trip pills (docs/05 StayFit): the dates, and how the picked rooms measure up against the
 * search (beds against guests, rooms against rooms asked for, each over a thin fill bar). Guests decide whether the
 * stay works, so only that segment changes colour (orange short, green when everyone has a bed); fewer
 * rooms than asked is fine when the beds are there. Before any room is picked it shows the search itself. The dates
 * pill opens the calendar and the guests/rooms pill opens guests & rooms, so the trip is changed right here.
 */
export function StayFit({
  fit,
  dates,
  datesSpoken,
  dateTrigger,
  partyTrigger,
}: {
  fit: Fit;
  /** Short range for the pill ("Oct 27–29"). */
  dates: string;
  /** The range for screen readers ("Oct 27–29, 2 nights"). */
  datesSpoken: string;
  dateTrigger: PopoverTrigger;
  partyTrigger: PopoverTrigger;
}) {
  const { guests, rooms, short } = fit;
  const picked = rooms.have > 0;
  const housed = Math.min(guests.have, guests.want);

  return (
    <span className="fitrow">
      <button type="button" className="fitpill" {...dateTrigger}>
        <span className="fitseg" aria-hidden="true">
          <Icon name="cal" size={14} />
          {dates}
        </span>
        <span className="sr">
          {datesSpoken}. {t('Change dates')}.
        </span>
      </button>
      <button type="button" className="fitpill" {...partyTrigger}>
        <span className="fitpill-in" aria-hidden="true">
          <Seg
            icon="user"
            tone={picked ? (short ? 'warn' : 'met') : undefined}
            text={picked ? `${housed}/${guests.want}` : String(guests.want)}
            fill={picked ? housed / guests.want : null}
          />
          <i className="fitpill-sep" />
          <Seg
            icon="bed"
            text={picked ? `${rooms.have}/${rooms.want}` : String(rooms.want)}
            fill={picked ? Math.min(1, rooms.have / rooms.want) : null}
          />
        </span>
        <span className="sr">
          {fitSpoken(fit)} {t('Change guests and rooms.')}
        </span>
      </button>
    </span>
  );
}

function Seg({
  icon,
  tone,
  text,
  fill,
}: {
  icon: IconName;
  tone?: 'warn' | 'met';
  text: string;
  /** 0–1, or null for no bar (nothing picked yet). */
  fill: number | null;
}) {
  return (
    <span className={['fitseg', tone].filter(Boolean).join(' ')}>
      <Icon name={icon} size={14} />
      {text}
      {fill === null ? null : (
        <i className="fitseg-bar">
          <i style={{ transform: `scaleX(${fill})` }} />
        </i>
      )}
    </span>
  );
}

/** The fit as a sentence, for screen readers (the sticky bar also announces it as the picks change). */
export function fitSpoken({ guests, rooms, short }: Fit): string {
  if (!rooms.have) return `${plural(guests.want, 'guest')}, ${plural(rooms.want, 'room')}.`;
  const housed = Math.min(guests.have, guests.want);
  const beds = short
    ? t('Beds for {housed} of your {want} guests.', { housed, want: guests.want })
    : t('Beds for all {want} guests.', { want: guests.want });
  return `${beds} ${t(rooms.want === 1 ? '{have} of the {want} room you searched for.' : '{have} of the {want} rooms you searched for.', { have: rooms.have, want: rooms.want })}`;
}
