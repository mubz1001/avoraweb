import { contactUrl, directionsUrl, bookingHref } from './links';
import { AppLink } from '@/components/AppLink';
import { WhatsAppIcon } from '@/components/BrandIcons';
import { ButtonLink, ExternalButton } from '@/components/Button';
import { Chip } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { PropertyImage } from '@/components/PropertyImage';
import { daysFromToday, fmtDay, fmtRange, iso, today } from '@/lib/dates';
import { plural } from '@/lib/money';
import type { Booking } from '@/types';
import './booking.css';
import { t } from '@/lib/i18n';

/** "Your next trip" on Home (docs/05 NextTripCard): where you are in the stay, the facts, and the three things you do
 *  next. */
export function NextTripCard({ booking: b }: { booking: Booking }) {
  const p = b.property;
  const trip = b.trip;
  const hall = p.type === 'hall';
  const d = daysFromToday(trip.checkIn);
  const status =
    d > 1
      ? t('Check-in in {n} days', { n: d })
      : d === 1
        ? t('Check-in tomorrow')
        : d === 0
          ? t('Check-in today')
          : trip.checkOut === iso(today())
            ? t('Check-out today')
            : t("You're staying here now · check-out {date}", { date: fmtDay(trip.checkOut) });

  return (
    <article className="card nexttrip">
      <PropertyImage type={p.type} hue={p.hue} label={p.propertyType} />
      <div className="nt-body">
        <Chip>{status}</Chip>
        <h3>
          <AppLink to={bookingHref(b.ref)}>{p.name}</AppLink>
        </h3>
        <div className="muted small">
          {p.area}, {p.city}
        </div>
        <div className="nt-facts">
          <span className="ico">
            <Icon name="cal" />
            {hall ? fmtDay(trip.checkIn) : fmtRange(trip.checkIn, trip.checkOut)}
          </span>
          <span className="ico">
            <Icon name="user" />
            {plural(trip.guests, 'guest')}
            {hall ? '' : ' · ' + plural(trip.rooms, 'room')}
          </span>
          <span className="ico">
            <Icon name="bed" />
            {hall ? t('Starts from') : t('Check-in from')} {p.checkInFrom}
          </span>
        </div>
        <div className="nt-actions">
          <ButtonLink size="sm" className="pri" to={bookingHref(b.ref)}>
            {t('View booking')}
          </ButtonLink>
          <ExternalButton variant="ghost" size="sm" href={directionsUrl(p)}>
            <Icon name="pin" />
            {t('Directions')}
          </ExternalButton>
          <ExternalButton variant="wa" size="sm" href={contactUrl(p, b.ref)}>
            <WhatsAppIcon />
            Contact {hall ? 'venue' : 'hotel'}
          </ExternalButton>
        </div>
      </div>
    </article>
  );
}
