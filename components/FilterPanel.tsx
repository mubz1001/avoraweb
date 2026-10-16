import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Icon } from './Icon';
import { useEscape, useIsMobile, useReturnFocus } from '@/lib/motion/presence';
import './FilterPanel.css';
import { t } from '@/lib/i18n';

interface Props {
  label: string;
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  /** "Show 4 stays": the sheet footer button on mobile. */
  applyLabel: string;
  children: ReactNode;
}

/**
 * Filters: a sticky sidebar from 768px, a bottom sheet behind a "Filters (n)" button below it (docs/05 FiltersPanel).
 * Filters apply live; the sheet's footer button only closes it. Esc and the backdrop close it too, and focus returns
 * to the button that opened it.
 */
export function FilterPanel({ label, open, onClose, onClear, applyLabel, children }: Props) {
  const mobile = useIsMobile();
  const sheetOpen = open && mobile;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(sheetOpen, onClose);
  useReturnFocus(sheetOpen);
  useEffect(() => {
    if (sheetOpen) closeRef.current?.focus({ preventScroll: true });
  }, [sheetOpen]);

  return (
    <>
      <aside
        className={['filters-panel', sheetOpen && 'open'].filter(Boolean).join(' ')}
        aria-label={label}
        {...(mobile ? { role: 'dialog', 'aria-modal': sheetOpen, inert: !sheetOpen } : {})}
      >
        <div className="fp-h">
          <h2>{t('Filters')}</h2>
          <div className="row">
            <Button variant="ghost" size="sm" onClick={onClear}>
              {t('Clear all')}
            </Button>
            <button
              ref={closeRef}
              type="button"
              className="icon-btn close-x"
              aria-label={t('Close filters')}
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="fbody">{children}</div>
        <div className="sheet-foot">
          <Button block onClick={onClose}>
            {applyLabel}
          </Button>
        </div>
      </aside>
      {createPortal(
        <div className={['bk', sheetOpen && 'open'].filter(Boolean).join(' ')} onClick={onClose} aria-hidden="true" />,
        document.body,
      )}
    </>
  );
}

/** A titled group inside the panel. */
export function FilterGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="fgroup">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
