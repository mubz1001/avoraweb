import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { Stepper } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { config } from '@/lib/config';
import { plural } from '@/lib/money';
import {
  useEscape,
  useExclusive,
  useIsMobile,
  useOutsidePress,
  usePresence,
  useReturnFocus,
} from '@/lib/motion/presence';
import { t } from '@/lib/i18n';

interface Party {
  hall: boolean;
  guests: number;
  rooms: number;
  onChange: (v: { guests: number; rooms: number }) => void;
}

/** What a trigger needs to open the panel and announce it. */
export interface PopoverTrigger {
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  onClick: () => void;
}

const { hotelGuestsMax, roomsMax, hallGuestsMin, hallGuestsMax } = config.limits;

/**
 * The guests & rooms panel with steppers, around any trigger (docs/05 GuestsRoomsPicker). Hotels: guests 1–8, rooms
 * 1–5 and never more than guests. Halls: guests 50–500 in steps of 50, no rooms. A bottom sheet on mobile, a popover
 * otherwise (`placement="above"` when the trigger sits at the bottom of the screen). Changes apply immediately.
 */
export function GuestsRoomsPopover({
  hall,
  guests,
  rooms,
  onChange,
  className,
  placement = 'below',
  children,
}: Party & {
  className?: string;
  placement?: 'below' | 'above';
  children: (trigger: PopoverTrigger) => ReactNode;
}) {
  const mobile = useIsMobile();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { ref: popRef, mounted, shown } = usePresence<HTMLDivElement>(open);
  const close = () => setOpen(false);
  useExclusive(open, close);
  useEscape(open, close);
  useOutsidePress(open, [boxRef, popRef], close);
  useReturnFocus(open);

  const lim = hall ? { min: hallGuestsMin, max: hallGuestsMax, step: 50 } : { min: 1, max: hotelGuestsMax, step: 1 };
  const setGuests = (g: number) => onChange({ guests: g, rooms: hall ? 1 : Math.min(rooms, g) });
  const title = hall ? t('Guests') : t('Guests & rooms');

  const popover = mounted ? (
    <div
      ref={popRef}
      className={['trp', placement === 'above' && 'up', mobile && 'mob', shown && 'show'].filter(Boolean).join(' ')}
      role="dialog"
      aria-label={hall ? t('Guests') : t('Guests and rooms')}
    >
      <div className="cal-top">
        <b>{title}</b>
        <button type="button" className="icon-btn" aria-label={t('Close')} onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="trbody">
        <div className="trrow">
          <div>
            <b>{t('Guests')}</b>
            {hall ? <div className="muted small">{t('Expected attendance')}</div> : null}
          </div>
          <Stepper
            value={guests}
            min={lim.min}
            max={lim.max}
            step={lim.step}
            onChange={setGuests}
            label={t('Guests')}
            decLabel={t('Fewer guests')}
            incLabel={t('More guests')}
          />
        </div>
        {hall ? null : (
          <div className="trrow">
            <div>
              <b>{t('Rooms')}</b>
            </div>
            <Stepper
              value={rooms}
              min={1}
              max={Math.min(roomsMax, guests)}
              onChange={(r) => onChange({ guests, rooms: r })}
              label={t('Rooms')}
              decLabel={t('Fewer rooms')}
              incLabel={t('More rooms')}
            />
          </div>
        )}
      </div>
      <Button size={mobile ? 'md' : 'sm'} block className="trp-done" onClick={close}>
        {t('Done')}
      </Button>
    </div>
  ) : null;

  return (
    <div className={className} ref={boxRef}>
      {children({ 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => setOpen((o) => !o) })}
      {mobile && mounted
        ? createPortal(
            <>
              <div
                className={['cal-bk', shown && 'show'].filter(Boolean).join(' ')}
                onClick={close}
                aria-hidden="true"
              />
              {popover}
            </>,
            document.body,
          )
        : popover}
    </div>
  );
}

/** The search form's guests & rooms field. */
export function GuestsRoomsPicker(props: Party) {
  const labelId = useId();
  const { hall, guests, rooms } = props;
  const title = hall ? t('Guests') : t('Guests & rooms');
  return (
    <GuestsRoomsPopover {...props} className="field tr">
      {(trigger) => (
        <>
          <span className="lbl" id={labelId}>
            {title}
          </span>
          <button type="button" className="inp pick tr-btn" aria-labelledby={labelId} {...trigger}>
            <span className="fic">
              <Icon name="user" />
            </span>
            <span className="tr-txt">
              {hall ? plural(guests, 'guest') : `${plural(guests, 'guest')} · ${plural(rooms, 'room')}`}
            </span>
          </button>
        </>
      )}
    </GuestsRoomsPopover>
  );
}
