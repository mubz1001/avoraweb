import type { Property } from '@/types';

/** Google Maps embed for a property. `mapUrl` may be any Google Maps link (/maps/place/Name…, …@lat,lng…, …?query=…);
 *  the query is derived from it, falling back to "name, address". The keyless `output=embed` form needs no key;
 *  the Maps Embed API with a key is the faster, supported option. */
export function mapQuery(p: Pick<Property, 'mapUrl' | 'name' | 'address'>): string {
  const u = p.mapUrl ?? '';
  let m: RegExpMatchArray | null;
  if ((m = u.match(/\/maps\/place\/([^/@?]+)/))) return decodeURIComponent(m[1]!.replace(/\+/g, ' '));
  if ((m = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/))) return `${m[1]},${m[2]}`;
  if ((m = u.match(/[?&](?:query|q)=([^&]+)/))) return decodeURIComponent(m[1]!.replace(/\+/g, ' '));
  return `${p.name}, ${p.address}`;
}

export const mapEmbedUrl = (p: Pick<Property, 'mapUrl' | 'name' | 'address'>) =>
  `https://www.google.com/maps?q=${encodeURIComponent(mapQuery(p))}&output=embed`;
