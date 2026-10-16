/** Somali mobile numbers: 9 digits starting with 6 or 7, shown as "61 555 0142"; sent as E.164 "+252…". */
export function phoneDigits(v: string): string {
  let d = String(v).replace(/\D/g, '');
  if (d.startsWith('252')) d = d.slice(3);
  return d.replace(/^0+/, '');
}

export const phoneOk = (v: string) => /^[67]\d{8}$/.test(phoneDigits(v));

export function phoneFmt(v: string): string {
  const d = phoneDigits(v);
  return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : v;
}

export const toE164 = (v: string) => '+252' + phoneDigits(v);

/** Country calling codes by ISO 3166-1 alpha-2 code: every country and territory that has one. Names come from the
 *  browser (`Intl.DisplayNames`), so the list needs no translations of its own. Shared codes (+1, +44, +7…) repeat. */
const DIAL: Record<string, string> = {
  AF: '93',
  AX: '358',
  AL: '355',
  DZ: '213',
  AS: '1',
  AD: '376',
  AO: '244',
  AI: '1',
  AG: '1',
  AR: '54',
  AM: '374',
  AW: '297',
  AU: '61',
  AT: '43',
  AZ: '994',
  BS: '1',
  BH: '973',
  BD: '880',
  BB: '1',
  BY: '375',
  BE: '32',
  BZ: '501',
  BJ: '229',
  BM: '1',
  BT: '975',
  BO: '591',
  BQ: '599',
  BA: '387',
  BW: '267',
  BR: '55',
  IO: '246',
  VG: '1',
  BN: '673',
  BG: '359',
  BF: '226',
  BI: '257',
  CV: '238',
  KH: '855',
  CM: '237',
  CA: '1',
  KY: '1',
  CF: '236',
  TD: '235',
  CL: '56',
  CN: '86',
  CX: '61',
  CC: '61',
  CO: '57',
  KM: '269',
  CG: '242',
  CD: '243',
  CK: '682',
  CR: '506',
  CI: '225',
  HR: '385',
  CU: '53',
  CW: '599',
  CY: '357',
  CZ: '420',
  DK: '45',
  DJ: '253',
  DM: '1',
  DO: '1',
  EC: '593',
  EG: '20',
  SV: '503',
  GQ: '240',
  ER: '291',
  EE: '372',
  SZ: '268',
  ET: '251',
  FK: '500',
  FO: '298',
  FJ: '679',
  FI: '358',
  FR: '33',
  GF: '594',
  PF: '689',
  GA: '241',
  GM: '220',
  GE: '995',
  DE: '49',
  GH: '233',
  GI: '350',
  GR: '30',
  GL: '299',
  GD: '1',
  GP: '590',
  GU: '1',
  GT: '502',
  GG: '44',
  GN: '224',
  GW: '245',
  GY: '592',
  HT: '509',
  HN: '504',
  HK: '852',
  HU: '36',
  IS: '354',
  IN: '91',
  ID: '62',
  IR: '98',
  IQ: '964',
  IE: '353',
  IM: '44',
  IL: '972',
  IT: '39',
  JM: '1',
  JP: '81',
  JE: '44',
  JO: '962',
  KZ: '7',
  KE: '254',
  KI: '686',
  XK: '383',
  KW: '965',
  KG: '996',
  LA: '856',
  LV: '371',
  LB: '961',
  LS: '266',
  LR: '231',
  LY: '218',
  LI: '423',
  LT: '370',
  LU: '352',
  MO: '853',
  MG: '261',
  MW: '265',
  MY: '60',
  MV: '960',
  ML: '223',
  MT: '356',
  MH: '692',
  MQ: '596',
  MR: '222',
  MU: '230',
  YT: '262',
  MX: '52',
  FM: '691',
  MD: '373',
  MC: '377',
  MN: '976',
  ME: '382',
  MS: '1',
  MA: '212',
  MZ: '258',
  MM: '95',
  NA: '264',
  NR: '674',
  NP: '977',
  NL: '31',
  NC: '687',
  NZ: '64',
  NI: '505',
  NE: '227',
  NG: '234',
  NU: '683',
  NF: '672',
  KP: '850',
  MK: '389',
  MP: '1',
  NO: '47',
  OM: '968',
  PK: '92',
  PW: '680',
  PS: '970',
  PA: '507',
  PG: '675',
  PY: '595',
  PE: '51',
  PH: '63',
  PL: '48',
  PT: '351',
  PR: '1',
  QA: '974',
  RE: '262',
  RO: '40',
  RU: '7',
  RW: '250',
  BL: '590',
  SH: '290',
  KN: '1',
  LC: '1',
  MF: '590',
  PM: '508',
  VC: '1',
  WS: '685',
  SM: '378',
  ST: '239',
  SA: '966',
  SN: '221',
  RS: '381',
  SC: '248',
  SL: '232',
  SG: '65',
  SX: '1',
  SK: '421',
  SI: '386',
  SB: '677',
  SO: '252',
  ZA: '27',
  KR: '82',
  SS: '211',
  ES: '34',
  LK: '94',
  SD: '249',
  SR: '597',
  SJ: '47',
  SE: '46',
  CH: '41',
  SY: '963',
  TW: '886',
  TJ: '992',
  TZ: '255',
  TH: '66',
  TL: '670',
  TG: '228',
  TK: '690',
  TO: '676',
  TT: '1',
  TN: '216',
  TR: '90',
  TM: '993',
  TC: '1',
  TV: '688',
  UG: '256',
  UA: '380',
  AE: '971',
  GB: '44',
  US: '1',
  UY: '598',
  UZ: '998',
  VU: '678',
  VA: '39',
  VE: '58',
  VN: '84',
  VI: '1',
  WF: '681',
  EH: '212',
  YE: '967',
  ZM: '260',
  ZW: '263',
};

export const SOMALIA = 'SO';

/** The countries people most often call from, in this order, shown first and again in the full list. */
export const COMMON_COUNTRIES = ['SO', 'KE', 'US', 'GB', 'CA'] as const;

export interface Country {
  /** ISO 3166-1 alpha-2: what the form stores (several countries share a calling code). */
  iso: string;
  dial: string;
  name: string;
}

const names = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const countryOf = (iso: string): Country => ({ iso, dial: DIAL[iso]!, name: names?.of(iso) ?? iso });

export const commonCountries: Country[] = COMMON_COUNTRIES.map(countryOf);
/** Every country, A–Z by name. */
export const allCountries: Country[] = Object.keys(DIAL)
  .map(countryOf)
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** The calling code of a country (Somalia's when the code is unknown). */
export const dialOf = (iso: string) => DIAL[iso] ?? DIAL[SOMALIA]!;

/** When a calling code is shared, an E.164 number is taken to be from this country. */
const PRIMARY: Record<string, string> = {
  '1': 'US',
  '44': 'GB',
  '7': 'RU',
  '358': 'FI',
  '47': 'NO',
  '590': 'GP',
  '262': 'RE',
  '599': 'CW',
  '212': 'MA',
  '39': 'IT',
  '61': 'AU',
};
const byDial = new Map<string, string>();
for (const [iso, dial] of Object.entries(DIAL)) if (!byDial.has(dial) || PRIMARY[dial] === iso) byDial.set(dial, iso);
const dialLengths = [...new Set(Object.values(DIAL).map((d) => d.length))].sort((a, b) => b - a);

const national = (v: string) => String(v).replace(/\D/g, '').replace(/^0+/, '');

/** How many digits follow the calling code (no leading 0) for countries whose length is fixed; the field stops
 *  accepting digits there. Others take up to 12 (the longest the validation allows). */
const NATIONAL_DIGITS: Record<string, number> = {
  SO: 9,
  KE: 9,
  ET: 9,
  UG: 9,
  TZ: 9,
  DJ: 8,
  ER: 7,
  US: 10,
  CA: 10,
  GB: 10,
  AE: 9,
  SA: 9,
  QA: 8,
  EG: 10,
  TR: 10,
};
export const phoneMaxDigits = (iso: string) => NATIONAL_DIGITS[iso] ?? 12;

/** The number as typed, cut off once it holds all the digits its country has (spaces, a leading 0 or a pasted +252
 *  don't count). */
export function capPhone(iso: string, v: string): string {
  const count = iso === SOMALIA ? phoneDigits : national;
  let out = String(v);
  if (count(out).length <= phoneMaxDigits(iso)) return out;
  while (out && count(out).length > phoneMaxDigits(iso)) out = out.slice(0, -1);
  return out.trimEnd();
}

/** A number for any country: Somalia keeps its own rules, others need 6–12 digits after the code. */
export const phoneOkFor = (iso: string, v: string) => (iso === SOMALIA ? phoneOk(v) : /^\d{6,12}$/.test(national(v)));

/** E.164 for a country and the number as typed. */
export const toE164For = (iso: string, v: string) => (iso === SOMALIA ? toE164(v) : `+${dialOf(iso)}${national(v)}`);

/** Splits an E.164 number into its country and the number to show in the field (Somali numbers grouped). A calling code
 *  several countries share (+1, +44…) gives the main one of them. */
export function splitE164(e164: string): { country: string; number: string } {
  const digits = String(e164).replace(/\D/g, '');
  for (const len of dialLengths) {
    const iso = byDial.get(digits.slice(0, len));
    if (iso) {
      const rest = digits.slice(len);
      return { country: iso, number: iso === SOMALIA ? phoneFmt(rest) : rest };
    }
  }
  return { country: SOMALIA, number: phoneFmt(e164) };
}

/** Whether a full E.164 number (as sent to the API) is acceptable. */
export const e164Ok = (v: string) => {
  const { country, number } = splitE164(v);
  return /^\+\d+$/.test(v) && phoneOkFor(country, number) && '+' + dialOf(country) + national(number) === v;
};

export const phoneMsgFor = (iso: string, v: string) =>
  phoneOkFor(iso, v)
    ? ''
    : iso === SOMALIA
      ? 'Enter a 9-digit Somali mobile number starting with 6 or 7, e.g. 61 555 0142.'
      : 'Enter your mobile number without the country code.';
