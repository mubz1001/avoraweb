import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/lib/api/endpoints';

/** Booking refs reviewed during this session. The booking itself carries `review` once the list is refreshed; this
 *  client-side list (kept in the query cache; cleared on sign-out with the rest of the account's data) only bridges the
 *  moment between sending and that refreshed list, so the card swaps "Write a review" for "Review sent" at once. */
export function useReviewed() {
  const qc = useQueryClient();
  const { data = [] } = useQuery<string[]>({
    queryKey: queryKeys.reviewed,
    queryFn: () => [],
    enabled: false,
    initialData: [],
    staleTime: Infinity,
  });
  const add = useCallback(
    (ref: string) =>
      qc.setQueryData<string[]>(queryKeys.reviewed, (old = []) => (old.includes(ref) ? old : [...old, ref])),
    [qc],
  );
  return { has: (ref: string) => data.includes(ref), add };
}
