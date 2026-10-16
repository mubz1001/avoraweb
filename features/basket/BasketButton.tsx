import type { ComponentPropsWithRef } from 'react';
import { Icon } from '@/components/Icon';
import { useBasket } from '@/lib/basket/useBasket';
import './basket.css';
import { plural, t } from '@/lib/i18n';

type Props = { open: boolean; controls: string } & Omit<ComponentPropsWithRef<'button'>, 'type'>;

/** The header's basket (docs/05 BasketButton): a basket with the room count. The panel it opens is rendered ahead (see
 *  BasketPanel), so a press does no work of its own. */
export function BasketButton({ open, controls, className, ...rest }: Props) {
  const { count } = useBasket();
  return (
    <button
      {...rest}
      type="button"
      className={['bskt-btn', className].filter(Boolean).join(' ')}
      aria-label={count ? t('Basket, {count}', { count: plural(count, 'item') }) : t('Basket, empty')}
      aria-expanded={open}
      aria-controls={controls}
    >
      <Icon name="basket" />
      {count ? (
        // Re-keyed on change so the bump replays each time a room goes in or out.
        <span key={count} className="bskt-n" aria-hidden="true">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  );
}
