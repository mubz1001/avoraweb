import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ButtonLink } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { GuestConfirmation, MemberConfirmation } from '@/features/booking/Confirmation';
import { OrderConfirmation } from '@/features/booking/OrderConfirmation';
import { isApiError } from '@/lib/api/client';
import { checkoutApi, queryKeys } from '@/lib/api/endpoints';
import { readReceipt } from '@/lib/receipt';
import { useAuthHref, useSession } from '@/lib/session';
import type { Order } from '@/types';
import '@/features/booking/booking.css';
import { useSeo } from '@/lib/seo';
import { t } from '@/lib/i18n';

/** One booking that confirmed keeps the single-booking confirmation; anything else (several bookings, or one that
 *  didn't fully confirm) gets the order view. */
function View({ order, member, onRefresh }: { order: Order; member: boolean; onRefresh?: () => void }) {
  const only = order.bookings.length === 1 && order.status === 'confirmed' ? order.bookings[0]! : null;
  if (only) return member ? <MemberConfirmation booking={only} /> : <GuestConfirmation booking={only} />;
  return <OrderConfirmation order={order} member={member} onRefresh={onRefresh} />;
}

/** Only the account that paid can open an order (docs/02 §5). A guest sees this tab's receipt and nothing else. */
export function Component() {
  useSeo({ noindex: true });
  const { id = '' } = useParams();
  const { member, loading } = useSession();
  const authHref = useAuthHref();
  const receipt = readReceipt(id);
  const q = useQuery({
    queryKey: queryKeys.order(id),
    queryFn: ({ signal }) => checkoutApi.order(id, signal),
    enabled: !receipt && !!member,
    retry: false,
  });

  if (receipt) return <View order={receipt} member={false} />;
  if (loading || (member && q.isPending)) {
    return (
      <div className="wrap confirm" aria-busy="true">
        <Skeleton width={60} height={60} radius={30} style={{ margin: '0 auto' }} />
        <Skeleton height={200} radius={14} style={{ marginTop: 18 }} />
      </div>
    );
  }
  if (member && q.data) return <View order={q.data} member onRefresh={() => void q.refetch()} />;
  if (member && q.isError && !(isApiError(q.error) && q.error.status === 404)) {
    return (
      <div className="wrap" style={{ marginTop: 20 }}>
        <QueryError error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  return (
    <div className="wrap">
      <title>{t('Booking confirmation · Avora Bookings')}</title>
      <div className="confirm">
        <div className="card empty">
          <div className="tick neutral">
            <Icon name="lock" />
          </div>
          <h2>{member ? t('This booking isn’t in your account') : t('Sign in to view this booking')}</h2>
          <p className="muted">
            {member
              ? t('Bookings can only be opened by the account that made them.')
              : t('Bookings made without an account are only sent by email and aren’t kept on this device.')}
          </p>
          <div className="row">
            {member ? (
              <ButtonLink to="/account/bookings">{t('My bookings')}</ButtonLink>
            ) : (
              <ButtonLink to={authHref('signin')}>{t('Sign in')}</ButtonLink>
            )}
            <ButtonLink variant="ghost" to="/">
              {t('Start a booking')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
