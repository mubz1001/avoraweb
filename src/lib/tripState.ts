import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { local, storageKeys } from '@/lib/storage';
import { parseTrip, serializeTrip } from '@/lib/trip';
import type { Trip } from '@/types';

/** The trip travels in the URL (shareable, survives refresh); the last one searched is remembered on the device as a
 *  convenience default (`avora.trip`). */
export function useTrip(): Trip {
  const [params] = useSearchParams();
  const key = params.toString();
  return useMemo(() => parseTrip(new URLSearchParams(key), local.get<Partial<Trip>>(storageKeys.trip, {})), [key]);
}

export const saveTrip = (trip: Trip) => local.set(storageKeys.trip, trip);

export const searchHref = (trip: Trip, extra?: Record<string, string>) => `/search?${serializeTrip(trip, extra)}`;
export const propertyHref = (id: string, trip: Trip, extra?: Record<string, string>) =>
  `/stays/${encodeURIComponent(id)}?${serializeTrip(trip, extra)}`;
export const reviewsHref = (id: string, trip: Trip, extra?: Record<string, string>) =>
  `/stays/${encodeURIComponent(id)}/reviews?${serializeTrip(trip, extra)}`;
/** Checkout pays for the whole basket (every stay in it), so it needs no property or trip of its own. */
export const CHECKOUT_HREF = '/checkout';
