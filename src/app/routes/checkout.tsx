import { useQuery, useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { ButtonLink } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { CheckoutForm } from '@/features/checkout/CheckoutForm';
import { OrderSummary, type SummaryStay } from '@/features/checkout/OrderSummary';
import { isApiError } from '@/lib/api/client';
import { propertyQuery } from '@/lib/api/queries';
import { accountApi, checkoutApi, queryKeys } from '@/lib/api/endpoints';
import { basketTrip, isExpired, isSameStay, stayKey } from '@/lib/basket';
import { useBasket } from '@/lib/basket/useBasket';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/lib/session';
import { propertyHref } from '@/lib/tripState';
import type { BasketStay } from '@/types';
import '@/features/checkout/checkout.css';
import { useSeo } from '@/lib/seo';
import { t } from '@/lib/i18n';

/**
 * Checkout pays for the basket: every stay in it, at any number of properties, in one payment (docs/02 §4.15). The stays
 * are taken once when the page opens and then kept, so paying (which empties the basket) never changes what the page
 * shows; edits made here (Remove) update both. Checkout always asks the server for a fresh quote (docs/04 B.5); the
 * summary and the Pay label only ever show it.
 */
export function Component() {
  useSeo({ noindex: true });
  const { stays: inBasket, loading: basketLoading, set } = useBasket();
  const { member, loading: sessionLoading } = useSession();
  const [taken, setTaken] = useState<BasketStay[] | null>(null);
  if (!taken && !basketLoading) setTaken(inBasket.filter((s) => !isExpired(s)));
  const stays = taken ?? [];

  const properties = useQueries({ queries: stays.map((s) => propertyQuery(s.propertyId)) });
  const ready = stays.length > 0 && properties.every((q) => q.data);
  const gone = properties.findIndex((q) => q.isError && isApiError(q.error) && q.error.status === 404);

  const quoteKey = queryKeys.quote(
    stays.map((s) => `${stayKey(s)}|${s.guests}|${s.lines.map((l) => `${l.roomTypeId}:${l.qty}`).join(',')}`).join(';'),
  );
  const quote = useQuery({
    queryKey: quoteKey,
    queryFn: ({ signal }) =>
      checkoutApi.quote(
        stays.map((s) => ({
          propertyId: s.propertyId,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          guests: s.guests,
          selection: s.lines,
        })),
        signal,
      ),
    enabled: ready && gone < 0,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 14 * 60_000, // refresh silently before the 15-minute quote expires
    refetchIntervalInBackground: false,
  });
  const methods = useQuery({
    queryKey: queryKeys.methods,
    queryFn: ({ signal }) => accountApi.methods(signal),
    enabled: !!member,
  });

  const remove = (s: BasketStay) => {
    set(s, []);
    setTaken((t) => (t ? t.filter((x) => !isSameStay(x, s)) : t));
  };

  const empty = (
    <div className="wrap" style={{ marginTop: 20 }}>
      <title>{t('Checkout · Avora Bookings')}</title>
      <div className="card empty">
        <h2>{t('Your basket is empty')}</h2>
        <p className="muted">{t('Choose a room to continue.')}</p>
        <ButtonLink to="/">{t('Find a stay')}</ButtonLink>
      </div>
    </div>
  );

  if (taken && !stays.length) return empty;
  if (gone >= 0) {
    const s = stays[gone]!;
    return (
      <div className="wrap" style={{ marginTop: 20 }}>
        <title>{t('Checkout · Avora Bookings')}</title>
        <div className="card empty">
          <h2>{t('A property in your basket is no longer on AVORA')}</h2>
          <p className="muted">{t('Remove it to check out the rest.')}</p>
          <button type="button" className="btn" onClick={() => remove(s)}>
            {t('Remove it')}
          </button>
        </div>
      </div>
    );
  }
  const propertyError = properties.find((q) => q.isError);
  if (propertyError) {
    return (
      <div className="wrap" style={{ marginTop: 20 }}>
        <QueryError error={propertyError.error} onRetry={() => properties.forEach((q) => void q.refetch())} />
      </div>
    );
  }
  if (!taken || !ready || sessionLoading || (member && methods.isPending)) {
    return (
      <div className="wrap" aria-busy="true">
        <Skeleton height={60} radius={14} style={{ marginTop: 20 }} />
        <Skeleton height={320} radius={14} style={{ marginTop: 14 }} />
      </div>
    );
  }

  const summary: SummaryStay[] = stays.map((stay, i) => ({ stay, property: properties[i]!.data! }));
  const qerr = quote.isError ? quote.error : null;
  const unavailable = isApiError(qerr) && qerr.code === 'ROOM_UNAVAILABLE';
  const unavailableAt = unavailable ? ((qerr.body as { stays?: number[] } | undefined)?.stays ?? []) : [];
  const stale = isApiError(qerr) && ['VALIDATION_FAILED', 'DATE_IN_PAST', 'PROPERTY_NOT_FOUND'].includes(qerr.code);

  return (
    <div className="wrap">
      <title>
        {stays.length > 1
          ? t('Checkout · Avora Bookings')
          : `${t('Checkout')} · ${summary[0]!.property.name} · Avora Bookings`}
      </title>
      <ol className="steps" aria-label={t('Booking steps')}>
        <li className="done">
          <span className="dot">
            <Icon name="check" size={16} />
          </span>
          <span className="sr">{t('Done:')} </span>
          {t('Choose room')}
        </li>
        <li className="now" aria-current="step">
          <span className="dot">2</span>
          Details &amp; payment
        </li>
        <li>
          <span className="dot">3</span>
          {t('Confirmation')}
        </li>
      </ol>
      <div className="co">
        <aside className="side">
          <OrderSummary stays={summary} quote={quote.data} onRemove={remove} />
          {unavailable ? (
            <div className="notice warn" role="alert">
              <p>
                <b>
                  {unavailableAt.length > 1
                    ? t('Rooms in some of your stays are no longer available.')
                    : t('Some rooms are no longer available.')}
                </b>{' '}
                {t('Change or remove {stays} to continue. Nothing has been charged.', {
                  stays: unavailableAt.length
                    ? unavailableAt.map((i) => summary[i]?.property.name).join(` ${t('and')} `)
                    : t('the stay'),
                })}
              </p>
            </div>
          ) : stale ? (
            <div className="notice warn" role="alert">
              <p>
                <b>{t('One of your stays needs a look.')}</b>{' '}
                {t('Its dates or rooms can’t be booked as they are. Edit or remove it to continue.')}
              </p>
            </div>
          ) : qerr ? (
            <QueryError error={qerr} onRetry={() => void quote.refetch()} title={t('We couldn’t get your price.')} />
          ) : null}
        </aside>
        <CheckoutForm
          key={member?.id ?? 'guest'}
          quote={quote.data}
          quoteLoading={quote.isFetching}
          member={member}
          saved={methods.data?.items ?? []}
          defaultMethodId={methods.data?.defaultId}
          basketHref={
            propertyHref(summary[0]!.property.id, basketTrip(summary[0]!.stay, summary[0]!.property.city)) + '#rooms'
          }
          onQuote={(q) => queryClient.setQueryData(quoteKey, q)}
          onRefreshQuote={() => void quote.refetch()}
        />
      </div>
    </div>
  );
}
