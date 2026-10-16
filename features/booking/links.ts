import { config } from '@/lib/config';
import type { BookingProperty } from '@/types';

/** Directions open Google Maps; contacting the hotel opens WhatsApp with the booking reference prefilled. */
export const directionsUrl = (p: Pick<BookingProperty, 'name' | 'address'>) =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.name}, ${p.address}`);

export const contactUrl = (p: Pick<BookingProperty, 'whatsapp'>, ref: string) =>
  `https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hello, my AVORA booking reference is ' + ref)}`;

/** Changes and questions about a booking go to AVORA's customer service on WhatsApp, not to the hotel. */
export const supportUrl = (ref: string) =>
  `https://wa.me/${config.whatsapp}?text=${encodeURIComponent('Hello, my AVORA booking reference is ' + ref)}`;

export const bookingHref = (ref: string) => `/bookings/${encodeURIComponent(ref)}`;
