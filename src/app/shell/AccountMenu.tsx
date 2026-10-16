import type { RefObject } from 'react';
import { accountItems, memberHue } from './nav';
import { AppLink } from '@/components/AppLink';
import { buttonClass } from '@/components/Button';
import { Avatar } from '@/components/Controls';
import { Dropdown } from '@/components/Dropdown';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { signOutAndSay, useAuthHref, useSession } from '@/lib/session';
import './AccountMenu.css';
import { t } from '@/lib/i18n';

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
  /** The header's account button. */
  trigger: RefObject<HTMLButtonElement | null>;
  /** Key of the page being viewed (the account tab, when on one), marked in the list. */
  here: string;
}

/**
 * The account menu (docs/05 AccountMenu): a dropdown from the header's account button that lists every account page so
 * each opens directly. Members see their card, their four account pages and Sign out; guests, to encourage an account,
 * see only Create account / Sign in. Support and WhatsApp are not repeated: they are in the header.
 */
export function AccountMenu({ id, open, onClose, trigger, here }: Props) {
  const { member } = useSession();
  const authHref = useAuthHref();
  const toast = useToast();

  return (
    <Dropdown
      id={id}
      open={open}
      onClose={onClose}
      trigger={trigger}
      title={t('Your account')}
      closeLabel={t('Close account menu')}
      width={320}
    >
      <div className="acm">
        {member ? (
          <div className="acm-me">
            <Avatar name={member.firstName} hue={memberHue(member.firstName)} />
            <span>
              <b>
                {member.firstName} {member.lastName}
              </b>
              <small>{member.email}</small>
            </span>
          </div>
        ) : (
          <div className="acm-join">
            <b>{t('Get more with an account')}</b>
            <span className="muted small">
              {t('All your bookings in one place, saved payment methods and reviews.')}
            </span>
            <div className="row">
              <AppLink className={buttonClass({ variant: 'ghost', size: 'sm' })} to={authHref('signup')}>
                {t('Create account')}
              </AppLink>
              <AppLink className={buttonClass({ size: 'sm' })} to={authHref('signin')}>
                {t('Sign in')}
              </AppLink>
            </div>
          </div>
        )}
        {member ? <div className="acm-sep" /> : null}
        {member ? (
          <nav aria-label={t('Account')}>
            {accountItems(true).map((n) => (
              <AppLink key={n.key} className="acm-row" to={n.to} aria-current={n.key === here ? 'page' : undefined}>
                <Icon name={n.icon} />
                {n.label}
              </AppLink>
            ))}
          </nav>
        ) : null}
        {member ? (
          <>
            <div className="acm-sep" />
            <button
              type="button"
              className="acm-row"
              onClick={() => {
                onClose();
                void signOutAndSay(toast);
              }}
            >
              <Icon name="out" />
              {t('Sign out')}
            </button>
          </>
        ) : null}
      </div>
    </Dropdown>
  );
}
