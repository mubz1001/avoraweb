import { downloadIcs } from './ics';
import { AppLink } from '@/components/AppLink';
import { Button, ButtonLink } from '@/components/Button';
import { Chip } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { JoinPrompt } from '@/components/JoinPrompt';
import { PropertyImage } from '@/components/PropertyImage';
import { useToast } from '@/components/Toast';
import { hasEnded, STATUS } from '@/features/account/bookingInfo';
import { fmtDay, fmtRange } from '@/lib/dates';
import { formatMoney, plural } from '@/lib/money';
import { phoneDigits } from '@/lib/phone';
import { savePrefill } from '@/lib/receipt';
import type { Booking, Order } from '@/types';
import { paymentRows } from './paymentRows';
import './booking.css';
import { t } from '@/lib/i18n';

const payLabel = (o: Order) => {
  const m = o.payment;
  const name = m.method === 'card' ? `${m.brand ?? t('Card')} •••• ${m.last4 ?? ''}` : (m.brand ?? '');
  return `${name}${m.payPhoneMasked ? ' · ' + m.payPhoneMasked : ''}`;
};

/** What the order came to, in words: confirmed, partly confirmed (the rest refunded), or not confirmed (all refunded). */
function Head({ order: o }: { order: Order }) {
  const n = o.bookings.length;
  const bad = o.status === 'failed';
  const some = o.status === 'partially_confirmed';
  return (
    <div className="confirm-head">
      <div className={['tick', (bad || some) && 'neutral'].filter(Boolean).join(' ')}>
        <Icon name={bad || some ? 'help' : 'check'} />
      </div>
      <h1>
        {bad
          ? t('Your bookings couldn’t be confirmed')
          : some
            ? t('Some of your bookings couldn’t be confirmed')
            : n > 1
              ? t('Bookings confirmed')
              : t('Booking confirmed')}
      </h1>
      {bad || some ? (
        <p className="muted" style={{ margin: '6px 0' }}>
          {t('You were charged {total} and {refund} is on its way back to {method}.', {
            total: formatMoney(o.total),
            refund: formatMoney(o.refunded ?? o.total),
            method: payLabel(o),
          })}
        </p>
      ) : null}
    </div>
  );
}

function BookingCard({ booking: b, member }: { booking: Booking; member: boolean }) {
  const toast = useToast();
  const p = b.property;
  const hall = p.type === 'hall';
  const failed = b.status === 'failed';
  const rooms = b.quote.lines.map((l) => `${l.qty} × ${l.name}`).join(' · ');
  const status = STATUS[b.status];
  return (
    <div className="card ordbk">
      <PropertyImage type={p.type} hue={p.hue} label={p.propertyType} image={p.image} className="confirm-ph" />
      <div className="ordbk-top">
        <h2>{p.name}</h2>
        {failed ? <Chip tone={status.tone}>{status.label}</Chip> : null}
      </div>
      <div className="muted small">
        {p.area}, {p.city}
      </div>
      <div className="kv">
        <span className="muted">{hall ? t('Date') : t('Dates')}</span>
        <b>{hall ? fmtDay(b.trip.checkIn) : fmtRange(b.trip.checkIn, b.trip.checkOut)}</b>
      </div>
      <div className="kv">
        <span className="muted">{t('Guests')}</span>
        <b>{b.trip.guests}</b>
      </div>
      {rooms ? (
        <div className="kv">
          <span className="muted">{t('Rooms')}</span>
          <b>{rooms}</b>
        </div>
      ) : null}
      <div className="kv">
        <span className="muted">{failed ? t('Refunded') : t('Total')}</span>
        <b>{formatMoney(b.quote.total)}</b>
      </div>
      {failed ? (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {t('{name} couldn’t confirm this stay. Its total goes back to your payment method; nothing else changed.', {
            name: p.name,
          })}
        </p>
      ) : (
        <>
          <div className="kv">
            <span className="muted">{t('Reference')}</span>
            <span className="ref sm">{b.ref}</span>
          </div>
          <div className={['small', b.quote.freeCancellationUntil ? 'ok' : 'muted'].join(' ')}>
            {b.quote.freeCancellationUntil
              ? t('Free cancellation until {date}', { date: fmtDay(b.quote.freeCancellationUntil) })
              : t('Non-refundable booking')}
          </div>
          {member ? (
            <div className="row ordbk-acts">
              <ButtonLink size="sm" variant="ghost" to={`/bookings/${encodeURIComponent(b.ref)}`}>
                {t('View booking')}
              </ButtonLink>
              {hasEnded(b) ? null : (
                <button
                  type="button"
                  className="linkbtn small"
                  onClick={() => {
                    downloadIcs(b);
                    toast('Calendar file downloaded');
                  }}
                >
                  <Icon name="cal" /> {t('Add to calendar')}
                </button>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** An order whose payment has not settled: still waiting for the wallet, or it failed. Nothing here is a confirmation:
 *  no "confirmed", no emailed-to line, no per-booking actions. A failed payment points back to the basket. */
function UnsettledOrder({ order: o, onRefresh }: { order: Order; onRefresh?: () => void }) {
  const waiting = o.status === 'pending_payment';
  const title = waiting ? t('Waiting for your payment') : t('Your payment didn’t go through');
  return (
    <div className="wrap">
      <title>{`${title} · Avora Bookings`}</title>
      <div className="confirm">
        <div className="confirm-head">
          <div className="tick neutral">
            <Icon name="help" />
          </div>
          <h1>{title}</h1>
          <p className="muted" style={{ margin: '6px 0' }}>
            {waiting
              ? t(
                  'We haven’t received your payment yet. If you approved it on your phone, it can take a minute to arrive.',
                )
              : t('Nothing was charged and nothing is booked. Your rooms are still in your basket.')}
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            {waiting && onRefresh ? <Button onClick={onRefresh}>{t('Check again')}</Button> : null}
            {waiting ? null : <ButtonLink to="/checkout">{t('Back to checkout')}</ButtonLink>}
          </div>
        </div>
        <div className="ordlist">
          {o.bookings.map((b) => (
            <div className="card ordbk" key={b.ref}>
              <h2>{b.property.name}</h2>
              <div className="muted small">
                {b.property.area}, {b.property.city}
              </div>
              <div className="kv">
                <span className="muted">{b.property.type === 'hall' ? t('Date') : t('Dates')}</span>
                <b>{b.property.type === 'hall' ? fmtDay(b.trip.checkIn) : fmtRange(b.trip.checkIn, b.trip.checkOut)}</b>
              </div>
              <div className="kv">
                <span className="muted">{t('Total')}</span>
                <b>{formatMoney(b.quote.total)}</b>
              </div>
            </div>
          ))}
        </div>
        <div className="confirm-end">
          <ButtonLink variant="ghost" to="/">
            {t('Find another stay')}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

/**
 * The confirmation for an order of several bookings, or one that did not fully confirm (docs/05 OrderConfirmation).
 * One card per booking, each with its own reference and, if its property couldn't confirm it, a refund note. Nothing is
 * shown as confirmed unless that booking is. Guests see the same without the member actions, plus the join prompt.
 */
export function OrderConfirmation({
  order: o,
  member,
  onRefresh,
}: {
  order: Order;
  member: boolean;
  onRefresh?: () => void;
}) {
  if (o.status === 'pending_payment' || o.status === 'payment_failed')
    return <UnsettledOrder order={o} onRefresh={onRefresh} />;
  const email = o.bookings[0]?.guest.email;
  const kept = o.bookings.filter((b) => b.status !== 'failed');
  const pay = paymentRows(o.payment);
  const paid = o.refunded ? o.total.amount - o.refunded.amount : o.total.amount;
  return (
    <div className="wrap">
      <title>{`${t('Booking confirmation')} · Avora Bookings`}</title>
      <div className="confirm">
        <Head order={o} />
        {email && kept.length ? (
          <p className="muted small" style={{ textAlign: 'center' }}>
            {member
              ? t('Confirmation emailed to {email}.', { email })
              : `${t("We've emailed your booking details to")} `}
            {member ? null : <b>{email}</b>}
            {member ? null : '.'}
          </p>
        ) : null}
        <div className="ordlist">
          {o.bookings.map((b) => (
            <BookingCard key={b.ref} booking={b} member={member} />
          ))}
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="kv">
            <span className="muted">{plural(kept.length, 'confirmed booking')}</span>
            <b>{formatMoney({ amount: paid, currency: o.total.currency })}</b>
          </div>
          {o.refunded ? (
            <div className="kv">
              <span className="muted">{t('Refunded')}</span>
              <b>{formatMoney(o.refunded)}</b>
            </div>
          ) : null}
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
        </div>
        {member ? null : (
          <div style={{ marginTop: 12 }}>
            <JoinPrompt
              title={t('Create an account to manage your bookings')}
              sub={t(
                'Guests get an email and nothing else. With an account you can see every booking in one place, add stays to your calendar, get directions, contact the hotel, save payment methods and leave reviews.',
              )}
              next="/account/bookings"
              onCreate={() => {
                const g = o.bookings[0]?.guest;
                if (!g) return;
                const [first = '', ...rest] = g.name.split(/\s+/);
                savePrefill({
                  firstName: first,
                  lastName: rest.join(' '),
                  phone: phoneDigits(g.phone),
                  email: g.email ?? '',
                });
              }}
            />
          </div>
        )}
        <div className="confirm-end">
          <ButtonLink variant="ghost" to="/">
            {t('Book more rooms')}
          </ButtonLink>
          {member ? (
            <ButtonLink variant="ghost" to="/account/bookings">
              {t('View my bookings')}
            </ButtonLink>
          ) : null}
        </div>
        {o.status === 'confirmed' ? null : (
          <p className="small muted" style={{ textAlign: 'center' }}>
            {t('Questions about a refund?')} <AppLink to="/support">{t('Contact support')}</AppLink> with your{' '}
            {kept.length ? 'reference' : 'payment details'}.
          </p>
        )}
      </div>
    </div>
  );
}
