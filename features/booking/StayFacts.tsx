import { Icon } from '@/components/Icon';
import { fmtDay, fmtRange, nightsBetween } from '@/lib/dates';
import { plural } from '@/lib/money';
import type { Booking } from '@/types';
import './booking.css';

/** Where a booking is and what it covers, as one block: the place, then a hairline and icon rows for the dates, the party
 *  and the rooms (docs/05 StayFacts). Shared by the booking card and the review dialog so a stay always reads the same. */
export function StayFacts({ booking: b }: { booking: Booking }) {
  const p = b.property;
  const hall = p.type === 'hall';
  const rooms = b.quote.lines.map((l) => `${l.qty} × ${l.name}`).join(' · ');
  return (
    <>
      <div className="stay-place">
        <Icon name="pin" size={16} />
        {p.area}, {p.city}
      </div>
      <ul className="stay-facts">
        <li>
          <Icon name="cal" size={16} />
          <span>
            {hall ? fmtDay(b.trip.checkIn) : fmtRange(b.trip.checkIn, b.trip.checkOut)}
            {hall ? '' : ` · ${plural(nightsBetween(b.trip.checkIn, b.trip.checkOut), 'night')}`}
          </span>
        </li>
        <li>
          <Icon name="user" size={16} />
          <span>
            {plural(b.trip.guests, 'guest')}
            {hall ? '' : ` · ${plural(b.trip.rooms, 'room')}`}
          </span>
        </li>
        {rooms ? (
          <li>
            <Icon name="bed" size={16} />
            <span>{rooms}</span>
          </li>
        ) : null}
      </ul>
    </>
  );
}
