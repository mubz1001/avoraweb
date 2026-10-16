import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { NotFound } from '../NotFound';
import { AppLink } from '@/components/AppLink';
import { Button, ButtonLink } from '@/components/Button';
import { FilterGroup, FilterPanel } from '@/components/FilterPanel';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { ReviewFull, ReviewScore } from '@/features/reviews/ReviewCards';
import { isApiError } from '@/lib/api/client';
import { catalogApi, queryKeys } from '@/lib/api/endpoints';
import { plural } from '@/lib/money';
import { withType } from '@/lib/trip';
import { propertyHref, useTrip } from '@/lib/tripState';
import { useUrlState } from '@/lib/useUrlState';
import type { ReviewSummary } from '@/types';
import '@/features/reviews/reviews.css';

/** URL sort keys (docs/02) → API sort names (docs/06 §3.7). */
const SORTS = [
  ['rel', 'relevant', 'Most relevant'],
  ['new', 'newest', 'Newest first'],
  ['old', 'oldest', 'Oldest first'],
  ['high', 'highest', 'Highest scores'],
  ['low', 'lowest', 'Lowest scores'],
] as const;
const SCORES = [
  ['', 'All scores'],
  ['5', '5 stars'],
  ['4', '4 stars'],
  ['3', '3 stars'],
  ['low', '2 stars or less'],
] as const;

export function Component() {
  const { id = '' } = useParams();
  const property = useQuery({
    queryKey: queryKeys.property(id),
    queryFn: ({ signal }) => catalogApi.property(id, signal),
    staleTime: 5 * 60_000,
  });
  if (property.isError) {
    return isApiError(property.error) && property.error.status === 404 ? (
      <NotFound title="We couldn’t find that property" />
    ) : (
      <div className="wrap" style={{ marginTop: 20 }}>
        <QueryError error={property.error} onRetry={() => void property.refetch()} />
      </div>
    );
  }
  if (!property.data) {
    return (
      <div className="wrap" aria-busy="true">
        <Skeleton width="40%" height={26} style={{ marginTop: 40 }} />
        <Skeleton height={90} radius={14} style={{ marginTop: 16 }} />
      </div>
    );
  }
  return (
    <ReviewsView
      key={id}
      id={id}
      name={property.data.name}
      area={`${property.data.area}, ${property.data.city}`}
      type={property.data.type}
      summary={property.data.reviewSummary}
    />
  );
}

function ReviewsView({
  id,
  name,
  area,
  type,
  summary,
}: {
  id: string;
  name: string;
  area: string;
  type: 'hotel' | 'hall';
  summary: ReviewSummary | undefined;
}) {
  const trip = withType(useTrip(), type);
  const hall = type === 'hall';
  const [params, setUrl] = useUrlState();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [target, setTarget] = useState(params.get('r'));
  const backHref = propertyHref(id, trip);

  const sortKey = SORTS.find(([k]) => k === params.get('sort')) ?? SORTS[0];
  const f = {
    sort: sortKey[1],
    score: params.get('sc') ?? '',
    topic: params.get('topic') ?? '',
  };
  const nActive = (f.score ? 1 : 0) + (f.topic ? 1 : 0);

  const list = useInfiniteQuery({
    queryKey: queryKeys.reviews(id, f),
    queryFn: ({ pageParam, signal }) =>
      catalogApi.reviews(id, { ...f, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!summary,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  const setFilter = (changes: Record<string, string>) => setUrl({ ...changes, r: '' });
  const clear = () => setFilter({ sc: '', topic: '' });

  // Deep link (?r=<reviewId>): page until the review is loaded; if filters hide it, clear them; then highlight it once.
  const found = !!target && items.some((r) => r.id === target);
  useEffect(() => {
    // A page that failed to load is retried from the button below, not in a loop from here.
    if (!target || !list.data || list.isFetching || list.isFetchNextPageError) return;
    if (found) {
      document.getElementById(target)?.scrollIntoView({ block: 'center' });
      const t = setTimeout(() => {
        setTarget(null);
        setFilter({}); // drops `r` so a refresh doesn't jump again
      }, 2200);
      return () => clearTimeout(t);
    }
    if (list.hasNextPage) void list.fetchNextPage();
    else if (nActive) clear(); // filters hid it: show everything
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by the loaded pages
  }, [target, found, list.data, list.isFetching, list.isFetchNextPageError]);

  return (
    <div className="wrap">
      <title>{`Reviews · ${name} · Avora Bookings`}</title>
      <div className="crumb">
        <AppLink to={backHref} state={{ returning: true }} preventScrollReset>
          ← {name}
        </AppLink>
      </div>
      <h1>Guest reviews</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>
        {name} · {area}
      </p>
      {!summary ? (
        <div className="card empty">
          <h2>No reviews yet</h2>
          <p className="muted">Reviews appear after guests have stayed.</p>
          <ButtonLink to={backHref}>Back to {hall ? 'venue' : 'hotel'}</ButtonLink>
        </div>
      ) : (
        <>
          <section className="card rv-sum">
            <ReviewScore summary={summary} big />
          </section>
          <section aria-label="Topics mentioned in reviews">
            <div className="muted small" style={{ margin: '14px 0 8px' }}>
              Mentioned in reviews
            </div>
            <div className="tchips">
              {summary.topics.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={['chip tp', f.topic === t.key && 'on'].filter(Boolean).join(' ')}
                  aria-pressed={f.topic === t.key}
                  onClick={() => setFilter({ topic: f.topic === t.key ? '' : t.key })}
                >
                  {t.label} <span className="muted">{t.count}</span>
                </button>
              ))}
            </div>
          </section>
          <div className="toolbar">
            <Button variant="ghost" className="fbtn" onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen}>
              {nActive ? `Filters (${nActive})` : 'Filters'}
            </Button>
            <label className="sr" htmlFor="rv-sort">
              Sort reviews
            </label>
            <select
              id="rv-sort"
              value={sortKey[0]}
              onChange={(e) => setFilter({ sort: e.target.value === 'rel' ? '' : e.target.value })}
            >
              {SORTS.map(([k, , l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="layout">
            <FilterPanel
              label="Filter reviews"
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              onClear={clear}
              applyLabel={`Show ${plural(total, 'review')}`}
            >
              <FilterGroup title="Review score">
                {SCORES.map(([v, l]) => (
                  <label className="opt" key={v}>
                    <input type="radio" name="sc" checked={f.score === v} onChange={() => setFilter({ sc: v })} /> {l}
                  </label>
                ))}
              </FilterGroup>
            </FilterPanel>
            <section aria-label="Reviews">
              <div className="muted small" aria-live="polite" style={{ marginBottom: 10 }}>
                {list.data ? `${plural(total, 'review')}${nActive ? ' match your filters' : ''}` : ''}
              </div>
              <div className="rv-list" aria-busy={list.isFetching}>
                {list.isError && !list.data ? (
                  <QueryError
                    error={list.error}
                    onRetry={() => void list.refetch()}
                    title="We couldn’t load reviews."
                  />
                ) : !list.data ? (
                  [0, 1, 2].map((i) => <Skeleton key={i} height={160} radius={14} />)
                ) : !items.length ? (
                  <div className="card empty">
                    <h2>No reviews match these filters</h2>
                    <p className="muted">Try a different score or topic.</p>
                    <Button onClick={clear}>Clear filters</Button>
                  </div>
                ) : (
                  items.map((r) => (
                    <ReviewFull key={r.id} review={r} propertyName={name} hall={hall} highlight={r.id === target} />
                  ))
                )}
              </div>
              {list.isFetchNextPageError ? (
                <div style={{ marginTop: 12 }}>
                  <QueryError
                    error={list.error}
                    onRetry={() => void list.fetchNextPage()}
                    title="We couldn’t load more reviews."
                  />
                </div>
              ) : list.hasNextPage ? (
                <Button
                  variant="ghost"
                  block
                  style={{ marginTop: 12 }}
                  busy={list.isFetchingNextPage}
                  busyLabel="Loading…"
                  onClick={() => void list.fetchNextPage()}
                >
                  Show more reviews
                </Button>
              ) : null}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
