import phrases from './data/review-phrases.json';
import { addDays, iso, parseDate, today } from '@/lib/dates';
import type { PropertyType, Review, ReviewSummary } from '@/types';

/** Guest reviews, generated deterministically per property so every number shown (rating, count, topic counts) is
 *  derived from the same list. Mock server only: production reviews come from verified stays (docs/06 §3.7). */
type Phrases = {
  topics: [string, string][];
  liked: Record<string, string[]>;
  disliked: Record<string, string[]>;
  titles: Record<string, string[]>;
};
const P = phrases.RV as unknown as Record<PropertyType, Phrases>;
const NAMES = phrases.RV_NAMES as string[];

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hashStr = (str: string) => {
  let x = 2166136261;
  for (const ch of str) {
    x ^= ch.charCodeAt(0);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export const scoreLabel = (v: number): ReviewSummary['label'] =>
  v >= 4.7
    ? 'Exceptional'
    : v >= 4.4
      ? 'Excellent'
      : v >= 4.0
        ? 'Very good'
        : v >= 3.5
          ? 'Good'
          : v >= 3.0
            ? 'Okay'
            : 'Poor';

interface Seed {
  id: string;
  type: PropertyType;
  count: number;
  target: number | null;
  roomNames: string[];
}

export function buildReviews(h: Seed): Review[] {
  const T = P[h.type];
  const r = rng(hashStr(h.id));
  const pick = <X>(a: X[]): X => a[Math.floor(r() * a.length)] as X;
  const n = h.count;
  const target = h.target || 4.2;
  const tKeys = T.topics.map((x) => x[0] as string);
  const shuffle = <X>(a: X[]) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j] as X, b[i] as X];
    }
    return b;
  };
  const scores = Array.from({ length: n }, () =>
    Math.min(5, Math.max(1, Math.round(target + (r() + r() + r() - 1.5) * 1.4))),
  );
  if (n >= 3 && h.target) {
    for (let k = 0; k < 4000; k++) {
      const avg = scores.reduce((a, b) => a + b, 0) / n;
      if (Math.abs(avg - target) <= 0.04) break;
      const i = Math.floor(r() * n);
      if (avg < target && (scores[i] as number) < 5) scores[i] = (scores[i] as number) + 1;
      else if (avg > target && (scores[i] as number) > 1) scores[i] = (scores[i] as number) - 1;
    }
  }
  const todayIso = iso(today());
  const out = scores.map((score, i): Review => {
    const off = 2 + Math.floor(Math.pow(r(), 1.3) * 420);
    const nights = h.type === 'hall' ? 1 : 1 + Math.floor(r() * 5);
    const stayEnd = addDays(today(), -off);
    let posted = addDays(stayEnd, 1 + Math.floor(r() * 3));
    if (parseDate(posted) > today()) posted = todayIso;
    const nl = score >= 4 ? 2 + Math.floor(r() * 2) : score === 3 ? 1 + Math.floor(r() * 2) : Math.floor(r() * 2);
    const nd =
      score >= 5
        ? r() < 0.3
          ? 1
          : 0
        : score === 4
          ? r() < 0.6
            ? 1
            : 0
          : score === 3
            ? 1 + Math.floor(r() * 2)
            : 2 + Math.floor(r() * 2);
    const lk = shuffle(tKeys).slice(0, nl);
    const dk = shuffle(tKeys.filter((k) => !lk.includes(k))).slice(0, nd);
    const firstName = pick(NAMES);
    const roomTypeName = pick(h.roomNames);
    const title = pick(T.titles[String(score)] as string[]);
    const body = [
      ...lk.map((k) => pick(T.liked[k] as string[])),
      ...dk.map((k) => pick(T.disliked[k] as string[])),
    ].join(' ');
    const replies = r() < 0.35;
    const reply =
      score >= 4
        ? `Thank you ${firstName} for your kind words. We look forward to welcoming you again!`
        : `Thank you for your feedback, ${firstName}. We are sorry we did not meet your expectations and have shared your comments with our team.`;
    return {
      id: `${h.id}-${i + 1}`,
      firstName,
      roomTypeName,
      nights,
      stayMonth: stayEnd.slice(0, 7),
      postedAt: posted,
      score,
      title,
      text: body,
      topics: lk.concat(dk),
      ...(replies
        ? { response: { text: reply, postedAt: parseDate(posted) < today() ? addDays(posted, 1) : posted } }
        : {}),
    };
  });
  return out.sort((a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0));
}

export function summarize(reviews: Review[], type: PropertyType): ReviewSummary {
  const T = P[type];
  const n = reviews.length || 1;
  const avg = reviews.reduce((a, x) => a + x.score, 0) / n;
  return {
    count: reviews.length,
    score: round1(avg),
    label: scoreLabel(avg),
    topics: T.topics
      .map(([key, label]) => ({ key, label, count: reviews.filter((x) => x.topics.includes(key)).length }))
      .filter((x) => x.count),
  };
}
