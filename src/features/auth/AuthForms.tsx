import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { z } from 'zod';
import { AppLink } from '@/components/AppLink';
import { PROVIDERS } from '@/components/BrandIcons';
import { Button } from '@/components/Button';
import { FormError, PasswordField, PhoneField, TextField } from '@/components/Field';
import { applyServerErrors, errorMessage, rule, useConfirmSync, useFormSubmit } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { forgetSession } from '@/lib/session';
import { isApiError } from '@/lib/api/client';
import { accountApi } from '@/lib/api/endpoints';
import { SOMALIA, toE164For } from '@/lib/phone';
import { session } from '@/lib/storage';
import { checkPhone, confirmMsg, emailMsg, nameMsg, pwMsg } from '@/lib/validation/rules';
import type { Member } from '@/types';
import './auth.css';

export type Provider = keyof typeof PROVIDERS;

/** Typed values survive switching between the auth views (never passwords). In memory only. */
export const draft: { firstName?: string; lastName?: string; email?: string; cc?: string; phone?: string } = {};

/** A Google/Apple sign-up waiting for the details providers never share (opaque server token, 15 min). */
const PENDING = 'avora.pending';
export interface Pending {
  token: string;
  email: string;
  provider: Provider;
  exp: number;
}
export const readPending = () => {
  const p = session.get<Pending | null>(PENDING, null);
  return p && p.exp > Date.now() && p.provider in PROVIDERS ? p : null;
};
export const clearPending = () => session.del(PENDING);

const opts = { mode: 'onTouched', reValidateMode: 'onChange', shouldFocusError: false } as const;
const terms = (
  <p className="muted tiny terms">
    By creating an account you agree to our <AppLink to="/legal/terms">Terms</AppLink> and{' '}
    <AppLink to="/legal/privacy">Privacy policy</AppLink>.
  </p>
);

export function ProviderButtons({ onPick }: { onPick: (p: Provider) => void }) {
  return (
    <>
      <div className="sso">
        {(Object.keys(PROVIDERS) as Provider[]).map((k) => {
          const { name, Mark } = PROVIDERS[k];
          return (
            <Button key={k} variant="ghost" block className="sso-btn" onClick={() => onPick(k)}>
              <Mark />
              Continue with {name}
            </Button>
          );
        })}
      </div>
      <div className="or">
        <span>or with email</span>
      </div>
    </>
  );
}

const signInSchema = z.object({ email: rule(emailMsg), password: z.string().min(1, 'Enter your password.') });

export function SignInForm({ onDone, onForgot }: { onDone: (m: Member) => void; onForgot: () => void }) {
  const form = useForm({
    ...opts,
    resolver: zodResolver(signInSchema),
    defaultValues: { email: draft.email ?? '', password: '' },
  });
  const [err, setErr] = useState('');
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      onDone((await accountApi.login(v.email.trim(), v.password)).member);
    } catch (e) {
      setErr(errorMessage(e));
      form.setValue('password', '');
      form.setFocus('password');
    }
  });
  return (
    <form
      noValidate
      onSubmit={submit}
      onChange={() => {
        draft.email = form.getValues('email');
        setErr('');
      }}
    >
      <FormError>{err}</FormError>
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        spellCheck={false}
      />
      <PasswordField control={form.control} name="password" label="Password" autoComplete="current-password" />
      <div className="auth-row">
        <button type="button" className="linkbtn" onClick={onForgot}>
          Forgot password?
        </button>
      </div>
      <Button type="submit" block busy={form.formState.isSubmitting} busyLabel="Signing in…">
        Sign in
      </Button>
    </form>
  );
}

const namesShape = {
  firstName: rule((v) => nameMsg(v, 'first name')),
  lastName: rule((v) => nameMsg(v, 'last name')),
  cc: z.string(),
  phone: z.string(),
};
const signUpSchema = z
  .object({ ...namesShape, email: rule(emailMsg), password: z.string(), confirm: z.string() })
  .superRefine((v, ctx) => {
    const m = pwMsg(v.password, v.email);
    if (m) ctx.addIssue({ code: 'custom', path: ['password'], message: m });
    const c = confirmMsg(v.password, v.confirm);
    if (c) ctx.addIssue({ code: 'custom', path: ['confirm'], message: c });
    checkPhone(v, ctx);
  });

function NameFields<T extends FieldValues>({ control }: { control: Control<T> }) {
  return (
    <div className="grid2">
      <TextField
        control={control}
        name={'firstName' as FieldPath<T>}
        label="First name"
        autoComplete="given-name"
        maxLength={50}
      />
      <TextField
        control={control}
        name={'lastName' as FieldPath<T>}
        label="Last name"
        autoComplete="family-name"
        maxLength={50}
      />
    </div>
  );
}

export function SignUpForm({ onDone, onSignIn }: { onDone: (m: Member) => void; onSignIn: () => void }) {
  const form = useForm({
    ...opts,
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: draft.firstName ?? '',
      lastName: draft.lastName ?? '',
      email: draft.email ?? '',
      cc: draft.cc ?? SOMALIA,
      phone: draft.phone ?? '',
      password: '',
      confirm: '',
    },
  });
  useConfirmSync(form, 'password', 'confirm');
  const [err, setErr] = useState<React.ReactNode>('');
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      onDone(
        (
          await accountApi.register({
            firstName: v.firstName.trim(),
            lastName: v.lastName.trim(),
            email: v.email.trim(),
            phone: toE164For(v.cc, v.phone),
            password: v.password,
          })
        ).member,
      );
    } catch (e) {
      if (isApiError(e) && e.code === 'EMAIL_TAKEN') {
        form.setError('email', { message: 'An account with this email already exists.' });
        setErr(
          <>
            Already have an account?{' '}
            <button type="button" className="linkbtn" onClick={onSignIn}>
              Sign in instead
            </button>
          </>,
        );
      } else if (!applyServerErrors(form, e)) setErr(errorMessage(e));
    }
  });
  const keep = () => {
    Object.assign(draft, {
      firstName: form.getValues('firstName'),
      lastName: form.getValues('lastName'),
      email: form.getValues('email'),
      cc: form.getValues('cc'),
      phone: form.getValues('phone'),
    });
    setErr('');
  };
  return (
    <form noValidate onSubmit={submit} onChange={keep}>
      <FormError>{err}</FormError>
      <NameFields control={form.control} />
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        spellCheck={false}
      />
      <PhoneField control={form.control} name="phone" countryName="cc" label="Mobile number" />
      <PasswordField control={form.control} name="password" label="Password" autoComplete="new-password" />
      <PasswordField
        control={form.control}
        name="confirm"
        label="Confirm password"
        autoComplete="new-password"
        confirm
      />
      <Button type="submit" block busy={form.formState.isSubmitting} busyLabel="Creating your account…">
        Create account
      </Button>
      {terms}
    </form>
  );
}

/** Provider step: stands in for Google's / Apple's own sign-in window (OIDC + PKCE in production). */
export function ProviderForm({
  provider,
  onBack,
  onDone,
  onPending,
}: {
  provider: Provider;
  onBack: () => void;
  onDone: (m: Member) => void;
  onPending: () => void;
}) {
  const { name, Mark } = PROVIDERS[provider];
  const form = useForm({
    ...opts,
    resolver: zodResolver(z.object({ email: rule(emailMsg) })),
    defaultValues: { email: draft.email ?? '' },
  });
  const [err, setErr] = useState('');
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      const r = await accountApi.oauth(provider, v.email.trim());
      if ('member' in r) onDone(r.member);
      else {
        session.set(PENDING, {
          token: r.pendingToken,
          email: r.email,
          provider,
          exp: Date.now() + 15 * 60e3,
        } satisfies Pending);
        onPending();
      }
    } catch (e) {
      setErr(errorMessage(e));
    }
  });
  return (
    <>
      <button type="button" className="linkbtn back" onClick={onBack} disabled={form.formState.isSubmitting}>
        ← Back
      </button>
      <div className="sso-head">
        <Mark />
        <h1>Continue with {name}</h1>
      </div>
      <p className="muted auth-sub">Enter the email of the {name} account you want to use.</p>
      <form noValidate onSubmit={submit} onChange={() => setErr('')}>
        <FormError>{err}</FormError>
        <TextField
          control={form.control}
          name="email"
          label={`${name} account email`}
          type="email"
          autoComplete="email"
          spellCheck={false}
        />
        <Button type="submit" block busy={form.formState.isSubmitting} busyLabel={`Connecting to ${name}…`}>
          Continue
        </Button>
      </form>
    </>
  );
}

const completeSchema = z.object(namesShape).superRefine(checkPhone);

/** "Almost done": what providers never share (the mobile number, and names Apple may withhold). */
export function CompleteForm({
  pending,
  onDone,
  onCancel,
  onExpired,
}: {
  pending: Pending;
  onDone: (m: Member) => void;
  onCancel: () => void;
  onExpired: () => void;
}) {
  const { name, Mark } = PROVIDERS[pending.provider];
  const form = useForm({
    ...opts,
    resolver: zodResolver(completeSchema),
    defaultValues: {
      firstName: draft.firstName ?? '',
      lastName: draft.lastName ?? '',
      cc: draft.cc ?? SOMALIA,
      phone: draft.phone ?? '',
    },
  });
  const [err, setErr] = useState('');
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      const { member } = await accountApi.oauthComplete({
        pendingToken: pending.token,
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        phone: toE164For(v.cc, v.phone),
      });
      clearPending();
      onDone(member);
    } catch (e) {
      if (isApiError(e) && e.code === 'SESSION_EXPIRED') {
        clearPending();
        onExpired();
      } else if (!applyServerErrors(form, e)) setErr(errorMessage(e));
    }
  });
  return (
    <>
      <h1>Almost done</h1>
      <p className="muted auth-sub">Add your name and mobile number to finish creating your AVORA account.</p>
      <div className="guestnote sso-note">
        <Mark />
        <span>
          Signing up with {name} as <b>{pending.email}</b>
        </span>
      </div>
      <form noValidate onSubmit={submit}>
        <FormError>{err}</FormError>
        <NameFields control={form.control} />
        <PhoneField control={form.control} name="phone" countryName="cc" label="Mobile number" />
        <Button type="submit" block busy={form.formState.isSubmitting} busyLabel="Creating your account…">
          Create account
        </Button>
        {terms}
      </form>
      <p className="auth-alt">
        <button type="button" className="linkbtn" onClick={onCancel}>
          Cancel and start again
        </button>
      </p>
    </>
  );
}

export function ForgotForm({ onBack }: { onBack: () => void }) {
  const form = useForm({
    ...opts,
    resolver: zodResolver(z.object({ email: rule(emailMsg) })),
    defaultValues: { email: draft.email ?? '' },
  });
  const [sent, setSent] = useState('');
  const [err, setErr] = useState('');
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      await accountApi.requestReset(v.email.trim());
      setSent(v.email.trim());
    } catch (e) {
      setErr(errorMessage(e));
    }
  });
  if (sent) {
    return (
      <div className="auth-done">
        <div className="tick">
          <Icon name="mail" />
        </div>
        <h1>Check your email</h1>
        <p className="muted">
          If an account exists for <b>{sent}</b>, we've sent a link to reset your password. It expires in 30 minutes.
        </p>
        <Button variant="ghost" block onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    );
  }
  return (
    <>
      <button type="button" className="linkbtn back" onClick={onBack}>
        ← Back to sign in
      </button>
      <h1>Reset your password</h1>
      <p className="muted auth-sub">
        Enter the email you signed up with and we'll send you a link to choose a new password.
      </p>
      <form
        noValidate
        onSubmit={submit}
        onChange={() => {
          draft.email = form.getValues('email');
          setErr('');
        }}
      >
        <FormError>{err}</FormError>
        <TextField
          control={form.control}
          name="email"
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
        />
        <Button type="submit" block busy={form.formState.isSubmitting} busyLabel="Sending…">
          Send reset link
        </Button>
      </form>
    </>
  );
}

const resetSchema = z.object({ password: z.string(), confirm: z.string() }).superRefine((v, ctx) => {
  const m = pwMsg(v.password);
  if (m) ctx.addIssue({ code: 'custom', path: ['password'], message: m });
  const c = confirmMsg(v.password, v.confirm);
  if (c) ctx.addIssue({ code: 'custom', path: ['confirm'], message: c });
});

/** A reset link that can't be used: missing, malformed, expired or already used all read the same, with one next step. */
function ResetLinkProblem({ onRequestNew }: { onRequestNew: () => void }) {
  return (
    <div className="auth-done">
      <div className="tick neutral">
        <Icon name="help" />
      </div>
      <h1>This link can’t be used</h1>
      <p className="muted">It may have expired (links last 30 minutes) or already been used. Ask for a new one.</p>
      <Button block onClick={onRequestNew}>
        Send a new link
      </Button>
    </div>
  );
}

/** The page behind the emailed reset link (docs/06 §5b): choose a new password. The link is single-use; success
 *  ends every session (the server revokes them), so this tab is signed out too. */
export function ResetForm({
  token,
  onSignIn,
  onRequestNew,
}: {
  token: string;
  onSignIn: () => void;
  onRequestNew: () => void;
}) {
  const form = useForm({ ...opts, resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } });
  useConfirmSync(form, 'password', 'confirm');
  const [err, setErr] = useState('');
  const [state, setState] = useState<'form' | 'done' | 'bad'>(/^[\w.~-]{8,200}$/.test(token) ? 'form' : 'bad');
  const submit = useFormSubmit(form, async (v) => {
    setErr('');
    try {
      await accountApi.confirmReset({ token, password: v.password });
      forgetSession();
      setState('done');
    } catch (e) {
      if (isApiError(e) && (e.status === 410 || e.status === 404)) setState('bad');
      else {
        form.setValue('password', '');
        form.setValue('confirm', '');
        if (!applyServerErrors(form, e, { password: 'password' })) setErr(errorMessage(e));
      }
    }
  });
  if (state === 'bad') return <ResetLinkProblem onRequestNew={onRequestNew} />;
  if (state === 'done') {
    return (
      <div className="auth-done">
        <div className="tick">
          <Icon name="check" />
        </div>
        <h1>Password updated</h1>
        <p className="muted">You’ve been signed out everywhere. Sign in with your new password.</p>
        <Button block onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    );
  }
  return (
    <>
      <h1>Choose a new password</h1>
      <form noValidate onSubmit={submit} onChange={() => setErr('')}>
        <FormError>{err}</FormError>
        <PasswordField control={form.control} name="password" label="New password" autoComplete="new-password" />
        <PasswordField
          control={form.control}
          name="confirm"
          label="Confirm new password"
          autoComplete="new-password"
          confirm
        />
        <Button type="submit" block busy={form.formState.isSubmitting} busyLabel="Saving…">
          Save new password
        </Button>
      </form>
    </>
  );
}
