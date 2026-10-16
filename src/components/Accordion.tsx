import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { afterTransition } from '@/lib/motion/presence';
import './Accordion.css';

/** Accordion state + trigger props (docs/05 Accordion). `reveal()` opens it and scrolls the panel into view once the
 *  height animation has finished, used by "Change dates" links far from the panel. */
export function useAccordion(initial = false) {
  const id = useId();
  const [open, setOpen] = useState(initial);
  const [revealTick, setRevealTick] = useState(0);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const reveal = useCallback(() => {
    setOpen(true);
    setRevealTick((t) => t + 1);
  }, []);
  return {
    open,
    setOpen,
    toggle,
    reveal,
    triggerProps: { 'aria-expanded': open, 'aria-controls': id, onClick: toggle } as const,
    panelProps: { id, open, revealTick },
  };
}

interface AccordionProps {
  id: string;
  open: boolean;
  revealTick?: number;
  /** Default panel padding (.acc-pad). Off when the content brings its own. */
  padded?: boolean;
  className?: string;
  /** Called once the close animation has finished, so a row that is being removed can unmount. */
  onClosed?: () => void;
  children: ReactNode;
}

/**
 * The panel animates its height through grid-template-rows. Overflow turns visible once the open transition settles so
 * popovers inside (calendar, guests) can escape; it is clipped again the moment the panel starts to close.
 */
export function Accordion({ id, open, revealTick = 0, padded = true, className, onClosed, children }: AccordionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  if (!open && settled) setSettled(false); // clip again the moment it starts to close
  const closed = useRef(onClosed);
  useEffect(() => {
    closed.current = onClosed;
  });

  useEffect(() => {
    const el = ref.current;
    if (open || !el || !closed.current) return;
    return afterTransition(el, () => closed.current?.());
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    return afterTransition(el, () => setSettled(true));
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!revealTick || !el) return;
    return afterTransition(el, () => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }, [revealTick]);

  return (
    <div
      ref={ref}
      id={id}
      className={['acc', open && 'open', open && settled && 'settled', className].filter(Boolean).join(' ')}
      inert={!open}
    >
      <div className="acc-in">{padded ? <div className="acc-pad">{children}</div> : children}</div>
    </div>
  );
}
