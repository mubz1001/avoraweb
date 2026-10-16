import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { AppLink } from '@/components/AppLink';
import { errorMessage } from '@/components/forms';
import { useToast } from '@/components/Toast';
import {
  clearPending,
  CompleteForm,
  draft,
  ForgotForm,
  ProviderButtons,
  ProviderForm,
  readPending,
  ResetForm,
  SignInForm,
  SignUpForm,
  type Provider,
} from '@/features/auth/AuthForms';
import { accountApi } from '@/lib/api/endpoints';
import { config } from '@/lib/config';
import { DEMO_ACCOUNTS } from '@/lib/demoAccounts';
import { phoneFmt } from '@/lib/phone';
import { takePrefill } from '@/lib/receipt';
import { safeNext } from '@/lib/safeNext';
import { completeSignIn, useSession } from '@/lib/session';
import type { Member } from '@/types';
import { useSeo } from '@/lib/seo';

type Mode = 'signin' | 'signup' | 'complete' | 'forgot' | 'reset';
const MODE: Record<string, Mode> = {
  '/signin': 'signin',
  '/signup': 'signup',
  '/signup/complete': 'complete',
  '/forgot-password': 'forgot',
  '/reset-password': 'reset',
};
const TITLE: Record<Mode | 'provider', string> = {
  signin: 'Sign in',
  signup: 'Create account',
  complete: 'Finish signing up',
  forgot: 'Reset password',
  reset: 'Choose a new password',
  provider: 'Sign in',
};

// A guest confirmation can hand its details to the sign-up form once (docs/02 §4.10).
function applyPrefill() {
  const pre = takePrefill();
  if (pre.email)
    Object.assign(draft, {
      firstName: pre.firstName,
      lastName: pre.lastName,
      email: pre.email,
      phone: pre.phone ? phoneFmt(pre.phone) : '',
    });
}

export function Component() {
  useSeo({ noindex: true });
  const { pathname } = useLocation();
  // Sign in and Create account are one page, so the tab slider and the card persist and can animate between them.
  // Sign in, Create account and Forgot password are one mounted card too, so each change animates instead of swapping.
  return <AuthPage key={['/signup', '/forgot-password'].includes(pathname) ? '/signin' : pathname} />;
}

function AuthPage() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const mode = MODE[pathname] ?? 'signin';
  const { member } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [provider, setProvider] = useState<Provider | null>(null);
  // The tab view stays mounted (hidden, holding its height) while Forgot password shows, and Forgot starts fresh each time.
  const [tab, setTab] = useState<'signin' | 'signup'>(mode === 'signup' ? 'signup' : 'signin');
  const [forgotRun, setForgotRun] = useState(0);
  const [seen, setSeen] = useState(mode);
  if (seen !== mode) {
    setSeen(mode);
    if (mode === 'signin' || mode === 'signup') setTab(mode);
    if (mode === 'forgot') setForgotRun((n) => n + 1);
  }

  const [demoBusy, setDemoBusy] = useState(false);
  const [demoErr, setDemoErr] = useState('');
  useState(applyPrefill); // once per visit
  const go = (path: string) => void navigate(`${path}?${new URLSearchParams({ next })}`, { replace: true });

  const finish = async (m: Member, isNew = false) => {
    await completeSignIn(m);
    toast(isNew ? `Welcome to AVORA, ${m.firstName}. Your account is ready.` : `Welcome back, ${m.firstName}`);
    void navigate(next, { replace: true });
  };

  // The reset link works whoever is signed in; finishing it ends that session itself.
  if (member && !demoBusy && mode !== 'reset') return <Navigate to={next} replace />;
  const pending = mode === 'complete' ? readPending() : null;
  if (mode === 'complete' && !pending) return <Navigate to={`/signup?${new URLSearchParams({ next })}`} replace />;

  const view = provider ? 'provider' : mode === 'forgot' ? tab : mode;
  const tabs = (
    <nav className="auth-seg" data-mode={mode} aria-label="Sign in or create an account">
      {(['signin', 'signup'] as const).map((k) => (
        <AppLink
          key={k}
          to={`/${k}?${new URLSearchParams({ next })}`}
          replace
          aria-current={mode === k ? 'page' : undefined}
        >
          {k === 'signin' ? 'Sign in' : 'Create account'}
        </AppLink>
      ))}
    </nav>
  );
  // Developer shortcuts (mock API only): each signs in through the real path for its kind of account.
  const openDemo = async (signIn: () => Promise<Member | null>) => {
    setDemoBusy(true);
    setDemoErr('');
    try {
      const m = await signIn();
      if (!m) throw new Error('The demo account could not be opened.');
      await completeSignIn(m);
      toast("You're exploring a demo account");
      void navigate(next, { replace: true });
    } catch (e) {
      setDemoBusy(false);
      setDemoErr(errorMessage(e));
    }
  };
  const demo = config.features.demo ? (
    <p className="auth-alt demo-links">
      <button
        type="button"
        className="linkbtn demo-link"
        disabled={demoBusy}
        onClick={() =>
          void openDemo(
            async () => (await accountApi.login(DEMO_ACCOUNTS.email.email, DEMO_ACCOUNTS.email.password)).member,
          )
        }
      >
        {demoBusy ? 'Opening the demo…' : 'For Developer: Demo Account'}
      </button>
      <button
        type="button"
        className="linkbtn demo-link"
        disabled={demoBusy}
        onClick={() =>
          void openDemo(async () => {
            const r = await accountApi.oauth('google', DEMO_ACCOUNTS.social.email);
            return 'member' in r ? r.member : null;
          })
        }
      >
        For Developer: Google/Apple Demo
      </button>
      {demoErr ? (
        <span className="formerr" role="alert" style={{ display: 'block', marginTop: 10 }}>
          {demoErr}
        </span>
      ) : null}
    </p>
  ) : null;

  const entry = (
    <>
      {tabs}
      <div key={view} className="auth-pane">
        {view === 'signin' ? (
          <>
            <h1>Welcome back</h1>
            <p className="muted auth-sub">Sign in to see your bookings, saved payment methods and favourites.</p>
            <ProviderButtons onPick={setProvider} />
            <SignInForm onDone={(m) => void finish(m)} onForgot={() => go('/forgot-password')} />
          </>
        ) : (
          <>
            <h1>Create your account</h1>
            <p className="muted auth-sub">It takes less than a minute.</p>
            <ProviderButtons onPick={setProvider} />
            <SignUpForm onDone={(m) => void finish(m, true)} onSignIn={() => go('/signin')} />
          </>
        )}
        {demo}
      </div>
    </>
  );

  return (
    <div className="wrap auth">
      <title>{`${TITLE[mode === 'forgot' ? 'forgot' : view]} · Avora Bookings`}</title>
      {view === 'signin' || view === 'signup' ? (
        // Sign in / Create account and Forgot password are two cards in one grid cell, so the page is always as tall
        // as the sign-in page: switching moves nothing, and the reset card stays its own (short) size. The card
        // that isn't showing is hidden and inert (no focus, not read out). No animation between them.
        <div className="auth-stack">
          <section className="card auth-card" inert={mode === 'forgot'}>
            {entry}
          </section>
          <section className="card auth-card" inert={mode !== 'forgot'}>
            <ForgotForm key={forgotRun} onBack={() => go('/signin')} />
          </section>
        </div>
      ) : (
        <section className="card auth-card">
          {view === 'provider' && provider ? (
            <ProviderForm
              provider={provider}
              onBack={() => setProvider(null)}
              onDone={(m) => void finish(m)}
              onPending={() => go('/signup/complete')}
            />
          ) : view === 'complete' && pending ? (
            <CompleteForm
              pending={pending}
              onDone={(m) => void finish(m, true)}
              onCancel={() => {
                clearPending();
                go('/signup');
              }}
              onExpired={() => {
                toast('That sign-up took too long. Please start again.');
                go('/signup');
              }}
            />
          ) : view === 'reset' ? (
            <ResetForm
              token={params.get('token') ?? ''}
              onSignIn={() => go('/signin')}
              onRequestNew={() => go('/forgot-password')}
            />
          ) : null}
        </section>
      )}
    </div>
  );
}
