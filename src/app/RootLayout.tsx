import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useMatches, useNavigation } from 'react-router';
import { Fragment } from 'react';
import { Footer, Header } from './shell/Shell';
import { FavouritesPrompt } from '@/components/FavouriteHeart';
import './shell/shell.css';
import { t, useLang } from '@/lib/i18n';
import { preloadWhenIdle } from '@/lib/prefetch';
import { useSessionSync } from '@/lib/session';
import './layout.css';

/** Route `handle` flags read by the layout. */
export interface RouteHandle {
  /** The page has a fixed bottom bar (property page), so the footer leaves room for it. */
  stickyBar?: boolean;
}

export function RootLayout() {
  const lang = useLang();
  useSessionSync();
  const matches = useMatches();
  const navigation = useNavigation();
  const stickyBar = matches.some((m) => (m.handle as RouteHandle | undefined)?.stickyBar);
  // Most visits go home → search → a listing: have those chunks ready before the first tap.
  useEffect(() => preloadWhenIdle(['/search', '/stays/_']), []);

  // A new language remounts the page so every string is read again.
  return (
    <Fragment key={lang}>
      <a className="skip" href="#main">
        {t('Skip to content')}
      </a>
      <div
        className={['navbar-progress', navigation.state !== 'idle' && 'on'].filter(Boolean).join(' ')}
        aria-hidden="true"
      />
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer roomForStickyBar={stickyBar} />
      <FavouritesPrompt />
      <ScrollRestoration />
    </Fragment>
  );
}

/** Shown for the instant the root loader resolves the session on first load: the header bar, so nothing jumps. */
export function BootShell() {
  return (
    <header className="hdr" aria-busy="true">
      <div className="wrap" />
    </header>
  );
}
