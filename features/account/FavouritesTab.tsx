import { useQueries } from '@tanstack/react-query';
import { ButtonLink } from '@/components/Button';
import { PropertyCard } from '@/components/PropertyCard';
import { CardSkeleton } from '@/components/Skeleton';
import { catalogApi, queryKeys } from '@/lib/api/endpoints';
import { useTrip } from '@/lib/tripState';
import { useFavourites } from '@/lib/favourites';

/** Favourites: kept in the account, so they follow the member to every device. Members only. */
export function FavouritesTab() {
  const favs = useFavourites();
  const trip = useTrip();
  const props = useQueries({
    queries: favs.ids.map((id) => ({
      queryKey: queryKeys.property(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => catalogApi.property(id, signal),
      staleTime: 5 * 60_000,
    })),
  });
  if (favs.loading) {
    return (
      <div className="cards3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (!favs.ids.length) {
    return (
      <div className="card empty">
        <h2>You have no favourites yet</h2>
        <p className="muted">Tap the heart on a stay to add it to your favourites.</p>
        <ButtonLink to="/">Browse stays</ButtonLink>
      </div>
    );
  }
  return (
    <>
      <div className="cards3">
        {props.map((q, i) =>
          q.data ? (
            <PropertyCard key={q.data.id} property={q.data} trip={trip} />
          ) : q.isPending ? (
            <CardSkeleton key={favs.ids[i]} />
          ) : null,
        )}
      </div>
    </>
  );
}
