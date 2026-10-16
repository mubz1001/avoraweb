import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppLink } from '@/components/AppLink';
import { Button, ButtonLink } from '@/components/Button';
import { Chip } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { PropertyImage } from '@/components/PropertyImage';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { useBasket } from '@/lib/basket/useBasket';
import { formatMoney } from '@/lib/money';
import { propertyHref, saveTrip } from '@/lib/tripState';
import { bookingHref } from '@/features/booking/links';
import { StayFacts } from '@/features/booking/StayFacts';
import type { Booking, Member } from '@/types';
import { ReviewDialog } from '@/features/reviews/ReviewDialog';
import { useReviewed } from '@/features/reviews/useReviewed';
import { canRebook, canReview, checkInText, rebookStay, STATUS } from './bookingInfo';

/** One booking: the stay's photo, then what it is, when, who for, and what to know next (docs/05 BookingCard). The whole
 *  card opens the booking (the hotel name is the link, stretched over the card). Upcoming stays add the check-in
 *  countdown and free cancellation; past stays are plainer, and a finished stay offers "Write a review". */
function BookingCard({
  booking: b,
  upcoming,
  reviewed,
  onReview,
  onRebook,
}: {
  booking: Booking;
  upcoming: boolean;
  reviewed: boolean;
  onReview: (b: Booking) => void;
  onRebook: (b: Booking) => void;
}) {
  const p = b.property;
  const hall = p.type === 'hall';
  const status = STATUS[b.status];
  const next = upcoming ? checkInText(b.trip.checkIn, hall) : null;
  return (
    <article className={['card bkcard', !upcoming && 'past'].filter(Boolean).join(' ')}>
      <PropertyImage type={p.type} hue={p.hue} label={p.propertyType} image={p.image} className="bkcard-ph" />
      <div className="bkcard-body">
        <div className="bkcard-top">
          <AppLink className="bkcard-link" to={bookingHref(b.ref)}>
            <b>{p.name}</b>
          </AppLink>
          {next ? <Chip>{next}</Chip> : null}
          {b.status === 'confirmed' ? null : <Chip tone={status.tone}>{status.label}</Chip>}
        </div>
        <StayFacts booking={b} />
        <div className="bkcard-foot">
          <span className="bkcard-ref">{b.ref}</span>
          <b className="bkcard-total">{formatMoney(b.quote.total)}</b>
        </div>
        {canReview(b) || canRebook(b) ? (
          <div className="bkcard-rv">
            {canRebook(b) ? (
              <Button size="sm" aria-label={`Rebook ${p.name}`} onClick={() => onRebook(b)}>
                Rebook
              </Button>
            ) : null}
            {canReview(b) ? (
              reviewed ? (
                <Chip tone="ok">
                  <Icon name="check" size={14} /> Review sent
                </Chip>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Write a review of ${p.name}`}
                  onClick={() => onReview(b)}
                >
                  Write a review
                </Button>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** My bookings: upcoming (soonest first) and past. Members only: the account page asks guests to sign in. */
export function BookingsTab({ member }: { member: Member }) {
  const reviewed = useReviewed();
  const navigate = useNavigate();
  const { set: putStay } = useBasket();
  const [reviewing, setReviewing] = useState<Booking | null>(null);
  /** One tap: the same room(s) for a new stay are put in the basket, and the hotel opens with them picked. */
  const rebook = (b: Booking) => {
    const { trip, stay, lines } = rebookStay(b);
    putStay(stay, lines);
    saveTrip(trip);
    void navigate(propertyHref(b.property.id, trip));
  };
  const q = useQuery({
    queryKey: queryKeys.myBookings,
    queryFn: ({ signal }) => accountApi.bookings(signal),
    enabled: !!member,
  });
  if (q.isError)
    return <QueryError error={q.error} onRetry={() => void q.refetch()} title="We couldn’t load your bookings." />;
  if (!q.data) {
    return (
      <div className="narrow stack-s" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={150} radius={14} />
        ))}
      </div>
    );
  }
  const { upcoming, past } = q.data;
  if (!upcoming.length && !past.length) {
    return (
      <div className="narrow">
        <div className="card empty">
          <h2>No bookings yet</h2>
          <p className="muted">Stays you book while signed in appear here, on every device.</p>
          <ButtonLink to="/">Find a stay</ButtonLink>
        </div>
      </div>
    );
  }
  return (
    <div className="narrow">
      {upcoming.length ? <h3 className="sechead first">Upcoming</h3> : null}
      {upcoming.map((b) => (
        <BookingCard key={b.ref} booking={b} upcoming reviewed={false} onReview={setReviewing} onRebook={rebook} />
      ))}
      {past.length ? (
        <h3 className={['sechead', !upcoming.length && 'first'].filter(Boolean).join(' ')}>Past stays</h3>
      ) : null}
      {past.map((b) => (
        <BookingCard
          key={b.ref}
          booking={b}
          upcoming={false}
          reviewed={!!b.review || reviewed.has(b.ref)}
          onReview={setReviewing}
          onRebook={rebook}
        />
      ))}
      {reviewing ? (
        <ReviewDialog
          key={reviewing.ref}
          booking={reviewing}
          memberId={member.id}
          onReviewed={reviewed.add}
          onClose={() => setReviewing(null)}
        />
      ) : null}
    </div>
  );
}
