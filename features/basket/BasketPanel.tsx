import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { Accordion } from '@/components/Accordion';
import { AppLink } from '@/components/AppLink';
import { Button, ButtonLink } from '@/components/Button';
import { Chip, Stepper } from '@/components/Controls';
import { Dropdown } from '@/components/Dropdown';
import { Icon } from '@/components/Icon';
import { PropertyImage } from '@/components/PropertyImage';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { availabilityQuery, propertyQuery } from '@/lib/api/queries';
import { isApiError } from '@/lib/api/client';
import { basketTrip, isExpired, isSameStay, linesOf, selOf, stayKey } from '@/lib/basket';
import { useBasket } from '@/lib/basket/useBasket';
import { fmtDay, fmtRange } from '@/lib/dates';
import { formatMoney, guestsUpTo, plural } from '@/lib/money';
import { onIdle } from '@/lib/prefetch';
import { nightsFor, serviceFee } from '@/lib/pricing';
import { CHECKOUT_HREF, propertyHref } from '@/lib/tripState';
import type { BasketLine, BasketStay, Property, RoomType } from '@/types';
import './basket.css';
import { t } from '@/lib/i18n';

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
  /** The header button, so pressing it again toggles instead of counting as an outside press. */
  trigger: RefObject<HTMLButtonElement | null>;
}

/** The basket dropdown (docs/05 BasketPanel): the shared `Dropdown` holding the basket's content. */
export function BasketPanel({ id, open, onClose, trigger }: Props) {
  // The body is rendered ahead, once the browser is idle (its property and price queries run then too), so the tap
  // itself does no work and nothing changes under the panel while it fades in. Under Data Saver nothing is done ahead and
  // it renders on the first open.
  const [bodyMounted, setBodyMounted] = useState(false);
  useEffect(() => onIdle(() => setBodyMounted(true)), []);
  if (open && !bodyMounted) setBodyMounted(true);

  return (
    <Dropdown
      id={id}
      open={open}
      onClose={onClose}
      trigger={trigger}
      title={t('Your basket')}
      closeLabel={t('Close basket')}
    >
      {bodyMounted ? <BasketBody open={open} /> : null}
    </Dropdown>
  );
}

function BasketBody({ open }: { open: boolean }) {
  const { basket, loading } = useBasket();
  // Emptying the basket collapses the filled body (kept on its last content) while the empty note opens.
  const [last, setLast] = useState(basket);
  if (basket && basket.updatedAt !== last?.updatedAt) setLast(basket); // by stamp: a device basket is re-parsed on every read
  if (loading) return <BodySkeleton />;
  const shown = basket ?? last;
  return (
    <>
      {shown ? (
        <Accordion id="bskt-filled" open={!!basket} padded={false}>
          <Filled stays={shown.stays} open={open} />
        </Accordion>
      ) : null}
      <Accordion id="bskt-empty" open={!basket} padded={false}>
        <Empty />
      </Accordion>
    </>
  );
}

/** Shaped like the filled basket (stay header, one room, totals, Checkout) and sized to it within a pixel, so a cold open
 *  doesn't change height when the data arrives. */
function BodySkeleton() {
  return (
    <div className="bskt-body" aria-busy="true">
      <div className="bskt-stay">
        <Skeleton width="62%" height={24} />
        <Skeleton width="45%" height={16} />
        <Skeleton width="50%" height={20} style={{ marginTop: 4 }} />
        <Skeleton width="40%" height={20} />
      </div>
      <div className="bskt-lines">
        <div className="bskt-line">
          <Skeleton className="bskt-thumb" />
          <div className="bskt-line-main">
            <Skeleton width="70%" height={22} />
            <Skeleton width="60%" height={17} />
            <Skeleton width="50%" height={17} />
          </div>
          <div className="bskt-line-side">
            <Skeleton width={48} height={24} />
            <Skeleton width={56} height={17} />
            <Skeleton width={106} height={36} radius={12} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>
      <div className="bskt-sum">
        {[0, 1, 2].map((i) => (
          <div className="kv" key={i}>
            <Skeleton width="38%" height={22} />
            <Skeleton width={56} height={22} />
          </div>
        ))}
      </div>
      <Skeleton height={46} radius={12} style={{ marginTop: 8 }} />
    </div>
  );
}

function Empty() {
  return (
    <div className="bskt-body bskt-empty">
      <span className="bskt-empty-ico">
        <Icon name="basket" />
      </span>
      <b>{t('Your basket is empty')}</b>
      <p className="muted small">{t('Add a room to see it visible here.')}</p>
    </div>
  );
}

/** A basket line with its live room, stock and price (what one row shows). */
type BasketRow = BasketLine & {
  room: RoomType | undefined;
  left: number | null;
  nightly: number;
  total: number;
  ok: boolean;
};

/** What one stay adds to the basket's total, reported up by its section once prices are known. */
interface Sum {
  subtotal: number;
  problems: number;
  pending: boolean;
}
const sameSum = (a: Sum | undefined, b: Sum) =>
  !!a && a.subtotal === b.subtotal && a.problems === b.problems && a.pending === b.pending;

/**
 * The basket: one section per stay (its own hotel, dates, rooms and prices), then one total and one Checkout for all
 * of them (docs/05 BasketPanel). A stay removed collapses away; the rest are untouched.
 */
function Filled({ stays, open }: { stays: BasketStay[]; open: boolean }) {
  const [sums, setSums] = useState<Record<string, Sum>>({});
  const [leaving, setLeaving] = useState<{ at: number; stay: BasketStay }[]>([]);
  const report = useCallback(
    (key: string, sum: Sum) => setSums((all) => (sameSum(all[key], sum) ? all : { ...all, [key]: sum })),
    [],
  );

  // Collapsing stays go back into the slot they left; one that was added back meanwhile is simply a live stay again.
  const rows = leaving
    .filter((g) => !stays.some((s) => isSameStay(s, g.stay)))
    .sort((a, b) => a.at - b.at)
    .reduce(
      (acc, g) => {
        acc.splice(Math.min(g.at, acc.length), 0, { stay: g.stay, live: false });
        return acc;
      },
      stays.map((stay) => ({ stay, live: true })),
    );

  const bookable = stays.filter((s) => !isExpired(s));
  const mine = bookable.map((s) => sums[stayKey(s)]);
  const waiting = mine.some((m) => !m || m.pending);
  const problems = mine.reduce((n, m) => n + (m?.problems ?? 0), 0);
  const subtotal = mine.reduce((n, m) => n + (m?.subtotal ?? 0), 0);
  const fee = mine.reduce((n, m) => n + serviceFee(m?.subtotal ?? 0), 0);
  const skipped = stays.length - bookable.length;
  const only = bookable.length === 1 ? bookable[0]! : null;
  const subtotalLabel = only
    ? `Subtotal · ${only.type === 'hall' ? '1 day' : plural(nightsFor(basketTrip(only)), 'night')}`
    : `Subtotal · ${plural(bookable.length, 'stay')}`;

  return (
    <div className="bskt-body">
      {rows.map(({ stay, live }, at) => (
        <StayGroup
          key={stayKey(stay)}
          stay={stay}
          open={open}
          live={live}
          flat={stays.length === 1}
          onSum={report}
          onGone={() => setLeaving((g) => [...g.filter((x) => !isSameStay(x.stay, stay)), { at, stay }])}
          onClosed={() => setLeaving((g) => g.filter((x) => !isSameStay(x.stay, stay)))}
        />
      ))}

      {bookable.length ? (
        <>
          <dl className="bskt-sum" aria-busy={waiting}>
            <div className="kv">
              <dt>{subtotalLabel}</dt>
              <dd>{waiting ? <Skeleton width={60} height={22} /> : formatMoney(subtotal)}</dd>
            </div>
            {fee ? (
              <div className="kv">
                <dt>{t('Service fee')}</dt>
                <dd>{waiting ? <Skeleton width={50} height={22} /> : formatMoney(fee)}</dd>
              </div>
            ) : null}
            <div className="kv bskt-total">
              <dt>{t('Total')}</dt>
              <dd>{waiting ? <Skeleton width={70} height={22} /> : formatMoney(subtotal + fee)}</dd>
            </div>
          </dl>

          {problems ? (
            <p className="bskt-note" role="status">
              {problems === 1
                ? t('A room in your basket is no longer available. Change it to continue.')
                : t('Some rooms in your basket are no longer available. Change them to continue.')}
            </p>
          ) : null}
          {skipped ? (
            <p className="bskt-note" role="status">
              {t('{count} with dates that have passed won’t be included.', { count: plural(skipped, 'stay') })}
            </p>
          ) : null}

          {problems || waiting ? (
            <Button block disabled>
              {t('Checkout')}
            </Button>
          ) : (
            <ButtonLink block to={CHECKOUT_HREF}>
              Checkout · {formatMoney(subtotal + fee)}
            </ButtonLink>
          )}
        </>
      ) : null}
    </div>
  );
}

/** One stay's section: its header, rooms and subtotal. It owns its own property and price queries. */
function StayGroup({
  stay,
  open,
  live,
  flat,
  onSum,
  onGone,
  onClosed,
}: {
  stay: BasketStay;
  open: boolean;
  /** False while the stay collapses away after being removed. */
  live: boolean;
  /** The only stay in the basket: shown plain, without a card. */
  flat: boolean;
  onSum: (key: string, sum: Sum) => void;
  onGone: () => void;
  onClosed: () => void;
}) {
  const { set } = useBasket();
  const [leaving, setLeaving] = useState<{ at: number; line: BasketRow }[]>([]);
  const property = useQuery(propertyQuery(stay.propertyId));
  const p = property.data;
  const trip = basketTrip(stay, p?.city);
  const expired = isExpired(stay);
  const avail = useQuery({ ...availabilityQuery(stay.propertyId, trip), enabled: !!p && !expired });
  // The body stays mounted while closed, so prices that have aged are refreshed (in place, no skeleton) as it opens.
  const { data, dataUpdatedAt, refetch } = avail;
  useEffect(() => {
    if (open && data && Date.now() - dataUpdatedAt > 30_000) void refetch();
  }, [open, data, dataUpdatedAt, refetch]);
  const hall = stay.type === 'hall';
  const gone = property.isError && isApiError(property.error) && property.error.status === 404;

  // Live price and stock per room. Nothing here is trusted for payment: checkout asks the server for a fresh quote.
  const nights = nightsFor(trip);
  const lines: BasketRow[] = p
    ? stay.lines.map((l) => {
        const room = p.roomTypes.find((r) => r.id === l.roomTypeId);
        const offer = avail.data?.roomTypes.find((r) => r.roomTypeId === l.roomTypeId);
        const left = avail.data ? (offer?.available ?? 0) : null;
        const nightly = offer?.nightlyPrice.amount ?? room?.nightlyPrice.amount ?? 0;
        return {
          ...l,
          room,
          left,
          nightly,
          total: nightly * l.qty * nights,
          ok: !!room && (left === null || l.qty <= left),
        };
      })
    : [];
  const problems = lines.filter((l) => !l.ok).length;
  const subtotal = lines.filter((l) => l.ok).reduce((a, l) => a + l.total, 0);
  const pending = !expired && !gone && !property.isError && (!p || avail.isPending);
  const key = stayKey(stay);
  const problemCount = problems + (gone || property.isError || avail.isError ? 1 : 0);
  useEffect(() => {
    if (live) onSum(key, { subtotal, problems: problemCount, pending });
  });

  const setQty = (roomTypeId: string, qty: number) => {
    const next = linesOf({ ...selOf(stay.lines), [roomTypeId]: hall ? Math.min(qty, 1) : qty });
    set(stay, next);
    if (!next.length) onGone(); // the last room: the whole stay collapses away
    // A removed room is saved at once but its row stays, collapsing, until the animation ends.
    if (qty > 0) return;
    const at = lines.findIndex((l) => l.roomTypeId === roomTypeId);
    if (at >= 0) setLeaving((g) => [...g.filter((x) => x.line.roomTypeId !== roomTypeId), { at, line: lines[at]! }]);
  };
  // Collapsing rows go back into the slot they left; one that was re-added meanwhile is simply a live row again.
  const rows = leaving
    .filter((g) => !lines.some((l) => l.roomTypeId === g.line.roomTypeId))
    .sort((a, b) => a.at - b.at)
    .reduce(
      (acc, g) => {
        acc.splice(Math.min(g.at, acc.length), 0, { line: g.line, open: false });
        return acc;
      },
      lines.map((line) => ({ line, open: true })),
    );

  let body;
  if (gone) {
    body = (
      <p className="bskt-note">
        <b>{t('This property is no longer on AVORA.')}</b> {t('It can’t be booked.')}
      </p>
    );
  } else if (property.isError) {
    body = <QueryError error={property.error} onRetry={() => void property.refetch()} />;
  } else if (!p) {
    body = <Skeleton height={88} radius={8} />;
  } else if (expired) {
    body = (
      <>
        <p className="bskt-note">
          <b>{t('Your dates have passed.')}</b> {t('Choose new dates to book {name}.', { name: p.name })}
        </p>
        <ButtonLink block to={`/stays/${encodeURIComponent(p.id)}#rooms`}>
          {t('Choose new dates')}
        </ButtonLink>
      </>
    );
  } else {
    body = (
      <>
        <ul className="bskt-lines" aria-label={hall ? t('Hall') : t('Rooms')}>
          {rows.map(({ line: l, open: on }) => (
            <li key={l.roomTypeId}>
              <Accordion
                id={`bskt-line-${key}-${l.roomTypeId}`}
                open={on}
                padded={false}
                onClosed={() => setLeaving((g) => g.filter((x) => x.line.roomTypeId !== l.roomTypeId))}
              >
                <div className={['bskt-line', !l.ok && 'bad'].filter(Boolean).join(' ')}>
                  <PropertyImage
                    className="bskt-thumb"
                    type={p.type}
                    hue={p.hue}
                    image={l.room?.image}
                    sizes="88px"
                    index={(l.room ? p.roomTypes.indexOf(l.room) : 0) + 2}
                  />
                  <div className="bskt-line-main">
                    <b>{l.room?.name ?? t('Room no longer offered')}</b>
                    {l.room ? (
                      <>
                        {hall ? null : <span className="muted small">{guestsUpTo(l.room.maxGuests)}</span>}
                        <span className="muted small">{l.room.beds}</span>
                      </>
                    ) : null}
                    {!l.room || l.left === 0 ? (
                      <Chip tone="warn">{l.room ? t('Sold out for your dates') : t('Not available')}</Chip>
                    ) : l.left !== null && l.qty > l.left ? (
                      <Chip tone="warn">{t('Only {n} left', { n: l.left })}</Chip>
                    ) : null}
                  </div>
                  <div className="bskt-line-side">
                    {avail.isPending ? (
                      <>
                        <Skeleton width={48} height={24} />
                        <Skeleton width={56} height={17} />
                      </>
                    ) : (
                      <>
                        <b className={l.ok ? undefined : 'muted'}>{formatMoney(l.total)}</b>
                        <span className="muted small">
                          {formatMoney(l.nightly)} / {hall ? 'day' : 'night'}
                          {l.qty > 1 ? ' each' : ''}
                        </span>
                      </>
                    )}
                    {l.room && l.left !== 0 ? (
                      <Stepper
                        className="sm"
                        value={l.qty}
                        min={0}
                        max={hall ? 1 : Math.max(l.qty, l.left ?? l.qty)}
                        onChange={(n) => setQty(l.roomTypeId, l.left !== null && n > l.qty ? Math.min(n, l.left) : n)}
                        label={t('{name} quantity', { name: l.room.name })}
                        decLabel={t('Remove one {name}', { name: l.room.name })}
                        incLabel={t('Add one {name}', { name: l.room.name })}
                      />
                    ) : (
                      <button type="button" className="linkbtn" onClick={() => setQty(l.roomTypeId, 0)}>
                        {t('Remove')}
                      </button>
                    )}
                  </div>
                </div>
              </Accordion>
            </li>
          ))}
        </ul>
        {avail.isError ? (
          <QueryError
            error={avail.error}
            onRetry={() => void avail.refetch()}
            title={t('We couldn’t check prices for your dates.')}
          />
        ) : (
          <div className="kv bskt-stay-sub">
            <span className="muted">Subtotal · {hall ? '1 day' : plural(nights, 'night')}</span>
            <b>{avail.isPending ? <Skeleton width={60} height={20} /> : formatMoney(subtotal)}</b>
          </div>
        )}
      </>
    );
  }

  return (
    <Accordion id={`bskt-stay-${key}`} open={live} padded={false} onClosed={onClosed}>
      <section className={flat ? 'bskt-group flat' : 'bskt-group'} aria-label={p?.name ?? t('Stay')}>
        <StayHead stay={stay} property={p} nights={nights} href={p ? propertyHref(p.id, trip) + '#rooms' : '#'} />
        {body}
      </section>
    </Accordion>
  );
}

/** The stay once, at the top of its section: the hotel (a link back to its rooms), then the dates and the party.
 *  Everything below it is a room. Rooms don't repeat the dates or guests. */
function StayHead({
  stay,
  property: p,
  nights,
  href,
}: {
  stay: BasketStay;
  property: Property | undefined;
  nights: number;
  href: string;
}) {
  const hall = stay.type === 'hall';
  return (
    <div className="bskt-stay">
      {p ? (
        <AppLink className="bskt-stay-name" to={href}>
          {p.name}
          <Icon name="chev" aria-hidden="true" />
        </AppLink>
      ) : (
        <Skeleton width="62%" height={24} />
      )}
      {p ? (
        <span className="muted small">
          {p.area}, {p.city}
        </span>
      ) : null}
      <span className="ico bskt-fact">
        <Icon name="cal" />
        {hall ? fmtDay(stay.checkIn) : `${fmtRange(stay.checkIn, stay.checkOut)} · ${plural(nights, 'night')}`}
      </span>
      <span className="ico bskt-fact">
        <Icon name="user" />
        {hall ? plural(stay.guests, 'guest') : `${plural(stay.guests, 'guest')} · ${plural(stay.rooms, 'room')}`}
      </span>
    </div>
  );
}
