import { Chip, Stepper } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { PropertyImage } from '@/components/PropertyImage';
import { useLightbox, warmLightbox } from '@/components/useLightbox';
import { formatMoney, guestsUpTo, plural } from '@/lib/money';
import type { Property, RoomType } from '@/types';
import { t } from '@/lib/i18n';

interface Props {
  property: Property;
  room: RoomType;
  /** Rooms of this type left for the trip. */
  available: number;
  /** Live rate in cents per night (per day for halls), from availability; the stay total is built from it. */
  nightly: number;
  nights: number;
  qty: number;
  index: number;
  onQty: (qty: number) => void;
}

/** One room TYPE with a quantity stepper (docs/05 RoomTypeCard). Scarcity copy only when 2 or fewer are really left. */
export function RoomCard({ property: p, room: r, available, nightly, nights, qty, index, onQty }: Props) {
  const hall = p.type === 'hall';
  const unit = hall ? 'day' : 'night';
  const openPhotos = useLightbox();
  const photo = (
    <PropertyImage
      type={p.type}
      hue={p.hue}
      label={r.name}
      index={index + 2}
      image={r.image}
      sizes="(min-width: 768px) 360px, 100vw"
    />
  );
  return (
    <article className="card room" data-room={r.id}>
      {r.image ? (
        <button
          type="button"
          className="room-photo"
          aria-label={t('Open photo of {name}', { name: r.name })}
          onPointerDown={warmLightbox}
          onClick={(e) => openPhotos([r.image!], 0, e.currentTarget)}
        >
          {photo}
        </button>
      ) : (
        photo
      )}
      <div>
        <h3>
          {r.name}{' '}
          <span className="muted room-left">
            · {available > 0 ? t('{n} available', { n: available }) : t('sold out')}
          </span>
        </h3>
        <div className="rmeta">
          <span className="ico">
            <Icon name="bed" />
            {r.beds}
          </span>
          {hall ? null : (
            <>
              <span className="ico">
                <Icon name="user" />
                {guestsUpTo(r.maxGuests)}
              </span>
              {r.sizeM2 ? (
                <span className="ico">
                  <Icon name="size" />
                  {r.sizeM2} m²
                </span>
              ) : null}
            </>
          )}
        </div>
        <div className="rmeta feats">
          {r.features.map((f) => (
            <Chip key={f}>{f}</Chip>
          ))}
        </div>
        {!hall && available > 0 && available <= 2 ? (
          <Chip tone="warn" className="scarce">
            {t('Only {n} left', { n: available })}
          </Chip>
        ) : null}
      </div>
      <div className="buy">
        <div>
          <b className="amt">{formatMoney(nightly * nights)}</b>{' '}
          <span className="muted small">{t('for {count}', { count: hall ? '1 day' : plural(nights, 'night') })}</span>
          <div className="small muted">
            {formatMoney(nightly)} / {unit}
          </div>
        </div>
        {available > 0 ? (
          <Stepper
            value={qty}
            min={0}
            max={hall ? 1 : available}
            onChange={onQty}
            label={t('{name} quantity', { name: r.name })}
            decLabel={t('Remove one {name}', { name: r.name })}
            incLabel={t('Add one {name}', { name: r.name })}
          />
        ) : (
          <Chip tone="warn">{t('Sold out')}</Chip>
        )}
      </div>
    </article>
  );
}
