import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Accordion, useAccordion } from '@/components/Accordion';
import { PROVIDERS } from '@/components/BrandIcons';
import { Button } from '@/components/Button';
import { FormError, PasswordField, PhoneField, TextField } from '@/components/Field';
import { errorMessage, rule, useConfirmSync, useFormSubmit } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { isApiError } from '@/lib/api/client';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { phoneDigits, phoneFmt, toE164 } from '@/lib/phone';
import { queryClient } from '@/lib/queryClient';
import { forgetSession, signOutAndSay } from '@/lib/session';
import { confirmMsg, emailMsg, nameMsg, normEmail, phoneMsg, pwMsg } from '@/lib/validation/rules';
import type { Member } from '@/types';

const opts = { mode: 'onTouched', reValidateMode: 'onChange', shouldFocusError: false } as const;

function DetailsForm({ member }: { member: Member }) {
  const toast = useToast();
  const [err, setErr] = useState('');
  const schema = z
    .object({
      firstName: rule((v) => nameMsg(v, 'first name')),
      lastName: rule((v) => nameMsg(v, 'last name')),
      email: rule(emailMsg),
      phone: rule(phoneMsg),
      current: z.string(),
    })
    .superRefine((v, ctx) => {
      if (member.hasPassword && normEmail(v.email) !== member.email && !v.current)
        ctx.addIssue({
          code: 'custom',
          path: ['current'],
          message: 'Enter your current password to change your email.',
        });
    });
  const defaults = {
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: phoneFmt(member.phone),
    current: '',
  };
  const form = useForm({ ...opts, resolver: zodResolver(schema), defaultValues: defaults });
  const v = useWatch({ control: form.control });
  const emailChanged = normEmail(v.email ?? '') !== member.email;
  const changed =
    (v.firstName ?? '').trim() !== member.firstName ||
    (v.lastName ?? '').trim() !== member.lastName ||
    emailChanged ||
    phoneDigits(v.phone ?? '') !== phoneDigits(member.phone);
  const submit = useFormSubmit(form, async (x) => {
    setErr('');
    try {
      const { member: m } = await accountApi.update({
        firstName: x.firstName.trim(),
        lastName: x.lastName.trim(),
        email: x.email.trim(),
        phone: toE164(x.phone),
        ...(member.hasPassword && emailChanged ? { currentPassword: x.current } : {}),
      });
      queryClient.setQueryData(queryKeys.me, m);
      form.reset({
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        phone: phoneFmt(m.phone),
        current: '',
      });
      toast('Your details are saved');
    } catch (e) {
      if (isApiError(e) && e.code === 'EMAIL_TAKEN')
        form.setError('email', { message: 'Another account already uses this email.' }, { shouldFocus: true });
      else if (isApiError(e) && e.code === 'BAD_PASSWORD')
        form.setError('current', { message: 'That password is incorrect.' }, { shouldFocus: true });
      else setErr(errorMessage(e));
    }
  });
  return (
    <section className="card">
      <h2>Personal details</h2>
      <form noValidate onSubmit={submit}>
        <FormError>{err}</FormError>
        <div className="grid2">
          <TextField
            control={form.control}
            name="firstName"
            id="pfirst"
            label="First name"
            autoComplete="given-name"
            maxLength={50}
          />
          <TextField
            control={form.control}
            name="lastName"
            id="plast"
            label="Last name"
            autoComplete="family-name"
            maxLength={50}
          />
        </div>
        <TextField control={form.control} name="email" id="pemail" label="Email" type="email" autoComplete="email" />
        {member.hasPassword ? (
          <PasswordField
            control={form.control}
            name="current"
            id="pcur"
            label="Current password"
            autoComplete="current-password"
            hint="Needed to change your email."
            hidden={!emailChanged}
          />
        ) : null}
        <PhoneField control={form.control} name="phone" id="pphone" label="Mobile number" />
        <Button type="submit" disabled={!changed} busy={form.formState.isSubmitting} busyLabel="Saving…">
          Save changes
        </Button>
      </form>
    </section>
  );
}

function PasswordForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const toast = useToast();
  const [err, setErr] = useState('');
  const schema = z.object({ current: z.string(), next: z.string(), confirm: z.string() }).superRefine((v, ctx) => {
    if (!v.current) ctx.addIssue({ code: 'custom', path: ['current'], message: 'Enter your current password.' });
    const m =
      pwMsg(v.next, member.email) || (v.next === v.current ? 'Choose a different password from your current one.' : '');
    if (m) ctx.addIssue({ code: 'custom', path: ['next'], message: m });
    const c = confirmMsg(v.next, v.confirm);
    if (c) ctx.addIssue({ code: 'custom', path: ['confirm'], message: c });
  });
  const form = useForm({
    ...opts,
    resolver: zodResolver(schema),
    defaultValues: { current: '', next: '', confirm: '' },
  });
  useConfirmSync(form, 'next', 'confirm');
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      await accountApi.setPassword({ currentPassword: v.current, newPassword: v.next });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me, exact: true });
      form.reset();
      onDone();
      toast('Password updated');
    } catch (e) {
      if (isApiError(e) && e.code === 'BAD_PASSWORD')
        form.setError('current', { message: 'That password is incorrect.' }, { shouldFocus: true });
      else setErr(errorMessage(e));
    }
  });
  return (
    <form noValidate onSubmit={submit}>
      <FormError>{err}</FormError>
      <PasswordField
        control={form.control}
        name="current"
        id="pwcur"
        label="Current password"
        autoComplete="current-password"
      />
      <PasswordField control={form.control} name="next" id="pwnew" label="New password" autoComplete="new-password" />
      <PasswordField
        control={form.control}
        name="confirm"
        id="pwconfirm"
        label="Confirm new password"
        autoComplete="new-password"
        confirm
      />
      <Button type="submit" busy={form.formState.isSubmitting} busyLabel="Saving…">
        Update password
      </Button>
    </form>
  );
}

function DeleteForm({ member }: { member: Member }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [err, setErr] = useState('');
  const had = member.hasPassword;
  const schema = z.object({ password: z.string() }).superRefine((v, ctx) => {
    if (had && !v.password) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Enter your password.' });
  });
  const form = useForm({ ...opts, resolver: zodResolver(schema), defaultValues: { password: '' } });
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      await accountApi.remove(had ? v.password : undefined);
      forgetSession();
      toast('Your account has been deleted');
      void navigate('/', { replace: true });
    } catch (e) {
      if (isApiError(e) && e.code === 'BAD_PASSWORD')
        form.setError('password', { message: 'That password is incorrect.' }, { shouldFocus: true });
      else setErr(errorMessage(e));
    }
  });
  return (
    <form noValidate onSubmit={submit}>
      <FormError>{err}</FormError>
      {had ? (
        <PasswordField
          control={form.control}
          name="password"
          id="delpw"
          label="Enter your password to confirm"
          autoComplete="current-password"
        />
      ) : (
        <p className="small formsub">This can’t be undone.</p>
      )}
      <Button type="submit" variant="danger" busy={form.formState.isSubmitting} busyLabel="Deleting…">
        Delete account permanently
      </Button>
    </form>
  );
}

/** Profile: details, sign-in & security, sign out, delete account (docs/05 ProfileForm, SecurityCard, DeleteAccount). */
export function ProfileTab({ member }: { member: Member }) {
  const toast = useToast();
  const pw = useAccordion();
  const del = useAccordion();
  return (
    <div className="narrow stack">
      <DetailsForm key={`${member.email}|${member.phone}|${member.firstName}|${member.lastName}`} member={member} />
      <section className="card">
        <h2>Sign-in &amp; security</h2>
        {member.hasPassword ? (
          <div className="kv">
            <span className="ico">
              <Icon name="mail" />
              Email &amp; password
            </span>
            <b className="ok">On</b>
          </div>
        ) : null}
        {member.providers.map((k) => {
          const { name, Mark } = PROVIDERS[k];
          return (
            <div className="kv" key={k}>
              <span className="ico">
                <Mark />
                {name}
              </span>
              <b className="ok">Connected</b>
            </div>
          );
        })}
        {member.hasPassword ? (
          <div className="subcard">
            <button type="button" className="rowbtn" {...pw.triggerProps}>
              <Icon name="lock" />
              <span className="grow">Change password</span>
              <span className="chev">
                <Icon name="chev" />
              </span>
            </button>
            <Accordion {...pw.panelProps}>
              <PasswordForm member={member} onDone={() => pw.setOpen(false)} />
            </Accordion>
          </div>
        ) : null}
        <Button variant="ghost" onClick={() => void signOutAndSay(toast)}>
          <Icon name="out" />
          Sign out
        </Button>
      </section>
      <section className="card">
        <h2>Delete account</h2>
        <p className="muted small formsub">
          Permanently removes your profile, saved payment methods, favourites and booking history. Confirmations already
          emailed to you stay valid.
        </p>
        <div className="subcard">
          <button type="button" className="rowbtn danger" {...del.triggerProps}>
            <Icon name="trash" />
            <span className="grow">Delete my account</span>
            <span className="chev">
              <Icon name="chev" />
            </span>
          </button>
          <Accordion {...del.panelProps}>
            <DeleteForm member={member} />
          </Accordion>
        </div>
      </section>
    </div>
  );
}
