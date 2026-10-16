import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ButtonLink } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { BookingStatus } from '@/features/booking/BookingStatus';
import { GuestConfirmation, MemberConfirmation } from '@/features/booking/Confirmation';
import { isApiError } from '@/lib/api/client';
import { checkoutApi, queryKeys } from '@/lib/api/endpoints';
import { readReceiptBooking } from '@/lib/receipt';
import { useAuthHref, useSession } from '@/lib/session';
import '@/features/booking/booking.css';
import { useSeo } from '@/lib/seo';
import { t } from '@/lib/i18n';

/** Only the account that made a booking can open it (docs/02 §5). A guest sees this tab's receipt and nothing else. */
export function Component() {
  useSeo({ noindex: true });
  const { ref: raw = '' } = useParams();
  const ref = raw.trim().toUpperCase();
  const { member, loading } = useSession();
  const authHref = useAuthHref();
  const receipt = readReceiptBooking(ref);
  const q = useQuery({
    queryKey: queryKeys.booking(ref),
    queryFn: ({ signal }) => checkoutApi.booking(ref, signal),
    enabled: !receipt && !!member,
    retry: false,
  });

  if (receipt)
    return receipt.status === 'confirmed' ? (
      <GuestConfirmation booking={receipt} />
    ) : (
      <BookingStatus booking={receipt} />
    );
  if (loading || (member && q.isPending)) {
    return (
      <div className="wrap confirm" aria-busy="true">
        <Skeleton width={60} height={60} radius={30} style={{ margin: '0 auto' }} />
        <Skeleton height={200} radius={14} style={{ marginTop: 18 }} />
      </div>
    );
  }
  if (member && q.data)
    return q.data.status === 'confirmed' ? (
      <MemberConfirmation booking={q.data} />
    ) : (
      <BookingStatus booking={q.data} onRefresh={() => void q.refetch()} />
    );
  if (member && q.isError && !(isApiError(q.error) && q.error.status === 404)) {
    return (
      <div className="wrap" style={{ marginTop: 20 }}>
        <QueryError error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  return (
    <div className="wrap">
      <title>{`Booking ${ref} · Avora Bookings`}</title>
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
