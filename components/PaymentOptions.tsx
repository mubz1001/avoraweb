import { useId } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import type { z } from 'zod';
import { Accordion } from './Accordion';
import { Chip } from './Controls';
import { TextField } from './Field';
import { Icon } from './Icon';
import { formatCardNumber, formatExpiry } from '@/lib/payments/hostedFields';
import { methodExpired, methodSub, methodTitle, WALLETS } from '@/lib/payments/methods';
import { cardMsg, cvcMsg, expMsg } from '@/lib/validation/rules';
import type { PaymentMethodKind, SavedPaymentMethod } from '@/types';
import './PaymentOptions.css';
import { t } from '@/lib/i18n';

/** Field names every form embedding PaymentOptions uses. `pm` is "saved:<id>", "wallet:<brand>" or "card". */
export interface PaymentFields {
  pm: string;
  card: string;
  exp: string;
  cvc: string;
}

const walletPm = (brand: string) => `wallet:${brand}`;

export const paymentDefaults = (saved: SavedPaymentMethod[] = [], defaultId = ''): PaymentFields => {
  const usable = saved.filter((m) => !methodExpired(m));
  const first = usable.find((m) => m.id === defaultId) ?? usable[0];
  return { pm: first ? `saved:${first.id}` : walletPm(WALLETS[0]!.brand), card: '', exp: '', cvc: '' };
};

/** Card rules apply only while Card is the chosen option (zod superRefine helper). */
export function checkPaymentFields(v: PaymentFields, ctx: z.RefinementCtx) {
  if (v.pm !== 'card') return;
  for (const [path, msg] of [
    ['card', cardMsg(v.card)],
    ['exp', expMsg(v.exp)],
    ['cvc', cvcMsg(v.cvc)],
  ] as const) {
    if (msg) ctx.addIssue({ code: 'custom', path: [path], message: msg });
  }
}

/** What the chosen option means for the payment request: the API's method kind and brand. */
export function pickedMethod(
  v: PaymentFields,
  saved: SavedPaymentMethod[],
): { kind: PaymentMethodKind; brand: string; saved?: SavedPaymentMethod } {
  if (v.pm.startsWith('saved:')) {
    const s = saved.find((m) => m.id === v.pm.slice(6));
    if (s) return { kind: s.kind, brand: s.brand, saved: s };
  }
  if (v.pm === 'card') return { kind: 'card', brand: '' };
  const w = WALLETS.find((x) => walletPm(x.brand) === v.pm) ?? WALLETS[0]!;
  return { kind: w.kind, brand: w.brand };
}

interface Props<T extends FieldValues & PaymentFields> {
  control: Control<T>;
  saved?: SavedPaymentMethod[];
  defaultId?: string;
}

/** Saved methods first (signed in), then one set of tiles: each wallet by name, and Card (docs/05 PaymentMethods). All
 *  options are one radio group, so arrow keys move through them. Card inputs stand in for the provider's hosted fields. */
export function PaymentOptions<T extends FieldValues & PaymentFields>({ control, saved = [], defaultId }: Props<T>) {
  const cardId = useId();
  const pm = useController({ control, name: 'pm' as FieldPath<T> });
  const value = String(pm.field.value);
  const radio = (v: string, disabled?: boolean) => (
    <input
      type="radio"
      name={pm.field.name}
      value={v}
      checked={value === v}
      disabled={disabled}
      onChange={() => pm.field.onChange(v)}
    />
  );

  return (
    <div className="pm" role="radiogroup" aria-label={t('Payment method')}>
      {saved.length ? <p className="pmhead">{t('Saved')}</p> : null}
      {saved.map((m) => {
        const expired = methodExpired(m);
        const v = `saved:${m.id}`;
        return (
          <label key={v} className={['pmopt', value === v && 'on', expired && 'dis'].filter(Boolean).join(' ')}>
            {radio(v, expired)}
            <span className="pi">
              <Icon name={m.kind === 'card' ? 'card' : 'mobile'} />
            </span>
            <span className="grow">
              <span className="pmt">{methodTitle(m)}</span>
              <span className="muted small">{methodSub(m)}</span>
            </span>
            {expired ? (
              <Chip tone="warn">{t('Expired')}</Chip>
            ) : m.id === defaultId ? (
              <Chip>{t('Default')}</Chip>
            ) : null}
          </label>
        );
      })}
      {saved.length ? <p className="pmhead">{t('Add a new method')}</p> : null}
      <div className="pmtiles">
        {WALLETS.map((w) => (
          <label key={w.brand} className={['pmtile', value === walletPm(w.brand) && 'on'].filter(Boolean).join(' ')}>
            {radio(walletPm(w.brand))}
            {w.brand}
          </label>
        ))}
        <label className={['pmtile', value === 'card' && 'on'].filter(Boolean).join(' ')}>
          {radio('card')}
          Card
        </label>
      </div>
      <Accordion id={cardId} open={value === 'card'} padded={false}>
        <div className="pmcard">
          <TextField
            control={control}
            name={'card' as FieldPath<T>}
            label={t('Card number')}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            format={formatCardNumber}
          />
          <div className="grid2">
            <TextField
              control={control}
              name={'exp' as FieldPath<T>}
              label={t('Expiry')}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder={t('MM/YY')}
              format={formatExpiry}
            />
            <TextField
              control={control}
              name={'cvc' as FieldPath<T>}
              label={t('CVC')}
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={4}
              placeholder="123"
            />
          </div>
        </div>
      </Accordion>
    </div>
  );
}
