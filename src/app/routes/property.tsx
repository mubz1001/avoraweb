import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams, type LoaderFunctionArgs } from 'react-router';
import { NotFound } from '../NotFound';
import type { RouteHandle } from '../RootLayout';
import { Accordion, useAccordion } from '@/components/Accordion';
import { AppLink } from '@/components/AppLink';
import { Button, ButtonLink } from '@/components/Button';
import { Rating } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { FavouriteHeart } from '@/components/FavouriteHeart';
import { Gallery } from '@/features/property/Gallery';
import { availabilityQuery, propertyQuery } from '@/lib/api/queries';
import { LazyMap } from '@/features/property/LazyMap';
import { mapEmbedUrl } from '@/features/property/map';
import { RoomCard } from '@/features/property/RoomCard';
import { fitSpoken, StayFit } from '@/features/property/StayFit';
import { useStaySelection } from '@/features/property/useStaySelection';
import { ReviewCompact, ReviewScore } from '@/features/reviews/ReviewCards';
import { DateRangePopover } from '@/features/search/DateRangePicker';
import { GuestsRoomsPopover } from '@/features/search/GuestsRoomsPicker';
import { SearchForm } from '@/features/search/SearchForm';
import { isApiError } from '@/lib/api/client';
import { fmtDay, fmtRange } from '@/lib/dates';
import { formatMoney, plural } from '@/lib/money';
import { minRate, price, recommend, stayFit, type RoomOffer } from '@/lib/pricing';
import { queryClient, warm } from '@/lib/queryClient';
import { HALL_AMENITIES, HOTEL_AMENITIES } from '@/lib/reference';
import { useReturnScroll } from '@/lib/scroll';
import { local, storageKeys } from '@/lib/storage';
import { parseTrip, withType } from '@/lib/trip';
import { CHECKOUT_HREF, propertyHref, reviewsHref, saveTrip, useTrip } from '@/lib/tripState';
import type { Property, Trip } from '@/types';
import '@/features/property/property.css';
import { useSeo } from '@/lib/seo';
import { t } from '@/lib/i18n';

export const handle: RouteHandle = { stickyBar: true };

/** Filter and trip edits on the same page update the URL only; the page's queries refetch on their own. */
export const shouldRevalidate = ({ currentUrl, nextUrl }: { currentUrl: URL; nextUrl: URL }) =>
  currentUrl.pathname !== nextUrl.pathname;

export function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id ?? '';
  const trip = parseTrip(new URL(request.url).searchParams, local.get<Partial<Trip>>(storageKeys.trip, {}));
  return warm(
    queryClient
      .ensureQueryData(propertyQuery(id))
      .then((p) => queryClient.ensureQueryData(availabilityQuery(id, withType(trip, p.type)))),
  );
}

export function Component() {
  const { id = '' } = useParams();
  const q = useQuery(propertyQuery(id));
  if (q.isError) {
    return isApiError(q.error) && q.error.status === 404 ? (
      <NotFound
        title={t('We couldn’t find that property')}
        body={t('It may have been removed, or the link is mistyped.')}
      />
    ) : (
      <div className="wrap" style={{ marginTop: 20 }}>
        <QueryError error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  }
  if (!q.data) return <PropertySkeleton />;
  return <PropertyView key={id} property={q.data} />;
}

function PropertySkeleton() {
  return (
    <div className="wrap" aria-busy="true">
      <Skeleton height={260} radius={14} style={{ marginTop: 14 }} />
      <Skeleton width="55%" height={26} style={{ marginTop: 18 }} />
      <Skeleton width="35%" style={{ marginTop: 10 }} />
      <Skeleton height={56} radius={14} style={{ marginTop: 16 }} />
    </div>
  );
}

function PropertyView({ property: p }: { property: Property }) {
  useSeo({
    description: `${p.name} in ${p.area}, ${p.city}. ${p.description}`.slice(0, 158).trimEnd(),
    path: `/stays/${encodeURIComponent(p.id)}`,
    ...(p.images[0] ? { image: p.images[0].url } : {}),
  });
  const trip = withType(useTrip(), p.type);
  const hall = p.type === 'hall';
  const navigate = useNavigate();
  const { hash } = useLocation();
  const edit = useAccordion();
  const roomsRef = useRef<HTMLElement>(null);
  const amenity = hall ? HALL_AMENITIES : HOTEL_AMENITIES;
  const when = hall ? fmtDay(trip.checkIn) : fmtRange(trip.checkIn, trip.checkOut);

  // Guests and rooms are part of the key: keep the last answer on screen while a change refetches, so the room list
  // and the picks don't drop out on every stepper tap.
  const avail = useQuery({ ...availabilityQuery(p.id, trip), placeholderData: (prev) => prev });
  const offers: RoomOffer[] = p.roomTypes.map((r) => {
    const a = avail.data?.roomTypes.find((x) => x.roomTypeId === r.id);
    return {
      id: r.id,
      name: r.name,
      maxGuests: r.maxGuests,
      available: a?.available ?? 0,
      nightly: a?.nightlyPrice.amount ?? r.nightlyPrice.amount,
    };
  });
  const ready = !!avail.data;
  const unavailable = ready && !avail.data.available;
  const { sel, set, moveStay } = useStaySelection(p, trip, offers);
  const quote = price(offers, sel, trip);
  const rec = ready && !unavailable ? recommend(offers, trip) : null;
  const recRoom = rec ? p.roomTypes.find((r) => r.id === rec.id) : undefined;
  const others = p.roomTypes.filter((r) => r !== recRoom);
  const fit = stayFit(offers, sel, trip);
  const freeUntil = avail.data?.freeCancellationUntil;

  useReturnScroll(ready);
  useEffect(() => {
    if (ready && hash === '#rooms') roomsRef.current?.scrollIntoView();
  }, [ready, hash]);

  const scrollToRooms = () => {
    const el = roomsRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.querySelectorAll('.room').forEach((c) => {
      c.classList.remove('flash');
      void (c as HTMLElement).offsetWidth; // restart the highlight animation
      c.classList.add('flash');
    });
  };
  /** A new trip from the trip card or the sticky bar: remembered, carried into the basket, and put in the URL. */
  const applyTrip = (next: Trip) => {
    saveTrip(next);
    moveStay(next);
    void navigate(propertyHref(p.id, next), { replace: true, preventScrollReset: true });
  };
  const reserve = () => {
    saveTrip(trip);
    void navigate(CHECKOUT_HREF);
  };

  const card = (r: Property['roomTypes'][number]) => (
    <RoomCard
      key={r.id}
      property={p}
      room={r}
      index={p.roomTypes.indexOf(r)}
      available={offers.find((o) => o.id === r.id)?.available ?? 0}
      nightly={offers.find((o) => o.id === r.id)?.nightly ?? r.nightlyPrice.amount}
      nights={quote.nights}
      qty={sel[r.id] ?? 0}
      onQty={(n) => set(r.id, n)}
    />
  );

  return (
    <>
      <title>{`${p.name} · ${p.city} · Avora Bookings`}</title>
      <div className="wrap">
        <Gallery property={p} />
        <div className="twocol">
          <div>
            <div className="hhead">
              <div className="row between">
                <h1>{p.name}</h1>
                <FavouriteHeart id={p.id} floating={false} />
              </div>
              <div className="row hhead-meta">
                {p.rating ? (
                  <AppLink
                    className="rate-link"
                    to={reviewsHref(p.id, trip)}
                    aria-label={t('Read all {n} reviews', { n: p.rating.count })}
                  >
                    <Rating score={p.rating.score} count={p.rating.count} />
                  </AppLink>
                ) : null}
              </div>
            </div>

            <section className="pagesec" id="about" aria-label={hall ? 'About this venue' : t('About this hotel')}>
              <div className="card about">
                <div className="ab">
                  <h3>{t('Overview')}</h3>
                  <p>{p.description}</p>
                </div>
                <div className="ab">
                  <h3>{hall ? t('Services') : t('Amenities')}</h3>
                  <div className="amen">
                    {p.amenities.map((a) => (
                      <div key={a}>
                        <Icon name="check" />
                        {t(amenity[a] ?? a)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ab">
                  <h3>{hall ? t('Event times') : t('Check-in & check-out')}</h3>
                  <div className="facts">
                    <div>
                      <div className="muted small">{hall ? t('Starts from') : t('Check-in from')}</div>
                      <b>{p.checkInFrom}</b>
                    </div>
                    <div>
                      <div className="muted small">{hall ? t('Music ends by') : t('Check-out until')}</div>
                      <b>{p.checkOutUntil}</b>
                    </div>
                  </div>
                </div>
                <div className="ab">
                  <h3>{t('Location')}</h3>
                  <LazyMap title={t('Map of {name}', { name: p.name })} src={mapEmbedUrl(p)} />
                  <p>{p.address}</p>
                </div>
                <div className="ab">
                  <h3>{t('Cancellation')}</h3>
                  <div className="small">
                    {!ready ? (
                      <Skeleton width="60%" />
                    ) : freeUntil ? (
                      <>
                        <b className="ok">{t('Free cancellation until {date}', { date: fmtDay(freeUntil) })}.</b>{' '}
                        {hall ? t('After that the first day is charged.') : t('After that the first night is charged.')}
                      </>
                    ) : (
                      <b>{t('This booking is non-refundable for your dates.')}</b>
                    )}
                  </div>
                </div>
                {p.reviewSummary && p.latestReviews?.length ? (
                  <div className="ab" id="reviews">
                    <h3>{t('Guest reviews')}</h3>
                    <ReviewScore summary={p.reviewSummary} />
                    <div className="rv-row">
                      {p.latestReviews.map((r) => (
                        <ReviewCompact key={r.id} review={r} href={reviewsHref(p.id, trip, { sort: 'new', r: r.id })} />
                      ))}
                    </div>
                    <ButtonLink variant="ghost" block to={reviewsHref(p.id, trip)}>
                      {t('Read all {n} reviews', { n: p.reviewSummary.count })}
                    </ButtonLink>
                  </div>
                ) : (
                  <div className="ab">
                    <h3>{t('Guest reviews')}</h3>
                    <p className="muted small">{t('New on AVORA – reviews appear after guests have stayed.')}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="pagesec" id="rooms" ref={roomsRef} aria-label={hall ? t('Halls') : t('Rooms')}>
              <div className="card tripcard">
                <div className="tripbar-row">
                  <div>
                    <b>{when}</b> · {plural(trip.guests, 'guest')}
                    {hall ? '' : ' · ' + plural(trip.rooms, 'room')}
                  </div>
                  <Button variant="ghost" size="sm" {...edit.triggerProps}>
                    {edit.open ? t('Close') : t('Edit')}
                  </Button>
                </div>
                <Accordion {...edit.panelProps}>
                  <SearchForm trip={trip} hideCity instant onSubmit={({ trip: next }) => applyTrip(next)} />
                </Accordion>
              </div>
              {avail.isError ? (
                <QueryError
                  error={avail.error}
                  onRetry={() => void avail.refetch()}
                  title={t('We couldn’t load rooms for your dates.')}
                />
              ) : !ready ? (
                [0, 1].map((i) => <Skeleton key={i} height={180} radius={14} style={{ marginBottom: 12 }} />)
              ) : (
                <>
                  {unavailable ? (
                    <div className="card na-banner">
                      <b>Not available for {when}.</b>
                      <Button size="sm" onClick={edit.reveal}>
                        {t('Change dates')}
                      </Button>
                    </div>
                  ) : null}
                  {recRoom ? (
                    <>
                      <h3 className="grp">{t('Recommended for you')}</h3>
                      <p className="muted small grpsub">
                        {!hall && trip.rooms > 1
                          ? t('Best fit for {guests} in {rooms}', {
                              guests: plural(trip.guests, 'guest'),
                              rooms: plural(trip.rooms, 'room'),
                            })
                          : t('Best fit for {guests}', { guests: plural(trip.guests, 'guest') })}
                      </p>
                      {card(recRoom)}
                      {others.length ? <h3 className="grp">{hall ? 'Other halls' : t('Other rooms')}</h3> : null}
                      {others.map(card)}
                    </>
                  ) : (
                    p.roomTypes.map(card)
                  )}
                </>
              )}
            </section>
          </div>

          <aside className="sidecard" aria-label={t('Your stay')}>
            <div className="card">
              {unavailable ? (
                <>
                  <b>{t('Not available')}</b>
                  <p className="muted small">{t('Try different dates.')}</p>
                </>
              ) : !quote.rooms ? (
                <>
                  <div className="muted small">{t('From')}</div>
                  <b className="from">{formatMoney(minRate(offers))}</b>{' '}
                  <span className="muted">/ {hall ? t('day') : t('night')}</span>
                  <p className="muted small">
                    {when} · {plural(trip.guests, 'guest')}
                    <br />
                    {hall ? 'Select a hall to see your total.' : t('Select a room to see your total.')}
                  </p>
                </>
              ) : (
                <>
                  <b>{t('Your stay')}</b>
                  <p className="muted small">
                    {when} · {plural(trip.guests, 'guest')}
                  </p>
                  {quote.lines.map((l) => (
                    <div className="kv" key={l.offer.id}>
                      <span>
                        {l.qty} × {l.offer.name}
                      </span>
                      <b>{formatMoney(l.total)}</b>
                    </div>
                  ))}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="sticky">
        <div className="wrap">
          <div className="sticky-sum">
            <div aria-live="polite">
              {unavailable ? (
                <>
                  <b>{t('Not available')}</b>
                  <div className="muted small">{t('for your dates')}</div>
                </>
              ) : !quote.rooms ? (
                <>
                  <b>{t('From {price}', { price: formatMoney(minRate(offers)) })}</b>{' '}
                  <span className="muted small">/ {hall ? t('day') : t('night')}</span>
                </>
              ) : (
                <>
                  <b>
                    {hall ? '1 hall · ' : ''}
                    {formatMoney(quote.subtotal)} · {hall ? '1 day' : plural(quote.nights, 'night')}
                  </b>
                  {hall ? null : <span className="sr"> {fitSpoken(fit)}</span>}
                </>
              )}
            </div>
            {hall || unavailable ? null : (
              <DateRangePopover
                hall={false}
                checkIn={trip.checkIn}
                checkOut={trip.checkOut}
                onChange={(d) => applyTrip({ ...trip, ...d })}
                className="dr"
                placement="above"
              >
                {(dateTrigger) => (
                  <GuestsRoomsPopover
                    hall={false}
                    guests={trip.guests}
                    rooms={trip.rooms}
                    onChange={(v) => applyTrip({ ...trip, ...v })}
                    className="tr"
                    placement="above"
                  >
                    {(partyTrigger) => (
                      <StayFit
                        fit={fit}
                        dates={when}
                        datesSpoken={`${when}, ${plural(quote.nights, 'night')}`}
                        dateTrigger={dateTrigger}
                        partyTrigger={partyTrigger}
                      />
                    )}
                  </GuestsRoomsPopover>
                )}
              </DateRangePopover>
            )}
          </div>
          {unavailable ? (
            <Button onClick={edit.reveal}>{t('Change dates')}</Button>
          ) : !quote.rooms ? (
            <Button onClick={() => scrollToRooms()} disabled={!ready}>
              {hall ? 'Select a hall' : t('Select a room')}
            </Button>
          ) : (
            <Button onClick={reserve}>{t('Reserve')}</Button>
          )}
        </div>
      </div>
    </>
  );
}
