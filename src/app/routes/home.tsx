import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { PropertyCard } from '@/components/PropertyCard';
import { QueryError } from '@/components/QueryError';
import { CardSkeleton, Skeleton } from '@/components/Skeleton';
import { NextTripCard } from '@/features/booking/NextTripCard';
import { SearchForm } from '@/features/search/SearchForm';
import { useGoSearch } from '@/features/search/useGoSearch';
import { accountApi, catalogApi, queryKeys } from '@/lib/api/endpoints';
import { config } from '@/lib/config';
import { plural } from '@/lib/money';
import { queryClient, warm } from '@/lib/queryClient';
import { useSession } from '@/lib/session';
import { withType } from '@/lib/trip';
import { searchHref, useTrip } from '@/lib/tripState';
import './home.css';
import { t } from '@/lib/i18n';

/** Filter and trip edits on the same page update the URL only; the page's queries refetch on their own. */
export const shouldRevalidate = ({ currentUrl, nextUrl }: { currentUrl: URL; nextUrl: URL }) =>
  currentUrl.pathname !== nextUrl.pathname;

export const loader = () =>
  warm(
    Promise.all([
      queryClient.ensureQueryData({ queryKey: queryKeys.home('hotel'), queryFn: () => catalogApi.home('hotel') }),
      queryClient.ensureQueryData({ queryKey: queryKeys.cities('hotel'), queryFn: () => catalogApi.cities('hotel') }),
    ]),
  );

export function Component() {
  const urlTrip = useTrip();
  const [type, setType] = useState(urlTrip.type);
  const trip = withType(urlTrip, type);
  const hall = type === 'hall';
  const { member } = useSession();
  const goSearch = useGoSearch();

  const home = useQuery({
    queryKey: queryKeys.home(type),
    queryFn: ({ signal }) => catalogApi.home(type, signal),
    staleTime: 5 * 60_000,
  });
  const cities = useQuery({
    queryKey: queryKeys.cities(type),
    queryFn: ({ signal }) => catalogApi.cities(type, signal),
    staleTime: 5 * 60_000,
  });
  const bookings = useQuery({
    queryKey: queryKeys.myBookings,
    queryFn: ({ signal }) => accountApi.bookings(signal),
    enabled: !!member,
  });
  const next = bookings.data?.upcoming ?? [];
  const noun = hall ? 'halls' : 'stays';

  return (
    <>
      <title>
        {config.features.halls
          ? t('Avora Bookings – Book stays and wedding halls in Somalia')
          : t('Avora Bookings – The best booking platform in Somalia')}
      </title>
      <section className="hero">
        <div className="wrap">
          <h1>{hall ? t('Find the perfect wedding hall in Somalia') : t('The best booking platform in Somalia')}</h1>
          <p>
            {hall
              ? t(
                  'Find and book wedding halls in Somalia. Explore venues, compare your options, and reserve with confidence.',
                )
              : t(
                  'Discover stays across Somalia, book with confidence and pay with EVC Plus, ZAAD, SAHAL, eDahab or card.',
                )}
          </p>
        </div>
      </section>
      <div className="wrap">
        <div className="sbox">
          {config.features.halls ? (
            <div className="seg" role="tablist" aria-label={t('What are you booking?')}>
              {(['hotel', 'hall'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  className={type === k ? 'on' : undefined}
                  aria-selected={type === k}
                  onClick={() => setType(k)}
                >
                  {k === 'hotel' ? t('Hotels') : t('Wedding halls')}
                </button>
              ))}
            </div>
          ) : null}
          <SearchForm key={type} trip={trip} onSubmit={goSearch} />
        </div>
      </div>

      {next[0] ? (
        <section className="sec">
          <div className="wrap">
            <div className="between row sec-head">
              <h2>{t('Your next trip')}</h2>
            </div>
            <NextTripCard booking={next[0]} />
          </div>
        </section>
      ) : null}

      <section className="sec">
        <div className="wrap">
          <h2 className="sec-title">{t('Popular cities')}</h2>
          <div className="cities" aria-busy={cities.isPending}>
            {cities.data
              ? cities.data.items.map((c) => (
                  <AppLink key={c.name} className="citybtn" to={searchHref({ ...trip, city: c.name })}>
                    {c.name} <small>{plural(c.count, hall ? 'hall' : 'stay')}</small>
                  </AppLink>
                ))
              : cities.isPending
                ? [0, 1, 2].map((i) => <Skeleton key={i} width={150} height={46} radius={12} />)
                : null}
          </div>
        </div>
      </section>

      {home.isError ? (
        <section className="sec">
          <div className="wrap">
            <QueryError
              error={home.error}
              onRetry={() => void home.refetch()}
              title={t('We couldn’t load featured {noun}.', { noun: t(noun) })}
            />
          </div>
        </section>
      ) : (
        (['featured', 'newest'] as const).map((k) => (
          <section className="sec" key={k}>
            <div className="wrap">
              <h2 className="sec-title">
                {k === 'featured' ? t('Featured {noun}', { noun: t(noun) }) : t('Newest listings')}
              </h2>
              <div className="cards3" aria-busy={home.isPending}>
                {home.data
                  ? home.data[k].map((p, i) => (
                      <PropertyCard key={p.id} property={p} trip={trip} priority={k === 'featured' && i === 0} />
                    ))
                  : [0, 1, 2].map((i) => <CardSkeleton key={i} />)}
              </div>
            </div>
          </section>
        ))
      )}

      <section className="sec">
        <div className="wrap trust">
          <div className="card">
            <b>{t('Free cancellation')}</b>
            <span className="muted small">
              {t('Most stays can be cancelled free of charge until the day before check-in.')}
            </span>
          </div>
          <div className="card">
            <b>{t('Pay the way you already do')}</b>
            <span className="muted small">{t('EVC Plus, ZAAD, SAHAL, eDahab, Premier Wallet or card.')}</span>
          </div>
          <div className="card">
            <b>{t('Local support on WhatsApp')}</b>
            <span className="muted small">{t('Real people in Somali, Arabic and English.')}</span>
          </div>
        </div>
      </section>
    </>
  );
}
