import { useSyncExternalStore } from 'react';
import { storageKeys } from '@/lib/storage';
import { readLocalValue, writeLocalValue } from '@/lib/useLocalValue';

/** Translations for the core screens. The English text is the key, so a string that has no translation simply shows in
 *  English. `{name}` placeholders are filled from `vars`. Hotel names, descriptions, legal pages and other content that
 *  comes from the API or is long-form stay in English. */
export type Lang = 'en' | 'so' | 'ar';

export const LANGS: readonly { code: Lang; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'so', label: 'Soomaali', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

type Dict = Record<string, string>;

/** Somali and Arabic are separate chunks, fetched when chosen: an English visit never downloads them. */
const DICTS: Partial<Record<Lang, Dict>> = { en: {} };
const LOADERS: Record<Exclude<Lang, 'en'>, () => Promise<Dict>> = {
  so: () => import('./so').then((m) => m.so),
  ar: () => import('./ar').then((m) => m.ar),
};

/** Fetches a language's strings once; false when the chunk can't be loaded (offline), so the caller keeps its text. */
async function load(lang: Lang): Promise<boolean> {
  if (DICTS[lang]) return true;
  try {
    DICTS[lang] = await LOADERS[lang as Exclude<Lang, 'en'>]();
    return true;
  } catch {
    return false;
  }
}

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'so' || v === 'ar';

let current: Lang = 'en';
const listeners = new Set<() => void>();

export const getLang = () => current;

/** Translates an English UI string into the current language (English when there is no translation). */
export function t(text: string, vars?: Record<string, string | number | undefined>): string {
  const out = DICTS[current]?.[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m)) : out;
}

/** "2 guests" / "1 room": the noun is translated; English adds an "s" unless told otherwise. */
export const plural = (n: number, word: string, pluralWord?: string) =>
  `${n} ${n === 1 ? t(word) : t(pluralWord ?? word + 's')}`;

/** Sets `lang` and `dir` on <html> so text direction, hyphenation and screen readers follow the language. */
function applyLang(lang: Lang) {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = LANGS.find((l) => l.code === lang)?.dir ?? 'ltr';
}

/** Switches once the strings are in; the last request wins when several overlap. */
let request = 0;
async function switchTo(lang: Lang): Promise<boolean> {
  const id = ++request;
  if (!(await load(lang)) || id !== request) return false;
  current = lang;
  applyLang(lang);
  listeners.forEach((l) => l());
  return true;
}

let following = false;

/** Reads the saved language and applies it; main.tsx waits for it before the first render (instant for English). */
export async function initLang() {
  const saved = readLocalValue<unknown>(storageKeys.lang, 'en');
  if (!(await switchTo(isLang(saved) ? saved : 'en'))) await switchTo('en');
  if (following) return;
  following = true;
  // another tab changed it: follow (the layout re-renders from useLang)
  window.addEventListener('storage', (e) => {
    if (e.key !== storageKeys.lang) return;
    const next = readLocalValue<unknown>(storageKeys.lang, 'en');
    void switchTo(isLang(next) ? next : 'en');
  });
}

/** Changes the language: the strings below read `current` at render time, and the layout re-renders from useLang.
 *  Somali and Arabic load first (one small chunk), so the page never shows a half-translated frame. */
export async function setLang(lang: Lang) {
  if (!(await switchTo(lang))) return;
  // the page fades in again in the new language (see .lang-switch in shell.css)
  const root = document.documentElement;
  root.classList.add('lang-switch');
  window.setTimeout(() => root.classList.remove('lang-switch'), 400);
  writeLocalValue(storageKeys.lang, lang);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
