import { createdOrderSchema, type CreatedOrder } from '@/lib/api/schemas';
import { session, storageKeys } from '@/lib/storage';
import type { Booking, Order } from '@/types';

/** A guest's just-paid order, for this browser tab only (sessionStorage: gone when the tab closes). Guests have no
 *  booking lookup; the emailed confirmation is their record (docs/02 §4.2). Never holds the payment token. */
export const saveReceipt = (o: Order) => session.set(storageKeys.receipt, o);
export const readReceipt = (id: string): Order | null => {
  const o = session.get<Order | null>(storageKeys.receipt, null);
  return o && o.id === id && !o.accountId ? o : null;
};

/** A mobile-wallet payment still waiting for approval, for this browser tab only. Reloading or stepping away must not
 *  lose the order: the payment may still be approved, and the guest has nothing else to find it by. The payment token
 *  only lets the holder check that payment and ask for a new prompt (docs/06 Authentication). Parsed like an API
 *  response (storage is editable) and dropped once it is older than the token. */
const PENDING_MAX_MS = 20 * 60e3;
export const savePending = (o: CreatedOrder) => session.set(storageKeys.payment, o);
export const clearPending = () => session.del(storageKeys.payment);
export const readPending = (): CreatedOrder | null => {
  const r = createdOrderSchema.safeParse(session.get<unknown>(storageKeys.payment, null));
  if (r.success && Date.now() - Date.parse(r.data.createdAt) < PENDING_MAX_MS) return r.data;
  clearPending();
  return null;
};

/** One booking of this tab's guest receipt. */
export const readReceiptBooking = (ref: string): Booking | null => {
  const o = session.get<Order | null>(storageKeys.receipt, null);
  return (o && !o.accountId && o.bookings.find((b) => b.ref === ref)) || null;
};

/** Sign-up prefill handed from a guest confirmation to the Create account form (read once). */
export interface Prefill {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}
export const savePrefill = (p: Prefill) => session.set(storageKeys.prefill, p);
export const takePrefill = (): Partial<Prefill> => session.take<Partial<Prefill>>(storageKeys.prefill, {});
