import { useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Search params as page state, updated optimistically: a change shows immediately (checkboxes and radios never snap
 * back while the router commits the new URL) and is written with `replace`, so Back leaves the page instead of
 * stepping through filter states (docs/04 §A.4). Any URL change from elsewhere (Back/Forward, a link) wins.
 */
export function useUrlState(): [URLSearchParams, (changes: Record<string, string>) => void] {
  const [params, setParams] = useSearchParams();
  const committed = params.toString();
  const [pending, setPending] = useState<{ base: string; next: string } | null>(null);
  if (pending && pending.base !== committed) setPending(null); // the router committed (ours, or a Back/Forward)
  const effective = pending && pending.base === committed ? new URLSearchParams(pending.next) : params;

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(effective);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setPending({ base: committed, next: next.toString() });
    setParams(next, { replace: true, preventScrollReset: true });
  };
  return [effective, update];
}
