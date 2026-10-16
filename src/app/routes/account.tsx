import { type CSSProperties, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { NotFound } from '../NotFound';
import { AppLink } from '@/components/AppLink';
import { Icon } from '@/components/Icon';
import { JoinPrompt } from '@/components/JoinPrompt';
import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/Skeleton';
import { BookingsTab } from '@/features/account/BookingsTab';
import { PaymentsTab } from '@/features/account/PaymentsTab';
import { ProfileTab } from '@/features/account/ProfileTab';
import { FavouritesTab } from '@/features/account/FavouritesTab';
import { onIdle } from '@/lib/prefetch';
import { retrySession, useSession } from '@/lib/session';
import '@/features/account/account.css';
import '@/features/booking/booking.css';
import { useSeo } from '@/lib/seo';

/** [key, tab label, page title, needs an account, icon, short label for phones]. Guests are asked to sign in on every section. */
const TABS = [
  ['bookings', 'Bookings', 'My bookings', true, 'cal'],
  ['favourites', 'Favourites', 'Favourites', true, 'heart'],
  ['payments', 'Payment methods', 'Payment methods', true, 'card', 'Payments'],
  ['profile', 'Profile', 'Profile', true, 'user'],
] as const;

/** The account is one page: the sidebar (tabs on phones) and every section stay mounted, and picking a section only
 *  changes which one is shown. The URL still follows (links, Back and refresh work). A section mounts when first shown;
 *  the rest mount once the browser is idle, so their data is there before it is needed and switching never waits. */
/** What a guest is told on a section that needs an account: [title, one line]. */
const GATE: Record<string, [string, string?]> = {
  bookings: [
    'Your bookings live in your account',
    'Guests only get an email confirmation. Sign in or create an account to see every booking in one place.',
  ],
  favourites: [
    'Sign in to see your favourites',
    'Create a free account to save the stays you like and find them again on every device.',
  ],
  payments: ['Sign in to manage payment methods'],
  profile: ['Sign in to see your profile'],
};

export function Component() {
  useSeo({ noindex: true });
  const { tab: key = 'bookings' } = useParams();
  const { member, loading, failed, error } = useSession();
  const tab = TABS.find((t) => t[0] === key);
  const [mounted, setMounted] = useState<ReadonlySet<string>>(() => new Set([key]));
  useEffect(() => onIdle(() => setMounted(new Set(TABS.map((t) => t[0])))), []);
  if (!tab) return <NotFound />;
  if (!mounted.has(key)) setMounted(new Set([...mounted, key]));
  const [, , title] = tab;
  const visible = TABS.filter((t) => member || !t[3] || t === tab);

  const section = (k: (typeof TABS)[number][0], gated: boolean) => {
    if (loading) return <Skeleton height={120} radius={14} />;
    // The check itself failed: don't tell someone who may be signed in to sign in.
    if (gated && !member && failed)
      return <QueryError error={error} onRetry={() => void retrySession()} title="We couldn’t check your account." />;
    if (gated && !member) {
      const [gateTitle, gateSub] = GATE[k] ?? ['Sign in to continue'];
      return (
        <div className="narrow">
          <JoinPrompt title={gateTitle} sub={gateSub} next={`/account/${k}`} />
        </div>
      );
    }
    if (k === 'bookings' && member) return <BookingsTab member={member} />;
    if (k === 'favourites' && member) return <FavouritesTab />;
    if (k === 'payments' && member) return <PaymentsTab member={member} />;
    if (k === 'profile' && member) return <ProfileTab member={member} />;
    return null;
  };

  return (
    <div className="wrap">
      <title>{`${title} · Avora Bookings`}</title>
      <h1 className="sr">{title}</h1>
      <div className="acct-layout">
        <nav
          className="tabs"
          aria-label="Your account"
          style={{ '--i': visible.indexOf(tab), '--n': visible.length } as CSSProperties}
        >
          {visible.map((t) => (
            <AppLink
              key={t[0]}
              to={`/account/${t[0]}`}
              aria-current={t === tab ? 'page' : undefined}
              replace
              preventScrollReset
            >
              <Icon name={t[4]} />
              {t[5] ? (
                <>
                  <span className="full">{t[1]}</span>
                  <span className="short" aria-hidden="true">
                    {t[5]}
                  </span>
                </>
              ) : (
                t[1]
              )}
            </AppLink>
          ))}
        </nav>
        <div id="account-panel">
          {visible
            .filter((t) => mounted.has(t[0]))
            .map((t) => (
              <div key={t[0]} hidden={t !== tab} inert={t !== tab}>
                {section(t[0], t[3])}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
