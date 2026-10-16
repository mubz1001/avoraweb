import { useId, useState } from 'react';
import { Accordion } from '@/components/Accordion';
import { AppLink } from '@/components/AppLink';
import { Icon } from '@/components/Icon';
import { PropertyImage } from '@/components/PropertyImage';
import { Skeleton } from '@/components/Skeleton';
import { basketTrip } from '@/lib/basket';
import { fmtDay, fmtRange, nightsBetween } from '@/lib/dates';
import { useMedia } from '@/lib/motion/presence';
import { formatMoney, plural } from '@/lib/money';
import { propertyHref } from '@/lib/tripState';
import type { BasketStay, Property, Quote, StayQuote } from '@/types';
import { t } from '@/lib/i18n';

/** One stay being paid for: what the basket holds, and the property it is at. */
export interface SummaryStay {
  stay: BasketStay;
  property: Property;
}

interface Props {
  stays: SummaryStay[];
  quote: Quote | undefined;
  /** Takes a stay out of this checkout (and the basket). */
  onRemove: (s: BasketStay) => void;
}

/** Order summary: collapsible on phones (total visible in the toggle), always open and sticky from 900px
 *  (docs/05 OrderSummary). One block per stay, each with its own dates, rooms, fee and cancellation terms, then the one
 *  total. Every number comes from the server quote. */
export function OrderSummary({ stays, quote: q, onRemove }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wide = useMedia('(min-width: 900px)'); // always open beside the form
  const many = stays.length > 1;
  const first = stays[0]?.property;
  const whenOf = (s: BasketStay) => (s.type === 'hall' ? fmtDay(s.checkIn) : fmtRange(s.checkIn, s.checkOut));
  return (
    <section className="card sumcard" aria-label={t('Order summary')}>
      <button
        type="button"
        className="sumtoggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          <span className="t">{t('Order summary')}</span>
          <br />
          <span className="muted small">
            {many ? `${plural(stays.length, 'stay')} · ${stays.map((s) => s.property.name).join(', ')}` : null}
            {!many && first ? `${first.name} · ${whenOf(stays[0]!.stay)}` : null}
          </span>
        </span>
        <span className="row">
          <b className="tot-m">{q ? formatMoney(q.total) : ''}</b>
          <span className="chev">
            <Icon name="chev" />
          </span>
        </span>
      </button>
      <Accordion id={id} open={open || wide} padded={false}>
        <div className={['sumbody', many && 'many'].filter(Boolean).join(' ')}>
          {stays.map(({ stay: s, property: p }, i) => (
            <StayBlock
              key={`${p.id}|${s.checkIn}|${s.checkOut}`}
              stay={s}
              property={p}
              quote={q?.stays[i]}
              removable={many}
              onRemove={() => onRemove(s)}
            />
          ))}
          {q ? (
            <>
              <div className="l tot">
                <span>{t('Total')}</span>
                <span>{formatMoney(q.total)}</span>
              </div>
              <p className="sum-note">
                {many
                  ? t('Charged once, now, for {count}.', { count: plural(stays.length, 'booking') })
                  : `You'll be charged ${formatMoney(q.total)} now.`}
              </p>
            </>
          ) : (
            <div aria-busy="true">
              <Skeleton height={16} style={{ margin: '8px 0' }} />
              <Skeleton height={20} width="60%" />
            </div>
          )}
        </div>
      </Accordion>
    </section>
  );
}

/** One stay, in the basket card's order: the hotel (photo, name, area), its dates and party, then its rooms, fee,
 *  subtotal and cancellation terms. Several stays: each is its own card. */
function StayBlock({
  stay: s,
  property: p,
  quote: sq,
  removable,
  onRemove,
}: {
  stay: BasketStay;
  property: Property;
  quote: StayQuote | undefined;
  removable: boolean;
  onRemove: () => void;
}) {
  const hall = p.type === 'hall';
  const nights = nightsBetween(s.checkIn, s.checkOut);
  return (
    <section className="stayblk" aria-label={p.name}>
      <div className="stayblk-head">
        <PropertyImage className="stayblk-ph" type={p.type} hue={p.hue} image={p.images[0]} />
        <div className="stayblk-id">
          <b className="stayblk-name">{p.name}</b>
          <span className="muted small">
            {p.area}, {p.city}
          </span>
        </div>
        <span className="stayblk-acts">
          <AppLink className="stayblk-act" to={propertyHref(p.id, basketTrip(s, p.city)) + '#rooms'}>
            {t('Edit')}
          </AppLink>
          {removable ? (
            <button type="button" className="stayblk-act" onClick={onRemove} aria-label={`Remove ${p.name}`}>
              {t('Remove')}
            </button>
          ) : null}
        </span>
      </div>
      <div className="stayblk-facts">
        <span className="ico bskt-fact">
          <Icon name="cal" />
          {hall ? fmtDay(s.checkIn) : `${fmtRange(s.checkIn, s.checkOut)} · ${plural(nights, 'night')}`}
        </span>
        <span className="ico bskt-fact">
          <Icon name="user" />
          {hall ? plural(s.guests, 'guest') : `${plural(s.guests, 'guest')} · ${plural(s.rooms, 'room')}`}
        </span>
        <span className="stayblk-times">
          {hall
            ? `${t('Starts from')} ${p.checkInFrom}`
            : t('Check-in from {from} · check-out until {until}', { from: p.checkInFrom, until: p.checkOutUntil })}
        </span>
      </div>
      {sq ? (
        <div className="stayblk-money">
          {sq.lines.map((l) => (
            <div className="l stayblk-line" key={l.roomTypeId}>
              <span>
                {l.qty} × {l.name}
                <span className="stayblk-unit">
                  {formatMoney(l.unitPrice)} × {hall ? '1 day' : plural(sq.nights, 'night')}
                </span>
              </span>
              <span>{formatMoney(l.total)}</span>
            </div>
          ))}
          {sq.serviceFee.amount > 0 ? (
            <div className="l stayblk-fee">
              <span>{t('Service fee')} (2%)</span>
              <span>{formatMoney(sq.serviceFee)}</span>
            </div>
          ) : null}
          <div className="l stayblk-sub">
            <span>{t('Subtotal')}</span>
            <span>{formatMoney(sq.total)}</span>
          </div>
          <div className={['stayblk-cancel', sq.freeCancellationUntil ? 'ok' : 'muted'].join(' ')}>
            {sq.freeCancellationUntil ? (
              <>
                <Icon name="check" size={14} />
                Free cancellation until {fmtDay(sq.freeCancellationUntil)}
              </>
            ) : (
              'Non-refundable'
            )}
          </div>
        </div>
      ) : (
        <div aria-busy="true">
          <Skeleton height={16} style={{ margin: '8px 0' }} />
          <Skeleton height={20} width="60%" />
        </div>
      )}
    </section>
  );
}
