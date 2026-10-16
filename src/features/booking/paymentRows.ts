import { t } from '@/lib/i18n';
import type { Booking } from '@/types';

/** The two payment rows of a booking: the method by name ("EVC Plus", "Visa"), then what identifies it, censored the way
 *  the payment itself was ("+252 61 *** 0100", "•••• •••• •••• 4242"). Only the last four digits of a card are ever kept. */
export function paymentRows(m: Booking['payment']) {
  const card = m.method === 'card';
  return {
    method: card ? (m.brand ?? t('Card')) : (m.brand ?? ''),
    detailLabel: card ? t('Card number') : t('Wallet number'),
    detail: card ? `•••• •••• •••• ${m.last4 ?? '••••'}` : (m.payPhoneMasked ?? ''),
  };
}
