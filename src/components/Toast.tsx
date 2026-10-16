import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import './Toast.css';

/** An optional undo-style action. A toast with one stays longer, so there is time to reach it. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}
type Show = (msg: string, action?: ToastAction) => void;

/** One short status message at a time (role=status). Lives above the router so a toast survives navigation. */
const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; msg: string; action?: ToastAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback<Show>((msg, action) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), msg, action });
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 2200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div key={toast.id} className={['toast', toast.action && 'has-action'].filter(Boolean).join(' ')} role="status">
          {toast.msg}
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                clearTimeout(timer.current);
                setToast(null);
                toast.action!.onClick();
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
