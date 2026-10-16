import { describe, expect, it } from 'vitest';
import { DEFAULT_NEXT, safeNext } from '@/lib/safeNext';

describe('safeNext', () => {
  it.each([
    '/',
    '/search?city=Garowe&guests=2',
    '/stays/jazeera',
    '/stays/jazeera/reviews?sort=new',
    '/checkout',
    '/orders/ord_a1b2c3',
    '/bookings/AV-5JPF4P',
    '/account',
    '/account/payments',
    '/legal/terms',
  ])('allows %s', (v) => expect(safeNext(v)).toBe(v));
  it.each([
    '//evil.example',
    '//evil.example/account',
    'https://evil.example',
    'javascript:alert(1)',
    '/\\evil.example',
    '/account/unknown',
    '/signin',
    '/stays/a/b/c',
    '/account#x',
    '/account\n/x',
    'account/bookings',
    '',
    null,
    undefined,
  ])('rejects %s', (v) => expect(safeNext(v as string | null | undefined)).toBe(DEFAULT_NEXT));
});
