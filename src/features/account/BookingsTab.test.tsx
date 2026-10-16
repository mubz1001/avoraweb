import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingsTab } from './BookingsTab';
import { ToastProvider } from '@/components/Toast';
import { ApiError } from '@/lib/api/client';
import { accountApi } from '@/lib/api/endpoints';
import type { Booking, Member } from '@/types';

vi.mock('@/lib/api/endpoints', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/endpoints')>()),
  accountApi: { bookings: vi.fn() },
}));

const stay = (ref: string, name: string, status: Booking['status'], checkIn: string, checkOut: string) =>
  ({
    ref,
    status,
    property: { id: ref, name, area: 'Hodan', city: 'Mogadishu', type: 'hotel', hue: 10, propertyType: 'Hotel' },
    trip: { type: 'hotel', city: 'Mogadishu', checkIn, checkOut, guests: 2, rooms: 1 },
    quote: { lines: [], total: { amount: 1000, currency: 'USD' } },
  }) as unknown as Booking;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0));
  vi.mocked(accountApi.bookings).mockResolvedValue({
    upcoming: [stay('AV-UP', 'Upcoming Inn', 'confirmed', '2026-10-20', '2026-10-22')],
    past: [
      stay('AV-DONE', 'Finished Hotel', 'confirmed', '2026-10-01', '2026-10-03'),
      stay('AV-CXL', 'Cancelled Lodge', 'cancelled', '2026-10-01', '2026-10-03'),
    ],
  });
});
afterEach(() => vi.useRealTimers());

const view = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>
          <BookingsTab member={{ id: 'u1' } as Member} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );

describe('BookingsTab review action', () => {
  it('is offered only on a finished, confirmed stay', async () => {
    view();
    expect(await screen.findByText('Finished Hotel')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /Write a review/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('Write a review of Finished Hotel');
  });

  it('does not offer a review on an upcoming, cancelled or already-reviewed stay', async () => {
    vi.mocked(accountApi.bookings).mockResolvedValue({
      upcoming: [stay('AV-UP', 'Upcoming Inn', 'confirmed', '2026-10-20', '2026-10-22')],
      past: [
        stay('AV-CXL', 'Cancelled Lodge', 'cancelled', '2026-10-01', '2026-10-03'),
        stay('AV-PAY', 'Unpaid Place', 'payment_failed', '2026-10-01', '2026-10-03'),
        {
          ...stay('AV-REV', 'Reviewed Hotel', 'confirmed', '2026-10-01', '2026-10-03'),
          review: { score: 5, postedAt: '2026-10-04T10:00:00Z' },
        } as Booking,
      ],
    });
    view();
    expect(await screen.findByText('Reviewed Hotel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Write a review/ })).toBeNull();
    expect(screen.getByText('Review sent')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
  });

  it('shows the loading, empty and failed states', async () => {
    const bookings = vi.mocked(accountApi.bookings);
    bookings.mockReturnValue(new Promise(() => {}));
    const { unmount } = view();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    unmount();

    bookings.mockResolvedValue({ upcoming: [], past: [] });
    const second = view();
    expect(await screen.findByRole('heading', { name: 'No bookings yet' })).toBeInTheDocument();
    second.unmount();

    bookings.mockRejectedValue(new ApiError(400, 'VALIDATION_FAILED', 'x'));
    view();
    expect(await screen.findByText('We couldn’t load your bookings.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('BookingsTab rebook action', () => {
  it('is offered only on a finished, confirmed stay, and opens the hotel with the same trip', async () => {
    view();
    expect(await screen.findByText('Finished Hotel')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /^Rebook/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('Rebook Finished Hotel');
  });
});
