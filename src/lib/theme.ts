import { readLocalValue, useLocalValue } from '@/lib/useLocalValue';
import { storageKeys } from '@/lib/storage';

/** Appearance preference: Light and Dark are explicit; System follows the operating system and updates live. The
 *  resolved theme is the `data-theme` attribute on <html>, which tokens.css reads; index.html applies it before the
 *  first paint (same key, same JSON encoding) so there is no flash of the wrong theme. */
export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const themePrefs: readonly ThemePref[] = ['system', 'light', 'dark'];

const QUERY = '(prefers-color-scheme: dark)';

const isPref = (v: unknown): v is ThemePref => v === 'system' || v === 'light' || v === 'dark';

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia(QUERY).matches;

export function applyTheme(): Theme {
  const stored = readLocalValue<unknown>(storageKeys.theme, 'system');
  const theme = resolveTheme(isPref(stored) ? stored : 'system', systemDark());
  document.documentElement.dataset.theme = theme;
  return theme;
}

/** Applies the theme now and keeps it current: preference changes (this tab or another) and OS changes. */
export function initTheme(): () => void {
  applyTheme();
  const onLocal = (e: Event) => {
    if ((e as CustomEvent<string>).detail === storageKeys.theme) applyTheme();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKeys.theme || e.key === null) applyTheme();
  };
  const mq = typeof matchMedia === 'function' ? matchMedia(QUERY) : null;
  window.addEventListener('avora:local', onLocal);
  window.addEventListener('storage', onStorage);
  mq?.addEventListener('change', applyTheme);
  return () => {
    window.removeEventListener('avora:local', onLocal);
    window.removeEventListener('storage', onStorage);
    mq?.removeEventListener('change', applyTheme);
  };
}

export function useThemePref(): [ThemePref, (next: ThemePref) => void] {
  const [raw, set] = useLocalValue<unknown>(storageKeys.theme, 'system');
  return [isPref(raw) ? raw : 'system', set];
}
