import { afterEach, describe, expect, it } from 'vitest';
import { getLang, initLang, plural, setLang, t } from './index';

afterEach(async () => {
  await setLang('en');
  localStorage.clear();
});

describe('i18n', () => {
  it('shows English by default and falls back to English for strings without a translation', async () => {
    await initLang();
    expect(getLang()).toBe('en');
    expect(t('Search')).toBe('Search');
    await setLang('so');
    expect(t('Search')).toBe('Raadi');
    expect(t('A string nobody translated')).toBe('A string nobody translated');
  });

  it('fills placeholders and translates plural nouns', async () => {
    await setLang('ar');
    expect(t('Pay {total} now', { total: '$204' })).toBe('ادفع $204 الآن');
    expect(plural(2, 'night')).toBe('2 ليالٍ');
    await setLang('en');
    expect(plural(1, 'guest')).toBe('1 guest');
    expect(plural(3, 'guest')).toBe('3 guests');
  });

  it('sets the page language and direction, and remembers the choice', async () => {
    await setLang('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    await setLang('so');
    expect(document.documentElement.dir).toBe('ltr');
    await initLang();
    expect(getLang()).toBe('so');
  });
});
