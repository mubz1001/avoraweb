import { AppLink } from '@/components/AppLink';
import { Button, ButtonLink } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/lib/money';
import { StayFacts } from './StayFacts';
import type { Booking } from '@/types';
import './booking.css';
import { t } from '@/lib/i18n';

type Unconfirmed = Exclude<Booking['status'], 'confirmed'>;

/** What each state that is not "confirmed" tells the guest, and what they can do next. */
const COPY: Record<Unconfirmed, { title: string; body: (b: Booking) => string }> = {
  pending_payment: {
    title: 'Waiting for your payment',
    body: () =>
      t(
        'We haven’t received the payment for this booking yet. If you approved it on your phone, it can take a minute to arrive.',
      ),
  },
  payment_failed: {
    title: 'Your payment didn’t go through',
    body: () => t('Nothing was charged and this stay isn’t booked. Your rooms are still in your basket.'),
  },
  failed: {
    title: 'This booking couldn’t be confirmed',
    body: (b) =>
      `${b.property.name} couldn’t confirm this stay. ${formatMoney(b.quote.total)} goes back to your payment method.`,
  },
  cancelled: {
    title: 'This booking was cancelled',
    body: () => t('It no longer holds any rooms.'),
  },
};

/**
 * A booking page for a booking that is not confirmed (docs/05 BookingStatus). The confirmation page only ever says
 * "Booking confirmed" for a confirmed booking; every other state is named here, with its next step.
 */
export function BookingStatus({ booking: b, onRefresh }: { booking: Booking; onRefresh?: () => void }) {
  const copy = COPY[b.status as Unconfirmed];
  const waiting = b.status === 'pending_payment';
  const retry = b.status === 'payment_failed' || waiting;
  return (
    <div className="wrap">
      <title>{`${t(copy.title)} · Avora Bookings`}</title>
      <div className="confirm">
        <div className="card confirm-top">
          <div className="confirm-head">
            <div className="tick neutral">
              <Icon name="help" />
            </div>
            <h1>{t(copy.title)}</h1>
            <p className="muted" style={{ margin: '6px 0' }}>
              {copy.body(b)}
            </p>
          </div>
          <div className="actions">
            {waiting && onRefresh ? <Button onClick={onRefresh}>{t('Check again')}</Button> : null}
            {b.status === 'payment_failed' ? <ButtonLink to="/checkout">{t('Back to checkout')}</ButtonLink> : null}
          </div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginBottom: 4 }}>{b.property.name}</h2>
          <StayFacts booking={b} />
          <div className="kv">
            <span className="muted">{t('Reference')}</span>
            <span className="ref sm">{b.ref}</span>
          </div>
        </div>
        <div className="confirm-end">
          <ButtonLink variant="ghost" to={retry ? '/' : '/account/bookings'}>
            {retry ? t('Find another stay') : t('View my bookings')}
          </ButtonLink>
        </div>
        {b.status === 'failed' ? (
          <p className="small muted" style={{ textAlign: 'center' }}>
            {t('Questions about the refund?')} <AppLink to="/support">{t('Contact support')}</AppLink>{' '}
            {t('with your reference.')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
