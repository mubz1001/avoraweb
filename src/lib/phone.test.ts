import { describe, expect, it } from 'vitest';
import {
  allCountries,
  capPhone,
  commonCountries,
  dialOf,
  e164Ok,
  phoneMsgFor,
  phoneOkFor,
  splitE164,
  toE164For,
} from '@/lib/phone';

describe('guest phone numbers', () => {
  it('keeps the Somali rules for +252', () => {
    expect(phoneOkFor('SO', '61 555 0142')).toBe(true);
    expect(phoneOkFor('SO', '51 555 0142')).toBe(false);
    expect(toE164For('SO', '061 555 0142')).toBe('+252615550142');
  });
  it('accepts 6-12 digits for other countries, ignoring a leading zero', () => {
    expect(phoneOkFor('GB', '07700 900123')).toBe(true);
    expect(toE164For('GB', '07700 900123')).toBe('+447700900123');
    expect(phoneOkFor('KE', '12345')).toBe(false);
    expect(phoneMsgFor('KE', '123')).toMatch(/without the country code/);
  });
  it('splits an E.164 number into its listed country and the number to show', () => {
    expect(splitE164('+252615550142')).toEqual({ country: 'SO', number: '61 555 0142' });
    expect(splitE164('+447700900123')).toEqual({ country: 'GB', number: '7700900123' });
    expect(splitE164('+12025550123')).toEqual({ country: 'US', number: '2025550123' });
  });
  it('validates a whole E.164 number the way the server does', () => {
    expect(e164Ok('+252615550142')).toBe(true);
    expect(e164Ok('+447700900123')).toBe(true);
    expect(e164Ok('+252515550142')).toBe(false);
    expect(e164Ok('615550142')).toBe(false);
    expect(e164Ok('+99912345678')).toBe(false);
  });
  it('offers every country, with the most common first: Somalia, Kenya, United States, United Kingdom, Canada', () => {
    expect(commonCountries.map((c) => c.iso)).toEqual(['SO', 'KE', 'US', 'GB', 'CA']);
    expect(commonCountries.map((c) => c.dial)).toEqual(['252', '254', '1', '44', '1']);
    expect(allCountries.length).toBeGreaterThan(220);
    // Alphabetical, the common ones included, and each country once.
    const names = allCountries.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(new Set(allCountries.map((c) => c.iso)).size).toBe(allCountries.length);
    for (const c of commonCountries) expect(allCountries.map((a) => a.iso)).toContain(c.iso);
    expect(allCountries.every((c) => /^\d{1,3}$/.test(c.dial))).toBe(true);
  });
  it('tells countries that share a calling code apart, and sends the right number for each', () => {
    expect(dialOf('US')).toBe(dialOf('CA'));
    expect(toE164For('CA', '(416) 555-0123')).toBe('+14165550123');
    expect(toE164For('JM', '8765550123')).toBe('+18765550123');
    expect(toE164For('AU', '0412 345 678')).toBe('+61412345678');
    expect(e164Ok('+14165550123')).toBe(true);
    expect(e164Ok('+61412345678')).toBe(true);
    expect(splitE164('+14165550123').country).toBe('US'); // +1 alone can't say Canada: the main country is shown
    expect(splitE164('+4915112345678')).toEqual({ country: 'DE', number: '15112345678' });
    expect(splitE164('+212612345678').country).toBe('MA'); // a 3-digit code wins over a shorter one (+20)
  });
});

describe('capPhone', () => {
  it('stops a Somali number at its 9 digits, whatever the spacing or prefix', () => {
    expect(capPhone('SO', '61 555 0142')).toBe('61 555 0142');
    expect(capPhone('SO', '61 555 01423')).toBe('61 555 0142');
    expect(capPhone('SO', '061 555 01429')).toBe('061 555 0142');
    expect(capPhone('SO', '+252 61 555 0142 7')).toBe('+252 61 555 0142');
    expect(capPhone('SO', '6155')).toBe('6155');
  });
  it('stops other countries at their own length, and at 12 digits where it is not fixed', () => {
    expect(capPhone('US', '2025550123')).toBe('2025550123');
    expect(capPhone('US', '20255501234')).toBe('2025550123');
    expect(capPhone('GB', '07700 900123 4')).toBe('07700 900123');
    expect(capPhone('DE', '1234567890123')).toBe('123456789012');
  });
});
