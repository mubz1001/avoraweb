import { buttonClass } from './Button';
import { AppLink } from './AppLink';
import { Icon, type IconName } from './Icon';
import { useAuthHref } from '@/lib/session';
import './JoinPrompt.css';
import { t } from '@/lib/i18n';

/** The four account benefits (docs/05 PerksList), shared by the join prompt and the sign-in page. */
const PERKS: [IconName, string, string][] = [
  [
    'cal',
    'View all your bookings',
    'Upcoming and past stays in one place, on any device. No reference numbers to keep.',
  ],
  ['card', 'Manage payment methods', 'Save EVC Plus, ZAAD, SAHAL, eDahab or a card once, then pay in one tap.'],
  ['review', 'Leave reviews', 'Share how your stay went and help other travellers choose with confidence.'],
  [
    'medal',
    'Join the best platform',
    'Trusted stays across Somalia, free cancellation on most bookings and local support on WhatsApp.',
  ],
];

export function PerksList() {
  return (
    <ul className="perks">
      {PERKS.map(([icon, title, body]) => (
        <li key={title}>
          <span className="pi">
            <Icon name={icon} />
          </span>
          <span>
            <b>{t(title)}</b>
            <span className="muted small">{t(body)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  title?: string;
  sub?: string;
  /** Where to land after signing in or up. */
  next?: string;
  /** Runs before going to Create account (e.g. to pass guest details to the sign-up form). */
  onCreate?: () => void;
}

/** Join prompt: why an account is worth it, then Create account / Sign in (docs/05 JoinPrompt). */
export function JoinPrompt({
  title = t('Get more with an AVORA account'),
  sub = t('Guests only get an email confirmation. An account keeps every trip in one place.'),
  next,
  onCreate,
}: Props) {
  const authHref = useAuthHref();
  return (
    <section className="card join" aria-labelledby="join-title">
      <h2 id="join-title">{title}</h2>
      <p className="muted small">{sub}</p>
      <PerksList />
      <div className="join-cta">
        <AppLink className={buttonClass({})} to={authHref('signup', next)} onClick={onCreate}>
          {t('Create account')}
        </AppLink>
        <AppLink className={buttonClass({ variant: 'ghost' })} to={authHref('signin', next)}>
          {t('Sign in')}
        </AppLink>
      </div>
    </section>
  );
}
