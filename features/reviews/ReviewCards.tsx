import { AppLink } from '@/components/AppLink';
import { Avatar, ScoreChip } from '@/components/Controls';
import { fmtMonthYear, fmtPosted } from '@/lib/dates';
import { plural } from '@/lib/money';
import type { Review, ReviewSummary } from '@/types';
import './reviews.css';
import { t } from '@/lib/i18n';

/** Stable colour per reviewer name. */
export const nameHue = (name: string) => {
  let x = 2166136261;
  for (const ch of name) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return (x >>> 0) % 360;
};

/** Score badge + label + count (docs/05 ReviewSummary). */
export function ReviewScore({ summary, big }: { summary: ReviewSummary; big?: boolean }) {
  return (
    <div className={['rv-head', big && 'big'].filter(Boolean).join(' ')}>
      <span className="score">{summary.score.toFixed(1)}</span>
      <div className="grow">
        <b className="rv-label">{t(summary.label)}</b>
        <div className="muted small">{plural(summary.count, 'review')}</div>
      </div>
    </div>
  );
}

/** Carousel card on the property page; the whole card opens the review on the reviews page. */
export function ReviewCompact({ review: r, href }: { review: Review; href: string }) {
  return (
    <AppLink className="rvc" to={href} aria-label={t('Read {name}’s full review', { name: r.firstName })}>
      <div className="rvc-top">
        <Avatar name={r.firstName} hue={nameHue(r.firstName)} />
        <div className="grow">
          <b>{r.firstName}</b>
        </div>
        <ScoreChip score={r.score} />
      </div>
      <b className="rvc-t">{r.title}</b>
      <p className="rvc-x">{r.text}</p>
      <span className="rvc-more">{t('Read more')}</span>
    </AppLink>
  );
}

interface FullProps {
  review: Review;
  propertyName: string;
  hall: boolean;
  highlight?: boolean;
}

/** Full review on the reviews page (docs/05 ReviewCard). */
export function ReviewFull({ review: r, propertyName, hall, highlight }: FullProps) {
  return (
    <article className={['card rv', highlight && 'flash'].filter(Boolean).join(' ')} id={r.id}>
      <div className="rvc-top">
        <Avatar name={r.firstName} hue={nameHue(r.firstName)} />
        <div className="grow">
          <b>{r.firstName}</b>
        </div>
        <ScoreChip score={r.score} />
      </div>
      <div className="muted small rv-meta">
        {r.roomTypeName} · {plural(r.nights, hall ? 'day' : 'night')} · {fmtMonthYear(r.stayMonth + '-01')}
      </div>
      <h3 className="rv-t">{r.title}</h3>
      <div className="muted tiny">Reviewed {fmtPosted(r.postedAt)}</div>
      <p className="rv-p">{r.text}</p>
      {r.response ? (
        <details className="resp">
          <summary>Response from {propertyName}</summary>
          <p>{r.response.text}</p>
        </details>
      ) : null}
    </article>
  );
}
