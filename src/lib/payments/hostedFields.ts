import { makeCardToken, type CardToken } from './mockToken';
import { cardBrand, cardDigits } from '@/lib/validation/rules';

/**
 * Card tokenization: the stand-in for the payment provider's hosted fields / SDK (docs/06 §6). It turns what was typed
 * into a provider token plus display data; the card number and CVC go no further than this function and are never
 * sent to AVORA's API, logged or stored. Production: replace with the provider SDK (inputs rendered in its iframes).
 */
export async function tokenizeCard(input: { number: string; exp: string; cvc: string }): Promise<CardToken> {
  const digits = cardDigits(input.number);
  const brand = cardBrand(digits);
  const [mm = 0, yy = 0] = input.exp.split('/').map((x) => Number(x.trim()));
  if (!brand || digits.length !== 16 || !mm || !/^\d{3,4}$/.test(input.cvc.trim()))
    throw new Error('Card details were rejected by the payment provider.');
  await new Promise((r) => setTimeout(r, 150));
  return makeCardToken(brand, digits.slice(-4), mm, 2000 + yy);
}

/** Input masks for the card fields. */
export const formatCardNumber = (v: string) =>
  cardDigits(v)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
export function formatExpiry(v: string) {
  const d = cardDigits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
