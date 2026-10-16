import { findStay, linesOf, selOf, stayOf } from '@/lib/basket';
import { useBasket } from '@/lib/basket/useBasket';
import type { RoomOffer } from '@/lib/pricing';
import { withType } from '@/lib/trip';
import type { Property, Trip } from '@/types';

/**
 * The property page's room quantities, kept in the basket (docs/02 §4.14) as this page's stay (property + dates). The
 * basket can hold stays at other properties at the same time; picking rooms here only ever changes this stay. Anything
 * no longer bookable is left out, so stale picks never reach checkout. Halls take one hall at a time.
 */
export function useStaySelection(p: Property, trip: Trip, offers: RoomOffer[]) {
  const { basket, set: put, move } = useBasket();
  const stay = stayOf(p.id, trip);
  const mine = findStay(basket, stay);

  const stored = mine ? selOf(mine.lines) : {};
  const sel: Record<string, number> = {};
  for (const o of offers) {
    const q = stored[o.id] ?? 0;
    if (q > 0 && q <= o.available) sel[o.id] = q;
  }

  const set = (id: string, qty: number) => {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;
    const q = Math.max(0, Math.min(offer.available, qty));
    put(stay, linesOf(p.type === 'hall' ? (q ? { [id]: 1 } : {}) : { ...sel, [id]: q }));
  };

  return {
    sel,
    set,
    /** The trip was edited on the page: this stay moves with it, rooms and all. */
    moveStay: (next: Trip) => {
      if (mine) move(mine, stayOf(p.id, withType(next, p.type)));
    },
  };
}
