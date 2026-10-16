import { hasEnded } from '@/features/account/bookingInfo';
import { contactUrl, directionsUrl, supportUrl } from './links';
import { downloadIcs } from './ics';
import { WhatsAppIcon } from '@/components/BrandIcons';
import { Button, ButtonLink, ExternalButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { JoinPrompt } from '@/components/JoinPrompt';
import { paymentRows } from './paymentRows';
import { PropertyImage } from '@/components/PropertyImage';
import { useToast } from '@/components/Toast';
import { fmtDay, fmtRange } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { phoneDigits } from '@/lib/phone';
import { savePrefill } from '@/lib/receipt';
import type { Booking } from '@/types';
import './booking.css';
import { t } from '@/lib/i18n';

/** A stay that is over reads "Booking complete"; one still ahead reads "Booking confirmed". */
const headline = (b: Booking) => (hasEnded(b) ? t('Booking complete') : t('Booking confirmed'));

function Head({ booking: b }: { booking: Booking }) {
  return (
    <div className="confirm-head">
      <div className="tick">
        <Icon name="check" />
      </div>
      <h1>{headline(b)}</h1>
      <p className="muted" style={{ margin: '6px 0' }}>
        {t('Your reference')}
      </p>
      <div className="ref">{b.ref}</div>
    </div>
  );
}

/** What was booked and paid, in full: photo, address, dates, times, party, rooms, fee, payment and the guest's name. The
 *  same for a member and a guest (the guest's copy is also emailed). */
function StayDetails({ booking: b }: { booking: Booking }) {
  const p = b.property;
  const hall = p.type === 'hall';
  const q = b.quote;
  const pay = paymentRows(b.payment);
  return (
    <div className="card">
      <PropertyImage type={p.type} hue={p.hue} label={p.propertyType} image={p.image} className="confirm-ph" />
      <h2 style={{ marginBottom: 8 }}>{p.name}</h2>
      <div className="muted" style={{ marginBottom: 10 }}>
        {p.address}
      </div>
      <div className="kv">
        <span className="muted">{hall ? t('Date') : t('Dates')}</span>
        <b>{hall ? fmtDay(b.trip.checkIn) : fmtRange(b.trip.checkIn, b.trip.checkOut)}</b>
      </div>
      <div className="kv">
        <span className="muted">{hall ? t('Starts from') : t('Check-in / out')}</span>
        <b>{hall ? p.checkInFrom : `${p.checkInFrom} / ${p.checkOutUntil}`}</b>
      </div>
      <div className="kv">
        <span className="muted">{t('Guests')}</span>
        <b>{b.trip.guests}</b>
      </div>
      {q.lines.map((l) => (
        <div className="kv" key={l.roomTypeId}>
          <span className="muted">
            {l.qty} × {l.name}
          </span>
          <b>{formatMoney(l.total)}</b>
        </div>
      ))}
      {q.serviceFee.amount > 0 ? (
        <div className="kv">
          <span className="muted">{t('Service fee')} (2%)</span>
          <b>{formatMoney(q.serviceFee)}</b>
        </div>
      ) : null}
      <div className="kv">
        <span className="muted">{t('Total paid')}</span>
        <b>{formatMoney(q.total)}</b>
      </div>
      <div className="kv">
        <span className="muted">{t('Payment method')}</span>
        <b>{pay.method}</b>
      </div>
      {pay.detail ? (
        <div className="kv">
          <span className="muted">{pay.detailLabel}</span>
          <b>{pay.detail}</b>
        </div>
      ) : null}
      <div className="kv">
        <span className="muted">{t('Guest')}</span>
        <b>{b.guest.name}</b>
      </div>
    </div>
  );
}

/** The booking's cancellation terms and where to ask for changes. A finished stay can't be cancelled, so it has none. */
function CancellationCard({ booking: b }: { booking: Booking }) {
  const until = b.quote.freeCancellationUntil;
  if (hasEnded(b)) return null;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <b className={until ? 'ok' : undefined}>
        {until ? t('Free cancellation until {date}', { date: fmtDay(until) }) : t('Non-refundable booking')}
      </b>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Need to change something?{' '}
        <a href={supportUrl(b.ref)} target="_blank" rel="noopener noreferrer">
          {t('Message customer service')}
        </a>{' '}
        on WhatsApp with your reference.
      </p>
    </div>
  );
}

/** A member's own booking (docs/05 ConfirmationView): calendar, directions, hotel contact and the full breakdown. */
export function MemberConfirmation({ booking: b }: { booking: Booking }) {
  const toast = useToast();
  const p = b.property;
  const hall = p.type === 'hall';
  return (
    <div className="wrap">
      <title>{`${headline(b)} ${b.ref} · Avora Bookings`}</title>
      <div className="confirm">
        <div className="card confirm-top">
          <Head booking={b} />
          <p className="muted small" style={{ textAlign: 'center' }}>
            {t('Confirmation emailed to {email}.', { email: b.guest.email ?? '' })}
          </p>
          <div className="actions">
            {hasEnded(b) ? null : (
              <Button
                onClick={() => {
                  downloadIcs(b);
                  toast('Calendar file downloaded');
                }}
              >
                <Icon name="cal" /> {t('Add to calendar')}
              </Button>
            )}
            <ExternalButton variant="ghost" href={directionsUrl(p)}>
              <Icon name="pin" /> {t('Get directions')}
            </ExternalButton>
            <ExternalButton variant="wa" href={contactUrl(p, b.ref)}>
              <WhatsAppIcon /> Contact {hall ? 'venue' : 'hotel'}
            </ExternalButton>
          </div>
        </div>
        <StayDetails booking={b} />
        <CancellationCard booking={b} />
        <div className="confirm-end">
          <ButtonLink variant="ghost" to="/">
            {t('Book more rooms')}
          </ButtonLink>
          <ButtonLink variant="ghost" to="/account/bookings">
            {t('View my bookings')}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

/** Guest confirmation: the reference and the same booking details a member sees, then an invitation to join. The
 *  calendar, directions and hotel-contact actions stay with accounts (docs/02 §4.2). */
export function GuestConfirmation({ booking: b }: { booking: Booking }) {
  return (
    <div className="wrap">
      <title>{`${headline(b)} ${b.ref} · Avora Bookings`}</title>
      <div className="confirm">
        <div className="card confirm-top">
          <Head booking={b} />
          <p className="muted small" style={{ textAlign: 'center', marginBottom: 0 }}>
            {t("We've emailed your booking details to")} <b>{b.guest.email}</b>.
          </p>
        </div>
        <StayDetails booking={b} />
        <CancellationCard booking={b} />
        <div style={{ marginTop: 12 }}>
          <JoinPrompt
            title={t('Create an account to manage your bookings')}
            sub={t(
              'Guests get an email and nothing else. With an account you can see every booking in one place, add stays to your calendar, get directions, contact the hotel, save payment methods and leave reviews.',
            )}
            next="/account/bookings"
            onCreate={() => {
              const [first = '', ...rest] = b.guest.name.split(/\s+/);
              savePrefill({
                firstName: first,
                lastName: rest.join(' '),
                phone: phoneDigits(b.guest.phone),
                email: b.guest.email ?? '',
              });
            }}
          />
        </div>
        <div className="confirm-end">
          <ButtonLink variant="ghost" to="/">
            {t('Book more rooms')}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
