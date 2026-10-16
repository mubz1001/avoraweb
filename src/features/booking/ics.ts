import type { Booking } from '@/types';

/** iCalendar text values escape backslash, semicolon, comma and newlines (RFC 5545 §3.3.11). */
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** All-day event from check-in to check-out (docs/06 §5.3; the server can generate it instead). */
export function bookingIcs(b: Booking): string {
  const d = (s: string) => s.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AVORA//Bookings//EN',
    'BEGIN:VEVENT',
    `UID:${b.ref}@avora`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d(b.trip.checkIn)}`,
    `DTEND;VALUE=DATE:${d(b.trip.checkOut)}`,
    `SUMMARY:${text(`${b.property.name} (${b.ref})`)}`,
    `LOCATION:${text(b.property.address)}`,
    `DESCRIPTION:${text(`Booking ${b.ref}. Check-in from ${b.property.checkInFrom}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(b: Booking) {
  const url = URL.createObjectURL(new Blob([bookingIcs(b)], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `avora-${b.ref}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
