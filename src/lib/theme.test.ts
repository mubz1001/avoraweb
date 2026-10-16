import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initTheme, resolveTheme } from './theme';
import { writeLocalValue } from './useLocalValue';
import { storageKeys } from './storage';

let dark = false;
let onChange: (() => void) | null = null;

beforeEach(() => {
  dark = false;
  onChange = null;
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_: string, cb: () => void) => (onChange = cb),
    removeEventListener: () => (onChange = null),
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('theme', () => {
  it('resolves explicit choices over the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('defaults to the system and ignores junk values', () => {
    dark = true;
    expect(applyTheme()).toBe('dark');
    localStorage.setItem(storageKeys.theme, '"purple"');
    expect(applyTheme()).toBe('dark');
  });

  it('applies a saved explicit preference to <html>', () => {
    dark = true;
    localStorage.setItem(storageKeys.theme, '"light"');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows a preference change and OS changes in System mode, without a reload', () => {
    const stop = initTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
    writeLocalValue(storageKeys.theme, 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    writeLocalValue(storageKeys.theme, 'system');
    expect(document.documentElement.dataset.theme).toBe('light');
    dark = true;
    onChange?.();
    expect(document.documentElement.dataset.theme).toBe('dark');
    stop();
  });
});
