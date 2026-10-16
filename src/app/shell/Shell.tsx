import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { AppLink } from '@/components/AppLink';
import { WhatsAppIcon } from '@/components/BrandIcons';
import { Avatar } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { buttonClass } from '@/components/Button';
import { BasketButton } from '@/features/basket/BasketButton';
import { BasketPanel } from '@/features/basket/BasketPanel';
import { AccountMenu } from './AccountMenu';
import { drawerSections, HEADER_NAV, memberHue, type NavItem } from './nav';
import { config } from '@/lib/config';
import { useEscape, useReturnFocus } from '@/lib/motion/presence';
import { signOutAndSay, useAuthHref, useSession } from '@/lib/session';
import { useThemePref } from '@/lib/theme';
import { LANGS, setLang, t, useLang, type Lang } from '@/lib/i18n';
import './shell.css';

const WA_URL = `https://wa.me/${config.whatsapp}`;

/** Which nav item the current page is. */
function useCurrentKey() {
  const { pathname, search } = useLocation();
  if (pathname === '/') return 'home';
  if (pathname === '/support') return 'support';
  if (pathname.startsWith('/account/')) return pathname.split('/')[2] ?? 'bookings';
  if (pathname === '/search' && new URLSearchParams(search).get('type') === 'hall') return 'hall';
  return '';
}

export function Header() {
  const { member } = useSession();
  const here = useCurrentKey();
  const [menuOpen, setMenuOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const basketId = useId();
  const accountId = useId();
  const basketBtn = useRef<HTMLButtonElement>(null);
  const accountBtn = useRef<HTMLButtonElement>(null);
  const { pathname, key } = useLocation();
  const [lastPath, setLastPath] = useState(pathname);
  const [lastKey, setLastKey] = useState(key);
  // Render-phase adjustments, no effect needed: the menu closes on a new page, the basket and the account menu on any
  // navigation (their links can point at the page already open).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }
  if (lastKey !== key) {
    setLastKey(key);
    setBasketOpen(false);
    setAccountOpen(false);
  }

  return (
    <>
      <header className="hdr">
        <div className="wrap">
          <AppLink className="logo" to="/" aria-label={t('AVORA home')}>
            <span className="logo-mark">
              <img src="/logo.svg" alt="" width={28} height={28} />
            </span>
            AVORA
          </AppLink>
          <div className="hright">
            <nav className="nav" aria-label={t('Main')}>
              {HEADER_NAV.map((n) => (
                <AppLink
                  key={n.key}
                  to={n.to}
                  className={n.key === here ? 'on' : undefined}
                  aria-current={n.key === here ? 'page' : undefined}
                >
                  {t(n.label)}
                </AppLink>
              ))}
              <a href={config.listUrl} target="_blank" rel="noopener noreferrer">
                {t('List your property')}
              </a>
            </nav>
            <a
              className="wa-link"
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('Chat with AVORA on WhatsApp')}
            >
              <WhatsAppIcon />
            </a>
            <BasketButton
              ref={basketBtn}
              open={basketOpen}
              controls={basketId}
              onClick={() => setBasketOpen((o) => !o)}
            />
            {/* Far right on desktop: opens the account menu. Phones hide it: the drawer has the account. */}
            <button
              ref={accountBtn}
              type="button"
              className="acct"
              aria-label={t('Account menu')}
              aria-haspopup="dialog"
              aria-expanded={accountOpen}
              aria-controls={accountId}
              onClick={() => setAccountOpen((o) => !o)}
            >
              {member ? (
                <>
                  <Avatar name={member.firstName} hue={memberHue(member.firstName)} />
                  <span className="acct-txt">{member.firstName}</span>
                </>
              ) : (
                <>
                  <Icon name="user" />
                  <span className="acct-txt">{t('Account')}</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label={t('Open menu')}
              aria-expanded={menuOpen}
              aria-controls="drawer"
              onClick={() => {
                setBasketOpen(false);
                setAccountOpen(false);
                setMenuOpen(true);
              }}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>
      <BasketPanel id={basketId} open={basketOpen} onClose={() => setBasketOpen(false)} trigger={basketBtn} />
      <AccountMenu
        id={accountId}
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        trigger={accountBtn}
        here={here}
      />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} here={here} />
    </>
  );
}

function Drawer({ open, onClose, here }: { open: boolean; onClose: () => void; here: string }) {
  const { member } = useSession();
  const authHref = useAuthHref();
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(open, onClose);
  useReturnFocus(open);
  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  const sections = drawerSections(!!member);

  return (
    <>
      <div className={['drawer-bg', open && 'open'].filter(Boolean).join(' ')} onClick={onClose} aria-hidden="true" />
      <aside
        id="drawer"
        className={['drawer', open && 'open'].filter(Boolean).join(' ')}
        aria-label={t('Menu')}
        role="dialog"
        aria-modal={open}
        inert={!open}
      >
        <div className="drawer-top">
          <button ref={closeRef} type="button" className="icon-btn" aria-label={t('Close menu')} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {member ? (
          <div className="drawer-me">
            <Avatar name={member.firstName} hue={memberHue(member.firstName)} />
            <span>
              <b>
                {member.firstName} {member.lastName}
              </b>
              <small>{member.email}</small>
            </span>
          </div>
        ) : (
          <div className="drawer-join">
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
        {member ? <div className="drawer-sep" /> : null}
        {sections.map((sec, i) => (
          <section key={i} className="drawer-sec">
            {i > 0 ? <div className="drawer-sep" /> : null}
            {sec.items.map((n) => (
              <DrawerLink key={n.key} item={n} current={n.key === here} />
            ))}
          </section>
        ))}
        {member ? (
          <div className="drawer-foot">
            <button
              type="button"
              className="drawer-out"
              onClick={() => {
                onClose();
                void signOutAndSay(toast);
              }}
            >
              <Icon name="out" />
              {t('Sign out')}
            </button>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function DrawerLink({ item, current }: { item: NavItem; current: boolean }) {
  if (item.external)
    return (
      <a href={item.to} target="_blank" rel="noopener noreferrer">
        <Icon name={item.icon} />
        {t(item.label)}
      </a>
    );
  return (
    <AppLink to={item.to} aria-current={current ? 'page' : undefined}>
      <Icon name={item.icon} />
      {t(item.label)}
    </AppLink>
  );
}

export function Footer({ roomForStickyBar }: { roomForStickyBar?: boolean }) {
  const lang = useLang();
  const [themePref, setThemePref] = useThemePref();
  const halls = config.features.halls;
  const link = (to: string, label: ReactNode) => (
    <li>
      <AppLink to={to}>{label}</AppLink>
    </li>
  );

  return (
    <footer className={['site-footer', roomForStickyBar && 'with-bar'].filter(Boolean).join(' ')}>
      <div className="wrap fgrid">
        <div>
          <p className="fbrand">
            <span className="logo-mark sm">
              <img src="/logo.svg" alt="" width={22} height={22} />
            </span>
            AVORA
          </p>
        </div>
        <div>
          <p className="fh">{t('Company')}</p>
          <ul>
            {link('/legal/terms', t('Terms'))}
            {link('/legal/privacy', t('Privacy'))}
          </ul>
        </div>
        <div>
          <p className="fh">{t('Support')}</p>
          <ul>
            {link('/support', t('Contact support'))}
            <li>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer">
                {t('WhatsApp')}: {config.whatsappLabel}
              </a>
            </li>
            <li>
              <a href={config.listUrl} target="_blank" rel="noopener noreferrer">
                {halls ? 'List your hotel or hall on AVORA' : t('List your hotel on AVORA')}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="fh">{t('Preferences')}</p>
          <label className="flang">
            <span className="sr">{t('Language')}</span>
            <select aria-label={t('Change language')} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="theme-seg" data-pref={themePref}>
            <legend className="sr">{t('Appearance')}</legend>
            {(['system', 'light', 'dark'] as const).map((p) => (
              <label key={p}>
                <input
                  type="radio"
                  name="appearance"
                  value={p}
                  checked={themePref === p}
                  onChange={() => setThemePref(p)}
                />
                <span title={t(p === 'system' ? 'System' : p === 'light' ? 'Light' : 'Dark')}>
                  <Icon name={p === 'system' ? 'monitor' : p === 'light' ? 'sun' : 'moon'} />
                  <b className="sr">{t(p === 'system' ? 'System' : p === 'light' ? 'Light' : 'Dark')}</b>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>
      <p className="wrap fcopy">
        © {new Date().getFullYear()} AVORA. {t('All rights reserved.')}
      </p>
    </footer>
  );
}
