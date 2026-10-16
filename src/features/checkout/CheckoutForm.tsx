import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Accordion } from '@/components/Accordion';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';

import { PhoneField, TextField } from '@/components/Field';
import { applyServerErrors, errorMessage, rule, useFormSubmit } from '@/components/forms';
import {
  checkPaymentFields,
  paymentDefaults,
  PaymentOptions,
  pickedMethod,
  type PaymentFields,
} from '@/components/PaymentOptions';
import { useToast } from '@/components/Toast';
import { isApiError } from '@/lib/api/client';
import { checkoutApi, queryKeys, type OrderRequest } from '@/lib/api/endpoints';
import type { CreatedOrder } from '@/lib/api/schemas';
import { formatMoney } from '@/lib/money';
import { tokenizeCard } from '@/lib/payments/hostedFields';
import { phoneFmt, phoneMsgFor, phoneOk, SOMALIA, splitE164, toE164, toE164For } from '@/lib/phone';
import { queryClient } from '@/lib/queryClient';
import { staysBooked } from '@/lib/basket';
import { clearPending, readPending, saveReceipt, savePending } from '@/lib/receipt';
import { WalletPending } from './WalletPending';
import { emailMsg, fullNameMsg, phoneMsg } from '@/lib/validation/rules';
import type { Member, Quote, SavedPaymentMethod } from '@/types';
import { t } from '@/lib/i18n';

const schema = z
  .object({
    name: rule(fullNameMsg),
    cc: z.string(),
    phone: z.string(),
    email: rule(emailMsg),
    altPhone: z.boolean(),
    payphone: z.string(),
    saveMethod: z.boolean(),
    pm: z.string(),
    card: z.string(),
    exp: z.string(),
    cvc: z.string(),
  })
  .superRefine((v, ctx) => {
    checkPaymentFields(v, ctx);
    const phone = phoneMsgFor(v.cc, v.phone);
    if (phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: phone });
    const wallet = !v.pm.startsWith('saved:') && v.pm !== 'card';
    // Wallets are Somali: a contact number from elsewhere can't pay, so the wallet's own number is asked for.
    if (wallet && (v.altPhone || v.cc !== SOMALIA)) {
      const m = phoneMsg(v.payphone);
      if (m) ctx.addIssue({ code: 'custom', path: ['payphone'], message: m });
    }
  });
type Values = z.infer<typeof schema> & PaymentFields;

/** API field keys (docs/06 §4.2) → form fields. */
const FIELD_MAP = {
  'guest.name': 'name',
  'guest.phone': 'phone',
  'guest.email': 'email',
  'payment.payPhone': 'payphone',
  'payment.cardToken': 'card',
};

type Notice =
  | { kind: 'price'; quote: Quote }
  | { kind: 'expired' }
  | { kind: 'unavailable'; stays: number }
  | { kind: 'declined'; message: string }
  | { kind: 'timeout'; order: CreatedOrder }
  | { kind: 'inflight'; order: CreatedOrder }
  | { kind: 'unknown' }
  | { kind: 'signin' }
  | { kind: 'paid'; order: CreatedOrder }
  | { kind: 'error'; message: string };

interface Props {
  /** What is being paid for: one price for every stay in the basket. */
  quote: Quote | undefined;
  quoteLoading: boolean;
  member: Member | null;
  saved: SavedPaymentMethod[];
  defaultMethodId?: string;
  /** Where the guest goes to change their stays. */
  basketHref: string;
  /** Adopt a new server quote (price change accepted). */
  onQuote: (q: Quote) => void;
  onRefreshQuote: () => void;
}

const newKey = () => crypto.randomUUID();
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

export function CheckoutForm({
  quote,
  quoteLoading,
  member,
  saved,
  defaultMethodId,
  basketHref,
  onQuote,
  onRefreshQuote,
}: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    shouldFocusError: false,
    defaultValues: {
      name: member ? `${member.firstName} ${member.lastName}` : '',
      cc: member ? splitE164(member.phone).country : SOMALIA,
      phone: member ? splitE164(member.phone).number : '',
      email: member?.email ?? '',
      altPhone: false,
      payphone: '',
      saveMethod: false,
      ...paymentDefaults(saved, defaultMethodId),
    },
  });
  const v = useWatch({ control: form.control }) as Values;
  const method = pickedMethod(v, saved);
  const wallet = method.kind !== 'card';
  // Wallets are Somali: the contact number pays only when it is one; otherwise the wallet's own number is asked for.
  const ownWallet = v.altPhone || v.cc !== SOMALIA;
  const payNumber = method.saved ? (method.saved.phone ?? '') : ownWallet ? v.payphone : v.phone;

  const [busy, setBusy] = useState(false);
  // A wallet payment left waiting (reload, closed prompt) is offered back before anything else.
  const [resumable] = useState(readPending);
  const [notice, setNotice] = useState<Notice | null>(resumable ? { kind: 'inflight', order: resumable } : null);
  const [waiting, setWaiting] = useState<CreatedOrder | null>(null);
  /** The order whose wallet prompt the guest stepped away from: its quote can't be paid twice, so it can be resumed. */
  const lastOrder = useRef<CreatedOrder | null>(resumable);
  const key = useRef(newKey());
  const payBtn = useRef<HTMLButtonElement>(null);
  const total = quote ? formatMoney(quote.total) : '';

  function finish(o: CreatedOrder) {
    const { paymentToken: _t, paymentPrompt: _p, ...order } = o;
    void [_t, _p];
    clearPending();
    // Paid: these stays are done and leave the basket. Until then (a wallet prompt, a decline) they stay in it.
    staysBooked(
      order.bookings.map((b) => ({ propertyId: b.property.id, checkIn: b.trip.checkIn, checkOut: b.trip.checkOut })),
    );
    if (member) {
      queryClient.setQueryData(queryKeys.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.methods });
    } else saveReceipt(order);
    void navigate(`/orders/${encodeURIComponent(order.id)}`, { replace: true });
  }

  /** The wallet says it was approved: open what the order really came to (confirmed, partly or not at all), never the
   *  snapshot taken while it was still waiting. */
  async function settle(o: CreatedOrder) {
    try {
      finish(
        await queryClient.fetchQuery({
          queryKey: queryKeys.order(o.id),
          queryFn: ({ signal }) => checkoutApi.order(o.id, signal, o.paymentToken),
          staleTime: 0,
        }),
      );
    } catch {
      setWaiting(null);
      setNotice({ kind: 'paid', order: o });
    }
  }

  async function pay(values: Values) {
    if (!quote || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const m = pickedMethod(values, saved);
      const payment: OrderRequest['payment'] = m.saved
        ? { savedMethodId: m.saved.id }
        : m.kind === 'card'
          ? {
              method: 'card',
              cardToken: (await tokenizeCard({ number: values.card, exp: values.exp, cvc: values.cvc })).token,
            }
          : {
              method: m.kind,
              brand: m.brand,
              payPhone: toE164(values.altPhone || values.cc !== SOMALIA ? values.payphone : values.phone),
            };
      const req: OrderRequest = {
        quoteId: quote.quoteId,
        guest: { name: values.name.trim(), phone: toE164For(values.cc, values.phone), email: values.email.trim() },
        ...(member && !m.saved && values.saveMethod ? { saveMethod: true } : {}),
        payment,
      };
      let res: CreatedOrder;
      try {
        res = await checkoutApi.createOrder(req, key.current);
      } catch (e) {
        // Lost connection: retry once with the SAME key, so a charge that did go through is never repeated.
        if (isApiError(e) && (e.code === 'NETWORK' || e.code === 'TIMEOUT'))
          res = await checkoutApi.createOrder(req, key.current);
        else throw e;
      }
      key.current = newKey();
      if (res.status === 'pending_payment') {
        savePending(res);
        setWaiting(res);
      } else finish(res);
    } catch (e) {
      // No answer at all: the payment may have gone through. Keep the key, so paying again replays the same request
      // (the server answers it with the original result) instead of starting a second one.
      const noAnswer = isApiError(e) && (e.code === 'NETWORK' || e.code === 'TIMEOUT');
      if (!noAnswer) key.current = newKey();
      if (noAnswer) setNotice({ kind: 'unknown' });
      else if (!isApiError(e)) setNotice({ kind: 'error', message: e instanceof Error ? e.message : errorMessage(e) });
      else if (e.code === 'PRICE_CHANGED')
        setNotice({ kind: 'price', quote: (e.body as { newQuote: Quote }).newQuote });
      else if (e.code === 'QUOTE_EXPIRED') {
        setNotice({ kind: 'expired' });
        onRefreshQuote();
      } else if (e.code === 'ROOM_UNAVAILABLE') {
        setNotice({ kind: 'unavailable', stays: (e.body as { stays?: number[] } | undefined)?.stays?.length ?? 1 });
        onRefreshQuote(); // the summary then shows which stays
      } else if (e.code === 'UNAUTHORIZED') {
        setNotice({ kind: 'signin' });
      } else if (e.code === 'QUOTE_USED' && lastOrder.current) {
        setNotice({ kind: 'inflight', order: lastOrder.current });
      } else if (e.code === 'QUOTE_USED' && member) {
        // This checkout was already paid for (a second tap, another tab): show what it became.
        const id = (e.body as { orderId?: string } | undefined)?.orderId;
        if (id) void navigate(`/orders/${encodeURIComponent(id)}`, { replace: true });
        else setNotice({ kind: 'error', message: errorMessage(e) });
      } else if (e.code === 'QUOTE_USED')
        setNotice({ kind: 'error', message: t('This checkout has already been paid for.') });
      else if (e.status === 402)
        setNotice({
          kind: 'declined',
          message:
            e.code === 'INSUFFICIENT_FUNDS'
              ? t('There isn’t enough money in that wallet.')
              : t('Your payment was declined.'),
        });
      else if (!applyServerErrors(form, e, FIELD_MAP)) setNotice({ kind: 'error', message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  const submit = useFormSubmit(form, pay);
  const locked = busy || !!waiting || notice?.kind === 'paid';

  const payLabel = quoteLoading ? t('Updating price…') : t('Pay {total} now', { total });

  return (
    <form className="main" noValidate onSubmit={submit}>
      <section className="card" inert={locked} aria-labelledby="sec-guest">
        <h2 id="sec-guest">
          <i>1</i>
          {t('Your details')}
        </h2>
        <TextField
          control={form.control}
          name="name"
          label={t('Full name')}
          autoComplete="name"
          placeholder={t('Enter your name')}
          maxLength={100}
        />
        <PhoneField control={form.control} name="phone" countryName="cc" label={t('Mobile number')} />
        <TextField
          control={form.control}
          name="email"
          label={t('Email')}
          type="email"
          autoComplete="email"
          placeholder={t('you@example.com')}
        />
      </section>

      <section className="card" inert={locked} aria-labelledby="sec-pay">
        <h2 id="sec-pay">
          <i>2</i>
          {t('Payment')}
        </h2>
        <PaymentOptions control={form.control} saved={saved} defaultId={defaultMethodId} />
        {wallet ? (
          <div className="momo">
            <p className="small muted momo-note">
              {t("You'll get {a} {brand} prompt on {phone} to approve {total}.", {
                a: article(method.brand),
                brand: method.brand,
                phone: phoneOk(payNumber)
                  ? `+252 ${phoneFmt(payNumber)}`
                  : payNumber
                    ? t('that number')
                    : t('your phone'),
                total,
              })}
            </p>
            {method.saved ? null : (
              <>
                {v.cc === SOMALIA ? (
                  <button
                    type="button"
                    className="linkbtn small momo-alt"
                    aria-expanded={v.altPhone}
                    aria-controls="alt-number"
                    onClick={() => form.setValue('altPhone', !v.altPhone, { shouldValidate: false })}
                  >
                    {v.altPhone ? t('Use my mobile number instead') : t('Pay from a different number')}
                  </button>
                ) : null}
                <Accordion id="alt-number" open={ownWallet} padded={false}>
                  <PhoneField
                    control={form.control}
                    name="payphone"
                    label={t('Wallet number')}
                    placeholder="77 123 4567"
                  />
                </Accordion>
              </>
            )}
          </div>
        ) : null}
        {member && !method.saved ? (
          <label className="opt small save-row">
            <input type="checkbox" {...form.register('saveMethod')} /> {t('Save this payment method to my account')}
          </label>
        ) : null}
      </section>

      {notice ? (
        <NoticePanel
          notice={notice}
          basketHref={basketHref}
          onAcceptPrice={(q) => {
            onQuote(q);
            setNotice(null);
            toast(`New total: ${formatMoney(q.total)}`);
          }}
          onResend={(b) => {
            setNotice(null);
            setWaiting(b);
          }}
          onShowOrder={(o) => {
            setNotice(null);
            void settle(o);
          }}
        />
      ) : null}

      <div className="payfoot paybox">
        {waiting || notice?.kind === 'paid' ? null : (
          <>
            <Button
              ref={payBtn}
              type="submit"
              block
              className="paybtn"
              disabled={!quote || quoteLoading}
              busy={busy}
              busyLabel={t('Processing payment…')}
            >
              <span>{payLabel}</span>
            </Button>
          </>
        )}
      </div>
      {waiting ? (
        <WalletPending
          order={waiting}
          amount={quote?.total ?? waiting.total}
          onConfirmed={() => void settle(waiting)}
          onFailed={(reason) => {
            setWaiting(null);
            if (reason !== 'TIMEOUT') clearPending();
            setNotice(
              reason === 'TIMEOUT'
                ? { kind: 'timeout', order: waiting }
                : { kind: 'declined', message: t('The payment was not approved.') },
            );
          }}
          onCancel={() => {
            lastOrder.current = waiting;
            setWaiting(null);
            // The pay button is back next frame; put focus where the user left off.
            requestAnimationFrame(() => payBtn.current?.focus());
          }}
        />
      ) : null}
    </form>
  );
}

function NoticePanel({
  notice,
  basketHref,
  onAcceptPrice,
  onResend,
  onShowOrder,
}: {
  notice: Notice;
  basketHref: string;
  onAcceptPrice: (q: Quote) => void;
  onResend: (o: CreatedOrder) => void;
  onShowOrder: (o: CreatedOrder) => void;
}) {
  const toast = useToast();
  switch (notice.kind) {
    case 'price':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>{t('The price changed.')}</b> Your new total is {formatMoney(notice.quote.total)}. Nothing has been
            charged.
          </p>
          <div className="row">
            <Button size="sm" onClick={() => onAcceptPrice(notice.quote)}>
              Continue with {formatMoney(notice.quote.total)}
            </Button>
            <AppLink className="linkbtn" to={basketHref}>
              {t('Back to my basket')}
            </AppLink>
          </div>
        </div>
      );
    case 'expired':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>{t('Your price was refreshed.')}</b> {t('Check the total, then pay again.')}
          </p>
        </div>
      );
    case 'unavailable':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>
              {notice.stays > 1
                ? t('Rooms in {n} of your stays are no longer available.', { n: notice.stays })
                : t('Some rooms are no longer available.')}
            </b>{' '}
            {t('Nothing has been charged. Your other stays are still here.')}
          </p>
          <AppLink className="linkbtn" to={basketHref}>
            {t('Review my stays')}
          </AppLink>
        </div>
      );
    case 'inflight':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>{t('Your payment is still waiting for approval.')}</b>{' '}
            {t('It can’t be paid twice. Approve it on your phone, or wait for it to expire and try again.')}
          </p>
          <div className="row">
            <Button size="sm" onClick={() => onResend(notice.order)}>
              {t('Check my payment')}
            </Button>
          </div>
        </div>
      );
    case 'paid':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>{t('Your payment was approved.')}</b>{' '}
            {t('We couldn’t load your confirmation just now. Your booking is not lost and you won’t be charged again.')}
          </p>
          <div className="row">
            <Button size="sm" onClick={() => onShowOrder(notice.order)}>
              {t('Show my confirmation')}
            </Button>
          </div>
        </div>
      );
    case 'signin':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>{t('Your session has ended.')}</b>{' '}
            {t('Nothing has been charged. Sign in again to pay with your account; your rooms stay in your basket.')}
          </p>
          <AppLink className="linkbtn" to={`/signin?${new URLSearchParams({ next: '/checkout' })}`}>
            {t('Sign in')}
          </AppLink>
        </div>
      );
    case 'unknown':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>{t('We couldn’t confirm whether your payment went through.')}</b>{' '}
            {t(
              t(
                'Your details are kept. Tap Pay again and we’ll check the same payment first, so you won’t be charged twice. If you’ve already approved it on your phone, you can also wait a moment before trying.',
              ),
            )}
          </p>
        </div>
      );
    case 'declined':
      return (
        <div className="notice err" role="alert">
          <p>
            <b>{notice.message}</b> {t('Nothing has been charged. Try again or choose another payment method.')}
          </p>
        </div>
      );
    case 'timeout':
      return (
        <div className="notice warn" role="alert">
          <p>
            <b>{t('We didn’t get your approval in time.')}</b>{' '}
            {t('Send a new prompt to your phone, or choose another method.')}
          </p>
          <div className="row">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await checkoutApi.resendPrompt(notice.order.id, notice.order.paymentToken);
                  onResend({
                    ...notice.order,
                    paymentPrompt: { expiresAt: new Date(Date.now() + 90e3).toISOString() },
                  });
                } catch (e) {
                  toast(
                    isApiError(e) && e.retryAfter
                      ? t('Please wait {s}s before asking again.', { s: e.retryAfter })
                      : errorMessage(e),
                  );
                }
              }}
            >
              {t('Send a new prompt')}
            </Button>
          </div>
        </div>
      );
    default:
      return (
        <div className="notice err" role="alert">
          <p>
            <b>{notice.message}</b> Your details are kept; please try again.
          </p>
        </div>
      );
  }
}
