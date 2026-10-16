import { useCallback, useSyncExternalStore } from 'react';
import { local } from '@/lib/storage';

/** A localStorage value as React state: every hook using the same key updates together, in this tab (custom event)
 *  and in other tabs (storage event). Reads never throw; a failed write keeps the in-memory value for this session. */
const EVENT = 'avora:local';
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    /* storage blocked */
  }
  return memory.get(key) ?? null;
}

export function useLocalValue<T>(key: string, fallback: T): [T, (next: T) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      const onLocal = (e: Event) => {
        if ((e as CustomEvent<string>).detail === key) cb();
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) cb();
      };
      window.addEventListener(EVENT, onLocal);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(EVENT, onLocal);
        window.removeEventListener('storage', onStorage);
      };
    },
    [key],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  const set = useCallback((next: T) => writeLocalValue(key, next), [key]);
  return [value, set];
}

/** Writes a key and notifies hooks reading it (also usable outside React). */
export function writeLocalValue(key: string, next: unknown) {
  if (!local.set(key, next)) memory.set(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/** The current value of a key, as the hooks see it (including the in-memory copy when storage is blocked). */
export function readLocalValue<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Clears a key and notifies hooks reading it. */
export function clearLocalValue(key: string) {
  local.del(key);
  memory.delete(key);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}
