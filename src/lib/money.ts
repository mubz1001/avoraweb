import { plural, t } from '@/lib/i18n';
import type { Money } from '@/types';

export const usd = (amount: number): Money => ({ amount, currency: 'USD' });

/** Whole-dollar display: "$1,234". Amounts are integer cents; the UI never does float math on money. */
export const formatMoney = (m: Money | number) =>
  '$' + Math.round((typeof m === 'number' ? m : m.amount) / 100).toLocaleString('en-US');

export { plural };

/** How many people a room (or a basket's rooms together) hold: "Up to 1 guest", "Up to 4 guests". The one phrase for it. */
export const guestsUpTo = (n: number) => t('Up to {guests}', { guests: plural(n, 'guest') });
