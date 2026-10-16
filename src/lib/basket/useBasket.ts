import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { moveStay, parseBasket, readDeviceBasket, roomCount, withStay, writeDeviceBasket, type Stay } from './index';
import { useToast } from '@/components/Toast';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/lib/session';
import { storageKeys } from '@/lib/storage';
import { useLocalValue } from '@/lib/useLocalValue';
import type { Basket, BasketLine, BasketStay } from '@/types';

type Saved = { basket: Basket | null };

/**
 * The basket as React state (docs/04 §A.5). Members: GET/PUT/DELETE /me/basket, every device. Guests: localStorage,
 * shared live across tabs. Every change is worked out from the basket as it is at that moment (not as it was when the
 * page last rendered), so quick taps on different stays never undo each other. Writes are optimistic; a failed save
 * rolls back and says so. Saves run one at a time (mutation scope), so they reach the server in order.
 */
export function useBasket() {
  const { member, loading: sessionLoading } = useSession();
  const toast = useToast();
  const [deviceRaw] = useLocalValue<unknown>(storageKeys.basket, null);
  const device = useMemo(() => parseBasket(deviceRaw), [deviceRaw]);
  const account = useQuery({
    queryKey: queryKeys.basket,
    queryFn: ({ signal }) => accountApi.basket(signal),
    enabled: !!member,
    refetchOnWindowFocus: true, // another device may have changed it
  });

  const save = useMutation({
    scope: { id: 'basket' },
    mutationFn: (next: Basket | null) =>
      next ? accountApi.putBasket(next) : accountApi.clearBasket().then((): Saved => ({ basket: null })),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.basket });
      const prev = queryClient.getQueryData<Saved>(queryKeys.basket);
      queryClient.setQueryData<Saved>(queryKeys.basket, { basket: next });
      return { prev };
    },
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.basket, saved),
    onError: (_e, _next, ctx) => {
      queryClient.setQueryData(queryKeys.basket, ctx?.prev);
      toast('We couldn’t update your basket. Try again.');
    },
  });

  const basket = member ? (account.data?.basket ?? null) : device;

  const update = (change: (current: Basket | null) => Basket | null) => {
    if (member) save.mutate(change(queryClient.getQueryData<Saved>(queryKeys.basket)?.basket ?? null));
    else writeDeviceBasket(change(readDeviceBasket()));
  };

  return {
    basket,
    stays: basket?.stays ?? ([] as BasketStay[]),
    count: roomCount(basket),
    loading: sessionLoading || (!!member && account.isPending),
    /** Gives this stay these rooms; none removes the stay. Other stays are untouched. */
    set: (stay: Stay, lines: BasketLine[]) => update((b) => withStay(b, stay, lines)),
    /** Moves a stay to new dates or party, keeping its rooms. */
    move: (from: Stay, to: Stay) => update((b) => moveStay(b, from, to)),
  };
}
