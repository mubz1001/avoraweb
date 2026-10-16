import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Icon } from './Icon';
import { afterTransition, useEscape, useExclusive, useOutsidePress } from '@/lib/motion/presence';
import './Dropdown.css';

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
  /** The header button that opens it, so pressing it again toggles instead of counting as an outside press. */
  trigger: RefObject<HTMLButtonElement | null>;
  title: string;
  /** Accessible name of the ✕ button. */
  closeLabel: string;
  /** Card width in px from 768px; phones always span the width. */
  width?: number;
  children: ReactNode;
}

/**
 * A card that drops from a header button (docs/05 Dropdown): it scales and fades in from its top-right corner, plays the
 * same motion back on close, and floats on a shadow (the page is not dimmed). It hangs under its button (right edges lined
 * up) from 768px. Always mounted and `inert` while closed. Closes on the button, ✕, Esc, a press anywhere outside, or
 * when another popover opens (the caller closes it on navigation). Used by the basket and the account menu.
 */
export function Dropdown({ id, open, onClose, trigger, title, closeLabel, width = 400, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEscape(open, onClose);
  useExclusive(open, onClose);
  useOutsidePress(open, [panelRef, trigger], onClose);

  // Focus moves in once the fade has settled (not during its first frames), and back to the header button on close
  // if it was inside (Safari never focuses a clicked button, so "whatever had focus before" is not enough).
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    // Line the card's right edge up with its button; phones ignore this and span the width.
    const r = trigger.current?.getBoundingClientRect();
    if (el && r) el.style.setProperty('--dd-right', `${Math.round(document.documentElement.clientWidth - r.right)}px`);
    const cancel = el ? afterTransition(el, () => headRef.current?.focus({ preventScroll: true })) : () => {};
    const btn = trigger.current;
    return () => {
      cancel();
      const a = document.activeElement;
      if (!a || a === document.body || el?.contains(a)) btn?.focus({ preventScroll: true });
    };
  }, [open, trigger]);

  return (
    <>
      <div
        ref={panelRef}
        id={id}
        className={['dd-pop', open && 'open'].filter(Boolean).join(' ')}
        style={{ '--dd-w': `${width}px` } as CSSProperties}
        role="dialog"
        aria-labelledby={`${id}-title`}
        inert={!open}
      >
        <div className="dd-scroll">
          <div className="dd-top">
            <h2 id={`${id}-title`} ref={headRef} tabIndex={-1}>
              {title}
            </h2>
            <button type="button" className="icon-btn" aria-label={closeLabel} onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
