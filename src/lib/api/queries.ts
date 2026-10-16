import { catalogApi, queryKeys } from '@/lib/api/endpoints';
import type { Trip } from '@/types';

/** Property and availability queries, shared by the property page, checkout and the basket so they share one cache. */
export const propertyQuery = (id: string) => ({
  queryKey: queryKeys.property(id),
  queryFn: ({ signal }: { signal?: AbortSignal }) => catalogApi.property(id, signal),
  staleTime: 5 * 60_000,
});

/** Fresh for 30 seconds only: rooms sell out. Long enough that the page doesn't refetch what its loader (or the
 *  hover prefetch) just fetched; checkout re-checks availability and price on its own. */
export const availabilityQuery = (id: string, trip: Trip) => ({
  queryKey: queryKeys.availability(id, trip),
  queryFn: ({ signal }: { signal?: AbortSignal }) => catalogApi.availability(id, trip, signal),
  staleTime: 30_000,
});
