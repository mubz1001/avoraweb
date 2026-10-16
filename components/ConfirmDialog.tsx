import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import './ConfirmDialog.css';
import { t } from '@/lib/i18n';

/** Keeps a native <dialog> in step with a parent-owned `open` flag. */
export function useModalDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean) {
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [ref, open]);
}

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Without it the dialog has no cancel button: a close X in its corner dismisses it instead. */
  cancelLabel?: string;
  /** A second way forward (ghost button under the confirm one). */
  altLabel?: string;
  onAlt?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A yes/no question that needs an answer before going on (docs/05 ConfirmDialog). A native modal <dialog>: the browser
 * traps focus, makes the page inert and closes it on Esc. A press on the dimmed backdrop cancels. Focus starts on the
 * safe choice (cancel, or the close X when there is no cancel button), and returns to the control that opened it.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  altLabel,
  onAlt,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useModalDialog(ref, open);
  useEffect(() => {
    if (open) (cancelRef.current ?? closeRef.current)?.focus(); // after the dialog opened (effects run in order)
  }, [open]);

  return (
    // Esc is the keyboard twin of the backdrop press (the native `cancel` event below).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="cdlg"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // the parent owns `open`
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel(); // the backdrop is the dialog element itself
      }}
    >
      <div className="cdlg-in">
        {cancelLabel ? null : (
          <button ref={closeRef} type="button" className="icon-btn cdlg-x" aria-label={t('Close')} onClick={onCancel}>
            <Icon name="close" />
          </button>
        )}
        <h2 id={titleId}>{title}</h2>
        <div className="cdlg-body">{children}</div>
        <div className="cdlg-actions">
          <Button onClick={onConfirm}>{confirmLabel}</Button>
          {altLabel ? (
            <Button variant="ghost" onClick={onAlt}>
              {altLabel}
            </Button>
          ) : null}
          {cancelLabel ? (
            <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
