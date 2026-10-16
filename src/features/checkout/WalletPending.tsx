import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';
import { errorMessage } from '@/components/forms';
import { useToast } from '@/components/Toast';
import { isApiError } from '@/lib/api/client';
import { checkoutApi } from '@/lib/api/endpoints';
import type { CreatedOrder } from '@/lib/api/schemas';
import { formatMoney } from '@/lib/money';
import type { Quote } from '@/types';

/** Statuses that mean the money was taken; what each booking came to is for the order page to say. */
const PAID = ['confirmed', 'partially_confirmed', 'failed'];
import './wallet-pending.css';
import { t } from '@/lib/i18n';

const POLL_MS = 3000;
const HINT_AFTER_MS = 30e3;
/** The success tick plays this long before the confirmation page opens. */
const SUCCESS_MS = 1100;

interface Props {
  order: CreatedOrder;
  amount: Quote['total'];
  onConfirmed: () => void;
  onFailed: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Full-screen wait for a mobile-wallet approval (docs/05 WalletPending, docs/06 §4.3). It shows only the real state:
 * pending until the status endpoint says the order is paid or `payment_failed`. A started payment, a timeout, or a network
 * error never reads as success. A native modal <dialog> gives focus trapping and Esc; Esc is "Use another method".
 */
export function WalletPending({ order, amount, onConfirmed, onFailed, onCancel }: Props) {
  const toast = useToast();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const fired = useRef(false);
  const [started] = useState(() => Date.now());
  const [expires] = useState(() =>
    order.paymentPrompt ? new Date(order.paymentPrompt.expiresAt).getTime() : started + 90e3,
  );
  const [now, setNow] = useState(started);
  const [resending, setResending] = useState(false);

  const latest = useRef({ onConfirmed, onFailed, onCancel });
  useLayoutEffect(() => {
    latest.current = { onConfirmed, onFailed, onCancel };
  });

  const status = useQuery({
    queryKey: ['payment-status', order.id],
    queryFn: ({ signal }) => checkoutApi.paymentStatus(order.id, order.paymentToken, signal),
    // Keep checking until a terminal status; a failed poll (offline, 5xx) just tries again next tick.
    refetchInterval: (q) => (!q.state.data || q.state.data.status === 'pending_payment' ? POLL_MS : false),
    refetchIntervalInBackground: true, // the user is in their wallet app
    refetchOnWindowFocus: 'always', // ...and checks at once when they come back
    refetchOnReconnect: 'always',
    gcTime: 0,
  });
  const s = status.data?.status;
  const confirmed = !!s && PAID.includes(s);
  // Only the server decides a payment failed (a decline, or `TIMEOUT` once the prompt expired); a clock here never does.
  const failure = s === 'payment_failed' ? (status.data?.reason ?? 'USER_DECLINED') : null;

  // The modal dialog: scroll lock, focus the heading, Esc = use another method.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (!d.open) d.showModal();
    heading.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (d.open) d.close();
    };
  }, []);

  // Clock for the countdown and the long-wait hint.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!failure || fired.current) return;
    fired.current = true;
    latest.current.onFailed(failure);
  }, [failure]);

  // Success: play the tick, then go to the confirmation. Only ever reached from a polled `confirmed`.
  useEffect(() => {
    if (!confirmed) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => latest.current.onConfirmed(), still ? 0 : SUCCESS_MS);
    return () => clearTimeout(t);
  }, [confirmed]);

  async function resend() {
    if (resending) return;
    setResending(true);
    try {
      await checkoutApi.resendPrompt(order.id, order.paymentToken);
      toast('We sent a new request');
    } catch (e) {
      toast(
        isApiError(e) && e.retryAfter
          ? t('Please wait {s}s before asking again.', { s: e.retryAfter })
          : errorMessage(e),
      );
    } finally {
      setResending(false);
    }
  }

  const left = Math.max(0, Math.round((expires - now) / 1000));
  const brand = order.payment.brand ?? 'your wallet';
  const money = formatMoney(amount);
  const longWait = !confirmed && now - started >= HINT_AFTER_MS;
  const expired = !confirmed && now >= expires;
  const offline = status.isError && !status.data;

  return createPortal(
    // The native `cancel` event (Esc) is the keyboard twin of the close button; the parent owns what happens next.
    <dialog
      ref={dialog}
      className={['wp', confirmed && 'is-done'].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!confirmed) onCancel();
      }}
    >
      <div className="wp-in">
        <button
          type="button"
          className="wp-close"
          onClick={onCancel}
          disabled={confirmed}
          aria-label={t('Use another method')}
        >
          <Icon name="close" />
        </button>

        <div className="wp-art" aria-hidden="true">
          <i className="wp-ring" />
          <i className="wp-ring" />
          <i className="wp-ring" />
          <div className="wp-float">
            <div className="wp-phone">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                <path d="M10.5 5.5h3" />
                <path d="M11 18.5h2" />
              </svg>
            </div>
            <span className="wp-brand">{order.payment.brand ?? t('Wallet')}</span>
          </div>
          <span className="wp-ok">
            <svg
              viewBox="0 0 24 24"
              width="44"
              height="44"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7" pathLength="1" />
            </svg>
          </span>
        </div>

        <h2 id={titleId} ref={heading} tabIndex={-1} className="wp-title">
          {confirmed ? t('Payment approved') : t('Waiting for your payment')}
        </h2>
        <p className="wp-sub">
          {confirmed
            ? t('Taking you to your confirmation…')
            : t("We've sent the request to your wallet for you to approve.")}
        </p>

        <dl className="wp-facts">
          <div>
            <dt>{t('Amount')}</dt>
            <dd>{money}</dd>
          </div>
          <div>
            <dt>{brand}</dt>
            <dd>{order.payment.payPhoneMasked ?? t('Your phone')}</dd>
          </div>
          <div>
            <dt>{order.bookings.length === 1 ? t('Booking') : t('Bookings')}</dt>
            <dd>{order.bookings.length === 1 ? order.bookings[0]!.ref : order.bookings.length}</dd>
          </div>
        </dl>

        <div className="wp-status" role="status" aria-live="polite">
          {confirmed ? null : (
            <>
              {offline || longWait || expired ? (
                <p>
                  {offline
                    ? t('Having trouble reaching AVORA. We’ll keep trying.')
                    : expired
                      ? t(
                          'This request has run out of time. We’re checking with {brand} for the final result; you can also send a new request.',
                          { brand },
                        )
                      : t('Still waiting? Check your {brand} app, or send the request again.', { brand })}
                </p>
              ) : null}
              <span className="wp-count" aria-label={t('{n} seconds left to approve', { n: left })}>
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </span>
            </>
          )}
        </div>

        {confirmed ? null : (
          <div className="wp-actions">
            <button type="button" className="wp-btn" onClick={() => void resend()} disabled={resending}>
              {resending ? t('Sending…') : t('Resend request')}
            </button>
            <button type="button" className="wp-btn ghost" onClick={onCancel}>
              {t('Use another method')}
            </button>
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
