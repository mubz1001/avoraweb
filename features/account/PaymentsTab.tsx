import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Accordion, useAccordion } from '@/components/Accordion';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Controls';
import { FormError, PhoneField } from '@/components/Field';
import { errorMessage, useFormSubmit } from '@/components/forms';
import { Icon } from '@/components/Icon';
import {
  checkPaymentFields,
  paymentDefaults,
  PaymentOptions,
  pickedMethod,
  type PaymentFields,
} from '@/components/PaymentOptions';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { tokenizeCard } from '@/lib/payments/hostedFields';
import { methodExpired, methodSub, methodTitle } from '@/lib/payments/methods';
import { phoneFmt, toE164 } from '@/lib/phone';
import { queryClient } from '@/lib/queryClient';
import { phoneMsg } from '@/lib/validation/rules';
import type { Member, SavedPaymentMethod } from '@/types';

const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.methods });
  void queryClient.invalidateQueries({ queryKey: queryKeys.me, exact: true });
};

function MethodRow({ method: m, isDefault }: { method: SavedPaymentMethod; isDefault: boolean }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const expired = methodExpired(m);
  // Focus moves to Keep when asking, and back to the trash button when kept (docs/04 B.7).
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (wasConfirming.current) trashRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const remove = useMutation({
    mutationFn: () => accountApi.removeMethod(m.id),
    onSuccess: () => toast(`${methodTitle(m)} removed`),
    onError: (e) => toast(errorMessage(e)),
    onSettled: refresh,
  });
  const makeDefault = useMutation({
    mutationFn: () => accountApi.setDefaultMethod(m.id),
    onSuccess: () => toast(`${methodTitle(m)} is now your default`),
    onError: (e) => toast(errorMessage(e)),
    onSettled: refresh,
  });

  if (confirming) {
    return (
      <div className="card pmrow confirm">
        <div className="grow">
          <b>Remove {methodTitle(m)}?</b>
          <div className="muted small">You can add it again any time.</div>
        </div>
        <div className="row">
          <Button ref={keepRef} variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button
            variant="danger"
            size="sm"
            busy={remove.isPending}
            busyLabel="Removing…"
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="card pmrow">
      <span className="pi">
        <Icon name={m.kind === 'card' ? 'card' : 'mobile'} />
      </span>
      <div className="grow">
        <b>{methodTitle(m)}</b>
        <div className="muted small">{methodSub(m)}</div>
        <div className="pmmeta">
          {isDefault ? <Chip>Default</Chip> : null}
          {expired ? <Chip tone="warn">Expired</Chip> : null}
          {!isDefault && !expired ? (
            <button
              type="button"
              className="linkbtn"
              disabled={makeDefault.isPending}
              onClick={() => makeDefault.mutate()}
            >
              Make default
            </button>
          ) : null}
        </div>
      </div>
      <button
        ref={trashRef}
        type="button"
        className="icon-btn"
        aria-label={`Remove ${methodTitle(m)}`}
        onClick={() => setConfirming(true)}
      >
        <Icon name="trash" />
      </button>
    </div>
  );
}

const addSchema = z
  .object({
    pm: z.string(),
    card: z.string(),
    exp: z.string(),
    cvc: z.string(),
    wphone: z.string(),
    makeDefault: z.boolean(),
  })
  .superRefine((v, ctx) => {
    checkPaymentFields(v, ctx);
    if (v.pm !== 'card') {
      const m = phoneMsg(v.wphone);
      if (m) ctx.addIssue({ code: 'custom', path: ['wphone'], message: m });
    }
  });
type AddValues = z.infer<typeof addSchema> & PaymentFields;

function AddMethod({ member, hasMethods }: { member: Member; hasMethods: boolean }) {
  const toast = useToast();
  const acc = useAccordion();
  const [err, setErr] = useState('');
  const defaults = (): AddValues => ({ ...paymentDefaults(), wphone: phoneFmt(member.phone), makeDefault: false });
  const form = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    shouldFocusError: false,
    defaultValues: defaults(),
  });
  const pm = useWatch({ control: form.control, name: 'pm' });
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      const m = pickedMethod(v, []);
      const body =
        m.kind === 'card'
          ? {
              kind: 'card' as const,
              providerToken: (await tokenizeCard({ number: v.card, exp: v.exp, cvc: v.cvc })).token,
              makeDefault: v.makeDefault,
            }
          : { kind: m.kind, brand: m.brand, phone: toE164(v.wphone), makeDefault: v.makeDefault };
      const saved = await accountApi.addMethod(body);
      toast(`${methodTitle(saved)} saved`);
      acc.setOpen(false);
      form.reset(defaults());
      refresh();
    } catch (e) {
      setErr(errorMessage(e));
    }
  });
  return (
    <div className="card addpm">
      <button type="button" className="rowbtn add" {...acc.triggerProps}>
        <Icon name="plus" />
        <span className="grow">Add payment method</span>
      </button>
      <Accordion {...acc.panelProps}>
        <form noValidate onSubmit={submit}>
          <FormError>{err}</FormError>
          <PaymentOptions control={form.control} />
          <PhoneField
            control={form.control}
            name="wphone"
            label="Wallet number"
            hint="The number that gets the payment prompt."
            hidden={pm === 'card'}
            className="wallet-field"
          />
          {hasMethods ? (
            <label className="opt small">
              <input type="checkbox" {...form.register('makeDefault')} /> Use as my default payment method
            </label>
          ) : null}
          <Button type="submit" block busy={form.formState.isSubmitting} busyLabel="Saving…">
            Save payment method
          </Button>
        </form>
      </Accordion>
    </div>
  );
}

/** Payment methods: saved first at checkout, so paying takes one tap (docs/05 PaymentMethodList). */
export function PaymentsTab({ member }: { member: Member }) {
  const q = useQuery({ queryKey: queryKeys.methods, queryFn: ({ signal }) => accountApi.methods(signal) });
  return (
    <div className="narrow stack">
      <div className="stack-s" aria-busy={q.isPending}>
        {q.isError ? (
          <QueryError error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <Skeleton height={72} radius={14} />
        ) : q.data.items.length ? (
          q.data.items.map((m) => <MethodRow key={m.id} method={m} isDefault={m.id === q.data.defaultId} />)
        ) : (
          <div className="card empty">
            <h2>No saved payment methods</h2>
            <p className="muted">Add one below, or tick “Save this payment method” when you pay.</p>
          </div>
        )}
      </div>
      <AddMethod member={member} hasMethods={!!q.data?.items.length} />
    </div>
  );
}
