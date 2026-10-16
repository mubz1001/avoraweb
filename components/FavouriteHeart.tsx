import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from './ConfirmDialog';
import { HeartButton } from './Controls';
import { useToast } from './Toast';
import { useFavourites } from '@/lib/favourites';
import { useAuthHref } from '@/lib/session';
import { t } from '@/lib/i18n';

/** One shared "sign in to save" prompt for every heart on the page (a guest tapping any heart opens it). */
let promptOpen = false;
const listeners = new Set<() => void>();
const setPrompt = (open: boolean) => {
  promptOpen = open;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Heart wired to your favourites. Every heart for the same stay reads the same list, so duplicates on a page stay in
 *  step. Guests have no favourites: tapping it asks them to sign in (`FavouritesPrompt`). */
export function FavouriteHeart({ id, floating = true }: { id: string; floating?: boolean }) {
  const favs = useFavourites();
  const toast = useToast();
  return (
    <HeartButton
      on={favs.has(id)}
      floating={floating}
      onToggle={() => {
        if (!favs.signedIn) return setPrompt(true);
        toast(favs.toggle(id) ? 'Added to favourites' : 'Removed from favourites');
      }}
    />
  );
}

/** Mounted once in the root layout: the dialog behind every guest heart. Returns to the page after sign-up or sign-in. */
export function FavouritesPrompt() {
  const open = useSyncExternalStore(
    subscribe,
    () => promptOpen,
    () => false,
  );
  const navigate = useNavigate();
  const authHref = useAuthHref();
  const close = () => setPrompt(false);
  return (
    <ConfirmDialog
      open={open}
      title={t('Sign in to save favourites')}
      confirmLabel="Sign in"
      onConfirm={() => {
        close();
        void navigate(authHref('signin'));
      }}
      altLabel="Create account"
      onAlt={() => {
        close();
        void navigate(authHref('signup'));
      }}
      onCancel={close}
    >
      <p>{t('You need an account to save a hotel to favourites.')}</p>
    </ConfirmDialog>
  );
}
