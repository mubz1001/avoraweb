import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { OrderConfirmation } from './OrderConfirmation';
import { ToastProvider } from '@/components/Toast';
import type { Booking, Order } from '@/types';

const usd = (amount: number) => ({ amount, currency: 'USD' as const });
const booking = (ref: string, name: string, status: Booking['status'], total: number): Booking =>
  ({
    ref,
    orderId: 'ord_1',
    status,
    property: { id: name, name, area: 'Hamar Weyne', city: 'Mogadishu', type: 'hotel', hue: 10, propertyType: 'Hotel' },
    trip: { type: 'hotel', city: 'Mogadishu', checkIn: '2099-10-15', checkOut: '2099-10-17', guests: 2, rooms: 1 },
    quote: {
      lines: [{ roomTypeId: 'd', name: 'Double Room', qty: 1, unitPrice: usd(total), total: usd(total) }],
      total: usd(total),
    },
    guest: { name: 'Amina Hassan', phone: '+252615550142', email: 'amina@example.com' },
    payment: { method: 'waafipay', brand: 'EVC Plus' },
    ...(status === 'failed' ? { refundedAt: '2099-01-01T00:00:00Z' } : {}),
  }) as unknown as Booking;

const order = (status: Order['status'], bookings: Booking[], refunded?: number): Order => ({
  id: 'ord_1',
  status,
  total: usd(bookings.reduce((n, b) => n + b.quote.total.amount, 0)),
  ...(refunded ? { refunded: usd(refunded) } : {}),
  payment: { method: 'waafipay', brand: 'EVC Plus', payPhoneMasked: '+252 61 *** 0142' },
  bookings,
  createdAt: '2099-01-01T00:00:00Z',
});

const view = (o: Order, member = false) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <OrderConfirmation order={o} member={member} />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('OrderConfirmation', () => {
  it('lists every booking with its own reference when all of them confirm', () => {
    view(
      order('confirmed', [
        booking('AV-AAAAAA', 'Jazeera', 'confirmed', 20400),
        booking('AV-BBBBBB', 'Lido', 'confirmed', 30000),
      ]),
    );
    expect(screen.getByRole('heading', { name: 'Bookings confirmed' })).toBeInTheDocument();
    expect(screen.getByText('AV-AAAAAA')).toBeInTheDocument();
    expect(screen.getByText('AV-BBBBBB')).toBeInTheDocument();
    expect(screen.queryByText('Refunded')).toBeNull();
  });

  it('says so, and shows the refund, when one property could not confirm: never "confirmed"', () => {
    view(
      order(
        'partially_confirmed',
        [booking('AV-AAAAAA', 'Jazeera', 'confirmed', 20400), booking('AV-BBBBBB', 'Lido', 'failed', 30000)],
        30000,
      ),
    );
    expect(screen.getByRole('heading', { name: 'Some of your bookings couldn’t be confirmed' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Bookings? confirmed$/ })).toBeNull();
    const lido = screen.getByRole('heading', { name: 'Lido' }).closest('.card') as HTMLElement;
    expect(within(lido).getByText('Not confirmed · refunded')).toBeInTheDocument();
    expect(within(lido).queryByText('AV-BBBBBB')).toBeNull(); // a booking that didn't confirm has no reference to show
    expect(screen.getByText('AV-AAAAAA')).toBeInTheDocument();
    expect(screen.getAllByText('$300').length).toBeGreaterThan(0);
  });

  it('says nothing was booked when no property confirmed', () => {
    view(order('failed', [booking('AV-AAAAAA', 'Jazeera', 'failed', 20400)], 20400));
    expect(screen.getByRole('heading', { name: 'Your bookings couldn’t be confirmed' })).toBeInTheDocument();
    expect(screen.queryByText('AV-AAAAAA')).toBeNull();
  });

  it('gives members a link to each confirmed booking and guests none', () => {
    const o = order('confirmed', [
      booking('AV-AAAAAA', 'Jazeera', 'confirmed', 20400),
      booking('AV-BBBBBB', 'Lido', 'confirmed', 30000),
    ]);
    const { unmount } = view(o, true);
    expect(screen.getAllByRole('link', { name: 'View booking' })).toHaveLength(2);
    unmount();
    view(o, false);
    expect(screen.queryByRole('link', { name: 'View booking' })).toBeNull();
    expect(screen.getByText('Create an account to manage your bookings')).toBeInTheDocument();
  });

  it('never says "confirmed" while the payment is still pending', () => {
    view(order('pending_payment', [booking('AV-AAAAAA', 'Jazeera', 'pending_payment', 20400)]), true);
    expect(screen.getByRole('heading', { name: 'Waiting for your payment' })).toBeInTheDocument();
    expect(screen.queryByText(/confirmed/i)).toBeNull();
    expect(screen.queryByText('AV-AAAAAA')).toBeNull();
  });

  it('says a failed payment booked and charged nothing, and points back to checkout', () => {
    view(order('payment_failed', [booking('AV-AAAAAA', 'Jazeera', 'payment_failed', 20400)]), true);
    expect(screen.getByRole('heading', { name: 'Your payment didn’t go through' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to checkout' })).toHaveAttribute('href', '/checkout');
    expect(screen.queryByText(/confirmed/i)).toBeNull();
  });
});
