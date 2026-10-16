import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { SearchSubmit } from './SearchForm';
import { propertyHref, saveTrip, searchHref } from '@/lib/tripState';

/** Submitting a search remembers the trip, then opens the picked property directly or the results page. */
export function useGoSearch() {
  const navigate = useNavigate();
  return useCallback(
    ({ trip, propertyId }: SearchSubmit) => {
      saveTrip(trip);
      void navigate(propertyId ? propertyHref(propertyId, trip) : searchHref(trip));
    },
    [navigate],
  );
}
