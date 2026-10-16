import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type LoaderFunctionArgs } from 'react-router';
import { Accordion, useAccordion } from '@/components/Accordion';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { FilterGroup, FilterPanel } from '@/components/FilterPanel';
import { PropertyCard } from '@/components/PropertyCard';
import { QueryError } from '@/components/QueryError';
import { CardSkeleton } from '@/components/Skeleton';
import { PriceFilter } from '@/features/search/PriceFilter';
import { SearchForm } from '@/features/search/SearchForm';
import { useGoSearch } from '@/features/search/useGoSearch';
import { catalogApi, queryKeys, type SearchFilters } from '@/lib/api/endpoints';
import { fmtDay, fmtRange } from '@/lib/dates';
import { plural } from '@/lib/money';
import { queryClient, warm } from '@/lib/queryClient';
import { CITIES, HALL_AMENITIES, HOTEL_AMENITIES } from '@/lib/reference';
import { local, storageKeys } from '@/lib/storage';
import { parseTrip, serializeTrip } from '@/lib/trip';
import { searchHref, useTrip } from '@/lib/tripState';
import { useUrlState } from '@/lib/useUrlState';
import type { Trip } from '@/types';
import './search.css';
import { useSeo } from '@/lib/seo';
import { t } from '@/lib/i18n';

const SORTS = [
  ['rec', 'Sort: Recommended'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['rating', 'Guest rating'],
] as const;
const PROPERTY_TYPES = ['Hotel', 'Guesthouse', 'Apartments'];
const priceRange = (hall: boolean) => (hall ? { min: 500, max: 2000, step: 100 } : { min: 40, max: 300, step: 10 });

/** Filters live in the URL (shareable; `replace` so Back leaves the page instead of stepping through filter states). */
function readFilters(p: URLSearchParams, hall: boolean): SearchFilters & { maxDollars: number } {
  const cap = priceRange(hall).max;
  const sort = SORTS.find(([k]) => k === p.get('sort'))?.[0] ?? 'rec';
  const maxDollars = Math.min(Number(p.get('maxp')) || cap, cap);
  return {
    sort,
    maxDollars,
    maxPrice: maxDollars >= cap ? 0 : maxDollars * 100,
    minRating: Number(p.get('rating')) === 4 ? 4 : 0,
    amenities: (p.get('am') ?? '').split(',').filter(Boolean),
    propertyTypes: (p.get('pt') ?? '').split(',').filter(Boolean),
  };
}

const searchQuery = (trip: Trip, f: SearchFilters) => ({
  queryKey: queryKeys.search(trip, f),
  queryFn: ({ signal }: { signal?: AbortSignal }) => catalogApi.search(trip, f, signal),
});

/** Filter and trip edits on the same page update the URL only; the page's queries refetch on their own. */
export const shouldRevalidate = ({ currentUrl, nextUrl }: { currentUrl: URL; nextUrl: URL }) =>
  currentUrl.pathname !== nextUrl.pathname;

export function loader({ request }: LoaderFunctionArgs) {
  const p = new URL(request.url).searchParams;
  const trip = parseTrip(p, local.get<Partial<Trip>>(storageKeys.trip, {}));
  const { maxDollars: _m, ...f } = readFilters(p, trip.type === 'hall');
  void _m;
  return warm(queryClient.ensureQueryData(searchQuery(trip, f)));
}

export function Component() {
  useSeo({ noindex: true });
  const trip = useTrip();
  const hall = trip.type === 'hall';
  const [params, setUrl] = useUrlState();
  const { maxDollars, ...filters } = readFilters(params, hall);
  const range = priceRange(hall);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const edit = useAccordion();
  const goSearch = useGoSearch();

  const q = useQuery({ ...searchQuery(trip, filters), placeholderData: keepPreviousData });
  const r = q.data;

  const setFilter = setUrl;
  const toggleIn = (key: 'am' | 'pt', list: string[], v: string) =>
    setFilter({ [key]: (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(',') });

  const nFilters =
    (filters.propertyTypes.length ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    filters.amenities.length;
  const noun = hall ? 'wedding hall' : 'stay';
  const amenityMap = hall ? HALL_AMENITIES : HOTEL_AMENITIES;
  const amenityKeys = Object.keys(amenityMap);
  // Only what can be booked for the trip is listed; stays that are full for these dates stay out of the way.
  const available = r?.items.filter((i) => i.availability === 'available') ?? [];
  const cityLabel = r
    ? r.resolvedCity === ''
      ? t('all cities')
      : (r.resolvedCity ?? trip.city)
    : trip.city || t('all cities');
  const title = r
    ? t('{count} in {city}', { count: plural(available.length, noun), city: cityLabel })
    : t('Searching {city}…', { city: cityLabel });
  const when = hall ? fmtDay(trip.checkIn) : fmtRange(trip.checkIn, trip.checkOut);

  return (
    <>
      <title>{`${title} · Avora Bookings`}</title>
      <div className="sumbar">
        <div className="wrap">
          <div>
            <h1>
              {title} · {when} · {plural(trip.guests, 'guest')}
              {hall ? '' : ' · ' + plural(trip.rooms, 'room')}
            </h1>
          </div>
          <Button variant="ghost" size="sm" {...edit.triggerProps}>
            {edit.open ? t('Close') : t('Edit')}
          </Button>
          <Accordion {...edit.panelProps}>
            <SearchForm key={serializeTrip(trip)} trip={trip} onSubmit={goSearch} />
          </Accordion>
        </div>
      </div>
      <div className="wrap">
        <div className="toolbar">
          <Button variant="ghost" className="fbtn" onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen}>
            {nFilters ? `${t('Filters')} (${nFilters})` : t('Filters')}
          </Button>
          <label className="sr" htmlFor="sort">
            {t('Sort by')}
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) => setFilter({ sort: e.target.value === 'rec' ? '' : e.target.value })}
          >
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {t(l)}
              </option>
            ))}
          </select>
        </div>
        <div className="layout">
          <FilterPanel
            label={t('Filters')}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onClear={() => setFilter({ sort: '', maxp: '', rating: '', am: '', pt: '' })}
            applyLabel={r ? t('Show {count}', { count: plural(available.length, noun) }) : t('Show results')}
          >
            {hall ? null : (
              <FilterGroup title={t('Property type')}>
                {PROPERTY_TYPES.map((pt) => (
                  <label className="opt" key={pt}>
                    <input
                      type="checkbox"
                      checked={filters.propertyTypes.includes(pt)}
                      onChange={() => toggleIn('pt', filters.propertyTypes, pt)}
                    />{' '}
                    {t(pt)}
                  </label>
                ))}
              </FilterGroup>
            )}
            <PriceFilter
              key={hall ? 'hall' : 'hotel'}
              unit={hall ? 'day' : 'night'}
              range={range}
              value={maxDollars}
              onCommit={(v) => setFilter({ maxp: v >= range.max ? '' : String(v) })}
            />
            <FilterGroup title={t('Guest rating')}>
              {[
                [0, t('Any')],
                [4, t('4.0 and up')],
              ].map(([v, l]) => (
                <label className="opt" key={v}>
                  <input
                    type="radio"
                    name="rating"
                    checked={filters.minRating === v}
                    onChange={() => setFilter({ rating: v ? String(v) : '' })}
                  />{' '}
                  {l}
                </label>
              ))}
            </FilterGroup>
            <FilterGroup title={hall ? t('Services') : t('Amenities')}>
              {(showAllAmenities ? amenityKeys : amenityKeys.slice(0, 6)).map((k) => (
                <label className="opt" key={k}>
                  <input
                    type="checkbox"
                    checked={filters.amenities.includes(k)}
                    onChange={() => toggleIn('am', filters.amenities, k)}
                  />{' '}
                  {t(amenityMap[k]!)}
                </label>
              ))}
              <button className="more" type="button" onClick={() => setShowAllAmenities((s) => !s)}>
                {showAllAmenities ? t('Show fewer') : `${t('Show all')} (${amenityKeys.length})`}
              </button>
            </FilterGroup>
          </FilterPanel>
          <section aria-labelledby="results-h">
            <h2 id="results-h" className="sr">
              {t('Results')}
            </h2>
            <div className="list" aria-live="polite" aria-busy={q.isFetching}>
              {q.isError && !r ? (
                <QueryError error={q.error} onRetry={() => void q.refetch()} title={t('We couldn’t load stays.')} />
              ) : !r ? (
                [0, 1, 2, 3].map((i) => <CardSkeleton key={i} horizontal />)
              ) : !available.length ? (
                <div className="card empty">
                  <h2>
                    {r.resolvedCity === null
                      ? t('We couldn’t find “{city}”.', { city: trip.city })
                      : r.total
                        ? t('Nothing is available for {when}.', { when })
                        : hall
                          ? 'No halls match these filters.'
                          : t('No stays match these filters.')}
                  </h2>
                  <p className="muted">
                    {r.total
                      ? t('Try different dates, or another city.')
                      : t('Try another city or clear your filters.')}
                  </p>
                  {r.total ? <Button onClick={edit.reveal}>{t('Change dates')}</Button> : null}
                  <div className="cities">
                    {CITIES.map((c) => (
                      <AppLink key={c} className="citybtn" to={searchHref({ ...trip, city: c })}>
                        {c}
                      </AppLink>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {available.map((i, n) => (
                    <PropertyCard
                      key={i.property.id}
                      property={i.property}
                      trip={trip}
                      result={i}
                      sizes="(min-width: 768px) 200px, 112px"
                      priority={n === 0}
                    />
                  ))}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
