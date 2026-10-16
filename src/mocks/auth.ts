import { db, rid, save, type PwdRecord, type UserRec } from './db';
import { methodExpired as expired } from '@/lib/payments/methods';
import type { Member, SavedPaymentMethod } from '@/types';

/** The account service the real backend would be. Keeps the real rules: passwords stored only as PBKDF2-SHA256 hashes
 *  with a per-user salt, constant-time comparison, a miss on an unknown email still hashes (no timing oracle), five
 *  failed sign-ins lock that email for five minutes, sessions expire. Production: Argon2id and an HttpOnly cookie. */
export const PBKDF2_ITER = 600_000;
export const SESSION_MS = 30 * 864e5;
export const MAX_FAILS = 5;
export const LOCK_MS = 5 * 60e3;

const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function pwHash(pw: string, salt?: Uint8Array, iter = PBKDF2_ITER): Promise<PwdRecord> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: s.buffer as ArrayBuffer, iterations: iter },
    key,
    256,
  );
  return { s: b64(s), h: b64(new Uint8Array(bits)), i: iter };
}

const sameStr = (a: string, b: string) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};

/** Always hashes, even for an unknown email, so a miss takes as long as a wrong password. */
export async function pwCheck(pw: string, rec: PwdRecord | null | undefined): Promise<boolean> {
  const x = await pwHash(pw, rec ? unb64(rec.s) : undefined, rec ? rec.i : undefined);
  return !!rec && sameStr(x.h, rec.h);
}

export const findByEmail = (email: string) => db().users.find((u) => u.email === email);

export function currentUser(): UserRec | null {
  const s = db().session;
  if (!s) return null;
  const u = s.exp > Date.now() ? db().users.find((x) => x.id === s.uid) : undefined;
  if (!u) {
    db().session = null;
    save();
    return null;
  }
  return u;
}

export function startSession(u: UserRec): UserRec {
  db().session = { uid: u.id, exp: Date.now() + SESSION_MS };
  save();
  return u;
}

export const endSession = () => {
  db().session = null;
  save();
};

export const toMember = (u: UserRec): Member => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  phone: u.phone,
  phoneVerified: false,
  hasPassword: !!u.pwd,
  providers: u.providers,
  ...(u.defaultMethodId ? { defaultPaymentMethodId: u.defaultMethodId } : {}),
  createdAt: u.createdAt,
});

export const toMethod = (m: UserRec['methods'][number]): SavedPaymentMethod => {
  const { token: _token, ...rest } = m;
  void _token;
  return rest;
};

export const methodExpired = (m: SavedPaymentMethod) => expired(m);

export const newUser = (
  d: { firstName: string; lastName: string; email: string; phone: string },
  extra: Partial<UserRec> = {},
): UserRec => ({
  id: rid('u'),
  firstName: d.firstName.trim(),
  lastName: d.lastName.trim(),
  email: d.email.trim().toLowerCase(),
  phone: d.phone,
  pwd: null,
  providers: [],
  methods: [],
  defaultMethodId: '',
  favourites: [],
  createdAt: new Date().toISOString(),
  ...extra,
});

export function putUser(u: UserRec) {
  const list = db().users;
  const i = list.findIndex((x) => x.id === u.id);
  if (i < 0) list.push(u);
  else list[i] = u;
  save();
}
