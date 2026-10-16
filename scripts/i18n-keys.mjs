/* Lists every string passed to t('…') / t("…") in src, plus the plural() nouns, and reports which ones a language file
 * is missing. Usage: node scripts/i18n-keys.mjs [so|ar]   (no argument: print all keys as JSON). */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });

const keys = new Set();
const unescape = (s) => s.replace(/\\(['"\\])/g, '$1');
for (const file of walk('src')) {
  if (file.includes(join('src', 'lib', 'i18n'))) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(unescape(m[1]));
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(unescape(m[1]));
  for (const m of src.matchAll(/\bplural\([^,]+,\s*'([^']+)'(?:,\s*'([^']+)')?\)/g)) {
    keys.add(m[1]);
    keys.add(m[2] ?? m[1] + 's');
  }
}
// dates.ts and the calendar translate these names at render time
for (const k of 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec January February March April May June July August September October November December Sun Mon Tue Wed Thu Fri Sat Mo Tu We Th Fr Sa Su'.split(' '))
  keys.add(k);
// nav.ts labels and other values translated through t(variable)
for (const k of ['Search', 'Wedding halls', 'My bookings', 'Favourites', 'Payment methods', 'Profile', 'List your property', 'Support', 'Sort: Recommended', 'Price: low to high', 'Price: high to low', 'Guest rating', 'Hotel', 'Guesthouse', 'Apartments', 'stays', 'halls', 'day', 'night', 'Waiting for your payment', 'Your payment didn’t go through', 'This booking couldn’t be confirmed', 'This booking was cancelled', 'View all your bookings', 'Upcoming and past stays in one place, on any device. No reference numbers to keep.', 'Manage payment methods', 'Save EVC Plus, ZAAD, SAHAL, eDahab or a card once, then pay in one tap.', 'Leave reviews', 'Share how your stay went and help other travellers choose with confidence.', 'Join the best platform', 'Trusted stays across Somalia, free cancellation on most bookings and local support on WhatsApp.', 'Free Wi-Fi', 'Air conditioning', 'Breakfast included', 'Free parking', '24h backup power', 'Restaurant', 'Airport shuttle', 'Beach access', '24/7 security', 'Elevator', 'Prayer room', 'Family rooms', 'Exceptional', 'Excellent', 'Very good', 'Good', 'Okay', 'Poor'])
  keys.add(k);

const lang = process.argv[2];
if (!lang) {
  console.log(JSON.stringify([...keys].sort(), null, 1));
} else {
  const dict = readFileSync(`src/lib/i18n/${lang}.ts`, 'utf8');
  const have = new Set([...dict.matchAll(/^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[A-Za-z]+):/gm)].map((m) => unescape(m[1].replace(/^['"]|['"]$/g, ''))));
  const missing = [...keys].filter((k) => !have.has(k));
  console.log(missing.length ? missing.join('\n') : `${lang}: all ${keys.size} strings translated`);
  process.exitCode = missing.length ? 1 : 0;
}
