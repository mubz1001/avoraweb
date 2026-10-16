/** Storage never throws: private mode or blocked cookies make reads return the default and writes return false. */
export interface Store {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): boolean;
  del(key: string): void;
  take<T>(key: string, fallback: T): T;
}

export const makeStore = (area: () => Storage): Store => ({
  get(key, fallback) {
    try {
      const v = area().getItem(key);
      return v == null ? fallback : (JSON.parse(v) as typeof fallback);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      area().setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  del(key) {
    try {
      area().removeItem(key);
    } catch {
      /* storage unavailable */
    }
  },
  take(key, fallback) {
    const v = this.get(key, fallback);
    this.del(key);
    return v;
  },
});

export const local = makeStore(() => localStorage);
export const session = makeStore(() => sessionStorage);

export const storageKeys = {
  trip: 'avora.trip',
  lang: 'avora.lang',
  theme: 'avora.theme',
  receipt: 'avora.receipt',
  payment: 'avora.payment',
  reviewDrafts: 'avora.reviewDrafts',
  prefill: 'avora.prefill',
  basket: 'avora.basket',
} as const;
