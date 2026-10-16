import { phoneFmt } from '@/lib/phone';
import { cardExpired } from '@/lib/validation/rules';
import type { PaymentMethodKind, SavedPaymentMethod } from '@/types';

/** The wallets people pay with, by the name they know (docs/05 PaymentMethods). The provider behind each (WaafiPay or
 *  eDahab) is only what the API needs, so the UI never shows it. A card is the other way to pay. */
export const WALLETS: { brand: string; kind: Exclude<PaymentMethodKind, 'card'> }[] = [
  { brand: 'EVC Plus', kind: 'waafipay' },
  { brand: 'ZAAD', kind: 'waafipay' },
  { brand: 'SAHAL', kind: 'waafipay' },
  { brand: 'eDahab', kind: 'edahab' },
  { brand: 'Premier Wallet', kind: 'edahab' },
];

const mmyy = (m: Pick<SavedPaymentMethod, 'expMonth' | 'expYear'>) =>
  `${String(m.expMonth ?? 0).padStart(2, '0')}/${String((m.expYear ?? 0) % 100).padStart(2, '0')}`;

export const methodExpired = (m: Pick<SavedPaymentMethod, 'kind' | 'expMonth' | 'expYear'>) =>
  m.kind === 'card' && m.expMonth != null && m.expYear != null && cardExpired(mmyy(m));
export const methodTitle = (m: Pick<SavedPaymentMethod, 'kind' | 'brand' | 'last4'>) =>
  m.kind === 'card' ? `${m.brand} •••• ${m.last4}` : m.brand;
export const methodSub = (m: Pick<SavedPaymentMethod, 'kind' | 'expMonth' | 'expYear' | 'phone'>) =>
  m.kind === 'card' ? `Expires ${mmyy(m)}` : `+252 ${phoneFmt(m.phone ?? '')}`;
