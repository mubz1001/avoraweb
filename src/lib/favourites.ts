import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/Toast';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/lib/session';

/** Favourites belong to the account (every device); guests have none and are asked to sign in (docs/02 §4.3).
 *  Toggling is optimistic; a failed save rolls back. */
export function useFavourites() {
  const { member } = useSession();
  const toast = useToast();
  const account = useQuery({
    queryKey: queryKeys.favourites,
    queryFn: ({ signal }) => accountApi.favourites(signal),
    enabled: !!member,
  });

  const save = useMutation({
    mutationFn: (ids: string[]) => accountApi.putFavourites(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favourites });
      const prev = queryClient.getQueryData(queryKeys.favourites);
      queryClient.setQueryData(queryKeys.favourites, { propertyIds: ids });
      return { prev };
    },
    onError: (_e, _ids, ctx) => {
      queryClient.setQueryData(queryKeys.favourites, ctx?.prev);
      toast('We couldn’t update your favourites. Try again.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.favourites }),
  });

  const ids = member ? (account.data?.propertyIds ?? []) : [];

  /** Members only. Returns whether the property is a favourite afterwards. */
  const toggle = (id: string) => {
    const on = !ids.includes(id);
    save.mutate(on ? [...ids, id] : ids.filter((x) => x !== id));
    return on;
  };

  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle,
    signedIn: !!member,
    loading: !!member && account.isPending,
  };
}
