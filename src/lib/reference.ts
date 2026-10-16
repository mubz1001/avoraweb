/** Stable reference data (docs/06 §7). Keys are stable; labels are English copy. */
export const CITIES = ['Mogadishu', 'Hargeisa', 'Garowe'] as const;

export const HOTEL_AMENITIES: Record<string, string> = {
  wifi: 'Free Wi-Fi',
  ac: 'Air conditioning',
  bf: 'Breakfast included',
  park: 'Free parking',
  power: '24h backup power',
  rest: 'Restaurant',
  shuttle: 'Airport shuttle',
  beach: 'Beach access',
  sec: '24/7 security',
  lift: 'Elevator',
  prayer: 'Prayer room',
  family: 'Family rooms',
};

export const HALL_AMENITIES: Record<string, string> = {
  stage: 'Stage & sound system',
  cater: 'Catering available',
  park: 'Free parking',
  ac: 'Air conditioning',
  power: '24h backup power',
  bride: 'Bridal suite',
  sec: '24/7 security',
  decor: 'Decoration service',
};

export const GALLERY_LABELS = {
  hotel: ['Exterior', 'Lobby', 'Guest room', 'Bathroom', 'Restaurant'],
  hall: ['Main hall', 'Garden', 'Stage', 'Entrance', 'Dining area'],
} as const;
