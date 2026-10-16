/** Where a "next" parameter may send the user after signing in. Only same-site app paths pass: no scheme, host, `//`
 *  or backslash, so a crafted link can never redirect off-site. Auth pages are excluded to avoid redirect loops. */
export const DEFAULT_NEXT = '/account/bookings';

const ROUTES: RegExp[] = [
  /^\/$/,
  /^\/search$/,
  /^\/stays\/[\w-]+(\/reviews)?$/,
  /^\/checkout$/,
  /^\/orders\/[\w-]+$/,
  /^\/bookings\/[A-Za-z0-9-]+$/,
  /^\/account(\/(bookings|favourites|payments|profile))?$/,
  /^\/legal\/(terms|privacy)$/,
];

const hasUnsafeChar = (v: string) => /[\s\\#]/.test(v) || [...v].some((c) => c.charCodeAt(0) < 32);

export function safeNext(value: string | null | undefined): string {
  if (!value || hasUnsafeChar(value) || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT;
  const [path = '', ...rest] = value.split('?');
  if (rest.length > 1 || !ROUTES.some((r) => r.test(path))) return DEFAULT_NEXT;
  return value;
}
