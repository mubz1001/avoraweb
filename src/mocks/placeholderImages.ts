import type { PropertyImage } from '@/types';

/** Placeholder photos for the mock catalog: `public/placeholder/<kind>-<n>-<width>.webp` (free Pexels photos at 480, 800 and 1200 px,
 *  made by scripts/make-photos.mjs), served from the site's own origin. A real backend returns real photos in the same `PropertyImage` shape. */
const COUNT = { exterior: 3, lobby: 3, room: 5, bathroom: 2, restaurant: 3 } as const;
type Kind = keyof typeof COUNT;

const ALT: Record<Kind, string> = {
  exterior: 'The hotel building',
  lobby: 'The lobby',
  room: 'A guest room',
  bathroom: 'A bathroom',
  restaurant: 'The restaurant',
};

/** The order the property page's gallery shows them in (lib/reference GALLERY_LABELS). */
const GALLERY: Kind[] = ['exterior', 'lobby', 'room', 'bathroom', 'restaurant'];

/** A stable number per property, so a hotel always gets the same photos. */
const seed = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const WIDTHS = [480, 800, 1200];

const photo = (kind: Kind, n: number): PropertyImage => {
  const base = `/placeholder/${kind}-${(n % COUNT[kind]) + 1}`;
  return {
    url: `${base}-1200.webp`,
    srcset: WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(', '),
    alt: ALT[kind],
    width: 1200,
    height: 800,
  };
};

/** A hotel's gallery: exterior, lobby, room, bathroom, restaurant (the first is the card photo). */
export const galleryImages = (id: string): PropertyImage[] => GALLERY.map((kind, i) => photo(kind, seed(id) + i));

/** A room type's photo; the room types of one hotel get different ones. */
export const roomImage = (id: string, index: number): PropertyImage => photo('room', seed(id) + 1 + index);
