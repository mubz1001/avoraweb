import { today } from '@/lib/dates';
import { phoneOk } from '@/lib/phone';

/** Each rule returns '' when valid, else the message shown under the field (copy: docs/01). */
export const normEmail = (v: string) =>
  String(v || '')
    .trim()
    .toLowerCase();
export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

export const phoneMsg = (v: string) =>
  phoneOk(v) ? '' : 'Enter a 9-digit Somali mobile number starting with 6 or 7, e.g. 61 555 0142.';

export const emailMsg = (v: string) =>
  !v.trim() ? 'Enter your email address.' : emailOk(v) ? '' : "That email doesn't look right.";

export function nameMsg(v: string, what: string): string {
  const s = v.trim();
  if (!s) return `Enter your ${what}.`;
  if (s.length > 50) return 'Use 50 characters or fewer.';
  return /^[\p{L}\p{M}' .-]+$/u.test(s) ? '' : 'Use letters only.';
}

export const fullNameMsg = (v: string) => (v.trim().length >= 3 ? '' : 'Enter your full name.');

const COMMON_PW = [
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  '11111111',
  'iloveyou',
  'avora123',
  'somalia1',
  'mogadishu',
];

/** The length rule is shown once, as the hint under a new-password field; when it is broken the hint itself turns red
 *  (see `PasswordField`) instead of a second line repeating it. */
export const PW_HINT = 'At least 8 characters.';
export const PW_SHORT_MSG = 'Use at least 8 characters.';

export function pwMsg(v: string, email?: string): string {
  if (v.length < 8) return PW_SHORT_MSG;
  if (v.length > 128) return 'Use 128 characters or fewer.';
  if (COMMON_PW.includes(v.toLowerCase())) return 'That password is too easy to guess. Try a short phrase.';
  if (email && v.toLowerCase() === normEmail(email)) return "Don't use your email as your password.";
  return '';
}

/** The "type it again" field next to a new password. */
export const confirmMsg = (password: string, again: string) =>
  !again ? 'Confirm your password.' : again === password ? '' : 'Passwords don’t match.';

export const cardDigits = (v: string) => String(v).replace(/\D/g, '');

export function luhn(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function cardBrand(d: string): 'Visa' | 'Mastercard' | '' {
  const p = Number(d.slice(0, 4));
  if (d.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(d) || (p >= 2221 && p <= 2720)) return 'Mastercard';
  return '';
}

/** A card is valid through the last day of MM/YY. */
export function cardExpired(exp: string): boolean {
  const [mm = 0, yy = 0] = exp.split('/').map(Number);
  return new Date(2000 + yy, mm, 1) <= today();
}

export const cardMsg = (v: string) => {
  const d = cardDigits(v);
  return d.length === 16 && luhn(d) && cardBrand(d) ? '' : 'Enter a valid 16-digit Visa or Mastercard number.';
};

export function expMsg(v: string): string {
  const m = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(v.trim());
  if (!m) return 'Use MM/YY.';
  return cardExpired(`${m[1]}/${m[2]}`) ? 'This card has expired.' : '';
}

export const cvcMsg = (v: string) => (/^\d{3,4}$/.test(v.trim()) ? '' : '3–4 digits.');

export const REVIEW_TEXT = { min: 30, max: 2000 } as const;

export function reviewTextMsg(v: string): string {
  const n = v.trim().length;
  if (!n) return 'Enter your review.';
  if (n < REVIEW_TEXT.min) return `Tell us a little more: at least ${REVIEW_TEXT.min} characters.`;
  return n > REVIEW_TEXT.max ? `Keep it under ${REVIEW_TEXT.max.toLocaleString('en-US')} characters.` : '';
}
