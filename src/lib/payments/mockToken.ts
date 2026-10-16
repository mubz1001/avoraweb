/** Mock card-token format shared by the in-browser "hosted fields" and the mock server. A real provider SDK returns an
 *  opaque token plus display metadata; here the metadata rides inside the token so the mock server can read it back.
 *  Format: tok_<Brand>_<last4>_<MMYY>_<random>. The card number and CVC are never part of it. */
export interface CardToken {
  token: string;
  brand: 'Visa' | 'Mastercard';
  last4: string;
  expMonth: number;
  expYear: number;
}

export function makeCardToken(brand: CardToken['brand'], last4: string, expMonth: number, expYear: number): CardToken {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(16).padStart(2, '0')).join('');
  const token = `tok_${brand}_${last4}_${String(expMonth).padStart(2, '0')}${String(expYear % 100).padStart(2, '0')}_${rand}`;
  return { token, brand, last4, expMonth, expYear };
}

export function readCardToken(token: string): CardToken | null {
  const m = /^tok_(Visa|Mastercard)_(\d{4})_(\d{2})(\d{2})_[0-9a-f]{12}$/.exec(token);
  if (!m) return null;
  return {
    token,
    brand: m[1] as CardToken['brand'],
    last4: m[2] as string,
    expMonth: Number(m[3]),
    expYear: 2000 + Number(m[4]),
  };
}
