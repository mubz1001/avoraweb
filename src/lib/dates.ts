import { t } from '@/lib/i18n';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const mon = (i: number) => t(MON[i]!);
const WD3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 864e5;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local midnight today. A function (not a constant) so a tab left open past midnight stays correct. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD in local time. */
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDate(s: string): Date {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const isIsoDate = (s: string | null | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(parseDate(s)) === s;

export function addDays(s: string | Date, n: number): string {
  const d = typeof s === 'string' ? parseDate(s) : new Date(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export const nightsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((+parseDate(b) - +parseDate(a)) / DAY_MS));
export const daysFromToday = (s: string) => Math.round((+parseDate(s) - +today()) / DAY_MS);

export function fmtDay(s: string): string {
  const d = parseDate(s);
  return `${mon(d.getMonth())} ${d.getDate()}`;
}

export function fmtRange(a: string, b: string): string {
  const x = parseDate(a);
  const y = parseDate(b);
  return x.getMonth() === y.getMonth()
    ? `${mon(x.getMonth())} ${x.getDate()}–${y.getDate()}`
    : `${fmtDay(a)} – ${fmtDay(b)}`;
}

export function fmtWeekday(s: string): string {
  const d = parseDate(s);
  return `${t(WD3[d.getDay()]!)}, ${mon(d.getMonth())} ${d.getDate()}`;
}

export const fmtMonthYear = (s: string) => {
  const d = parseDate(s);
  return `${t(MON_FULL[d.getMonth()]!)} ${d.getFullYear()}`;
};

export const fmtPosted = (s: string) => {
  const d = parseDate(s);
  return `${mon(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
};

export const monthName = (m: number) => t(MON_FULL[m] ?? '');
