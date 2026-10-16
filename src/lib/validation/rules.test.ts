import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phoneDigits, phoneFmt, phoneOk, toE164 } from '@/lib/phone';
import {
  cardBrand,
  cardExpired,
  cardMsg,
  cvcMsg,
  emailMsg,
  expMsg,
  luhn,
  nameMsg,
  pwMsg,
} from '@/lib/validation/rules';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
});
afterEach(() => vi.useRealTimers());

describe('phone', () => {
  it.each(['61 555 0142', '0615550142', '+252 61 555 0142', '252615550142', '615550142'])('accepts %s', (v) => {
    expect(phoneOk(v)).toBe(true);
    expect(phoneDigits(v)).toBe('615550142');
    expect(phoneFmt(v)).toBe('61 555 0142');
    expect(toE164(v)).toBe('+252615550142');
  });
  it.each(['', '12345', '515550142', '61555014', '6155501423'])('rejects %s', (v) => expect(phoneOk(v)).toBe(false));
});

describe('card', () => {
  it('validates Luhn', () => {
    expect(luhn('4242424242424242')).toBe(true);
    expect(luhn('4242424242424241')).toBe(false);
  });
  it('detects Visa and Mastercard incl. the 2221–2720 range', () => {
    expect(cardBrand('4242424242424242')).toBe('Visa');
    expect(cardBrand('5555555555554444')).toBe('Mastercard');
    expect(cardBrand('2221000000000009')).toBe('Mastercard');
    expect(cardBrand('2720990000000007')).toBe('Mastercard');
    expect(cardBrand('2220000000000000')).toBe('');
    expect(cardBrand('2721000000000000')).toBe('');
    expect(cardBrand('378282246310005')).toBe('');
  });
  it('requires 16 digits, a valid checksum and a known brand', () => {
    expect(cardMsg('4242 4242 4242 4242')).toBe('');
    expect(cardMsg('4242 4242 4242 4241')).not.toBe('');
    expect(cardMsg('3782 8224 6310 005')).not.toBe('');
  });
  it('treats a card as valid through the last day of its expiry month', () => {
    expect(cardExpired('10/26')).toBe(false);
    expect(cardExpired('09/26')).toBe(true);
    expect(expMsg('10/26')).toBe('');
    expect(expMsg('09/26')).toBe('This card has expired.');
    expect(expMsg('13/26')).toBe('Use MM/YY.');
  });
  it('checks CVC length', () => {
    expect(cvcMsg('123')).toBe('');
    expect(cvcMsg('1234')).toBe('');
    expect(cvcMsg('12')).not.toBe('');
  });
});

describe('text rules', () => {
  it('password: length, common list, not the email', () => {
    expect(pwMsg('short')).toBe('Use at least 8 characters.');
    expect(pwMsg('x'.repeat(129))).toBe('Use 128 characters or fewer.');
    expect(pwMsg('Password123')).toMatch(/too easy/);
    expect(pwMsg('a@b.example', 'A@B.example')).toMatch(/email/);
    expect(pwMsg('purple tractor lamp')).toBe('');
  });
  it('name: letters, spaces, apostrophes, hyphens; max 50', () => {
    expect(nameMsg('Amina', 'first name')).toBe('');
    expect(nameMsg("O'Neil-Smith", 'last name')).toBe('');
    expect(nameMsg('Zoë', 'first name')).toBe('');
    expect(nameMsg('', 'first name')).toBe('Enter your first name.');
    expect(nameMsg('R2D2', 'first name')).toBe('Use letters only.');
    expect(nameMsg('a'.repeat(51), 'first name')).toBe('Use 50 characters or fewer.');
  });
  it('email', () => {
    expect(emailMsg('')).toBe('Enter your email address.');
    expect(emailMsg('nope')).toMatch(/doesn't look right/);
    expect(emailMsg(' a@b.co ')).toBe('');
  });
});
