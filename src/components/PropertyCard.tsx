import { AppLink } from './AppLink';
import { Chip, Rating } from './Controls';
import { PropertyImage } from './PropertyImage';
import { FavouriteHeart } from './FavouriteHeart';
import type { SearchItem } from '@/lib/api/schemas';
import { formatMoney, plural } from '@/lib/money';
import { HALL_AMENITIES, HOTEL_AMENITIES } from '@/lib/reference';
import { propertyHref } from '@/lib/tripState';
import type { PropertySummary, Trip } from '@/types';
import './PropertyCard.css';
import { t } from '@/lib/i18n';

interface Props {
  property: PropertySummary;
  /** The link carries this trip. */
  trip: Trip;
  /** Search result for the trip: availability and the stay total. Without it the card shows "From $X / night". */
  result?: SearchItem;
  /** The photo's rendered width, for the browser's choice of image size. */
  sizes?: string;
  /** The photo is above the fold: load it now rather than lazily. */
  priority?: boolean;
}

/** Result card for Home, Search and Favourites (docs/05 ResultCard). The whole card is one link; the heart and
 *  "Change dates" sit above it. A rating appears only from 3 reviews (no placeholder). */
export function PropertyCard({
  property: p,
  trip,
  result,
  sizes = '(min-width: 1100px) 340px, (min-width: 768px) 45vw, 100vw',
  priority,
}: Props) {
  const hall = p.type === 'hall';
  const unit = hall ? 'day' : 'night';
  const amenity = hall ? HALL_AMENITIES : HOTEL_AMENITIES;
  const rooms = trip.rooms;

  let price;
  if (result?.stayTotal && result.fromRate) {
    price = (
      <>
        <div>
          <b className="amt">{formatMoney(result.stayTotal)}</b>{' '}
          <span className="muted small">
            {t('total')} ·{' '}
            {hall ? '1 day' : plural(result.nights, 'night') + (rooms > 1 ? ' · ' + plural(rooms, 'room') : '')}
          </span>
        </div>
        <div className="muted small">
          {formatMoney(result.fromRate)} / {t(unit)}
          {rooms > 1 ? ` ${t('per room')}` : ''}
        </div>
      </>
    );
  } else {
    price = (
      <>
        <div className="muted small">{t('From')}</div>
        <div>
          <b className="amt">{formatMoney(p.fromPrice)}</b> <span className="muted small">/ {t(unit)}</span>
        </div>
      </>
    );
  }

  return (
    <article className="hcard">
      <FavouriteHeart id={p.id} />
      <PropertyImage
        type={p.type}
        hue={p.hue}
        label={p.propertyType}
        image={p.images[0]}
        sizes={sizes}
        priority={priority}
      />
      <div className="body">
        <div className="info">
          <h3>
            <AppLink to={propertyHref(p.id, trip)}>{p.name}</AppLink>
          </h3>
          <div className="meta">
            {p.area}, {p.city}
            {hall ? ' · up to 500 guests' : ''}
          </div>
          {p.rating ? (
            <div className="row">
              <Rating score={p.rating.score} count={p.rating.count} />
            </div>
          ) : null}
          <div className="row chips">
            {p.amenities.slice(0, 2).map((a) => (
              <Chip key={a}>{t(amenity[a] ?? a)}</Chip>
            ))}
          </div>
        </div>
        <div className="price">{price}</div>
      </div>
    </article>
  );
}
