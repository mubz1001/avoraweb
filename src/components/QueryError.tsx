import { Button } from './Button';
import { errorMessage } from '@/lib/api/errors';
import { t } from '@/lib/i18n';

/** Inline error with Retry for a failed query (docs/06 §8). Never loses what the user typed: it replaces only the
 *  region whose data failed. */
export function QueryError({
  error,
  onRetry,
  title = t('We couldn’t load this.'),
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <div className="card retry" role="alert">
      <h2>{title}</h2>
      <p className="muted small" style={{ margin: 0 }}>
        {errorMessage(error)}
      </p>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        {t('Try again')}
      </Button>
    </div>
  );
}
