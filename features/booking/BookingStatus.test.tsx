import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { BookingStatus } from './BookingStatus';
import type { Booking } from '@/types';

const usd = (amount: number) => ({ amount, currency: 'USD' as const });
const booking = (status: Booking['status']) =>
  ({
    ref: 'AV-AAAAAA',
    orderId: 'ord_1',
    status,
    property: {
      id: 'j',
      name: 'Jazeera',
      area: 'Hamar Weyne',
      city: 'Mogadishu',
      type: 'hotel',
      hue: 10,
      propertyType: 'Hotel',
    },
    trip: { type: 'hotel', city: 'Mogadishu', checkIn: '2099-10-15', checkOut: '2099-10-17', guests: 2, rooms: 1 },
    quote: { lines: [], total: usd(20400) },
    guest: { name: 'Amina Hassan', phone: '+252615550142' },
    payment: { method: 'waafipay' },
  }) as unknown as Booking;

const view = (b: Booking, onRefresh?: () => void) =>
  render(
    <MemoryRouter>
      <BookingStatus booking={b} onRefresh={onRefresh} />
    </MemoryRouter>,
  );

describe('BookingStatus', () => {
  it.each([
    ['pending_payment', 'Waiting for your payment'],
    ['payment_failed', 'Your payment didn’t go through'],
    ['failed', 'This booking couldn’t be confirmed'],
    ['cancelled', 'This booking was cancelled'],
  ] as const)('names a %s booking honestly', (status, title) => {
    view(booking(status));
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /booking confirmed/i })).toBeNull();
  });

  it('lets the guest check a pending payment again', async () => {
    const onRefresh = vi.fn();
    view(booking('pending_payment'), onRefresh);
    screen.getByRole('button', { name: 'Check again' }).click();
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
