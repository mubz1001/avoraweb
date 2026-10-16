import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BasketPanel } from './BasketPanel';
import { server } from '@/mocks/server';
import type { BasketStay } from '@/types';

const stay = (over: Partial<BasketStay>): BasketStay => ({
  propertyId: 'jazeera',
  type: 'hotel',
  checkIn: '2026-10-15',
  checkOut: '2026-10-17',
  guests: 2,
  rooms: 1,
  lines: [{ roomTypeId: 'double', qty: 1 }],
  updatedAt: '2026-10-12T15:00:00.000Z',
  ...over,
});
const stays = [
  stay({}),
  stay({ propertyId: 'lido', checkIn: '2026-10-20', checkOut: '2026-10-23', lines: [{ roomTypeId: 'suite', qty: 1 }] }),
];
const set = vi.fn();

vi.mock('@/lib/basket/useBasket', () => ({
  useBasket: () => ({
    basket: { stays, updatedAt: '2026-10-12T15:00:00.000Z' },
    stays,
    count: 2,
    loading: false,
    set,
    move: vi.fn(),
  }),
}));

function Harness() {
  const btn = useRef<HTMLButtonElement>(null);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <button ref={btn}>Basket</button>
        <BasketPanel id="b" open onClose={() => {}} trigger={btn} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
  set.mockClear();
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe('BasketPanel with stays at several hotels', () => {
  it('shows one section per hotel, each with its dates and rooms, and one total and one Checkout', async () => {
    render(<Harness />);
    const jazeera = await screen.findByRole('region', { name: 'Jazeera Palace Hotel' });
    const lido = await screen.findByRole('region', { name: /Lido/ });
    expect(within(jazeera).getByText(/Oct 15/)).toBeInTheDocument();
    expect(within(lido).getByText(/Oct 20/)).toBeInTheDocument();
    expect(within(jazeera).getByText('Double Room')).toBeInTheDocument();

    const checkout = await screen.findByRole('link', { name: /^Checkout ·/ });
    expect(screen.getAllByRole('link', { name: /^Checkout/ })).toHaveLength(1);
    expect(checkout).toHaveAttribute('href', '/checkout');
    expect(screen.getByText('Subtotal · 2 stays')).toBeInTheDocument();
  });

  it('takes a hotel out with its quantity picker, leaving the other alone', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole('region', { name: /Lido/ });
    await user.click(screen.getByRole('button', { name: /^Remove one .*Suite/ }));
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(stays[1], []);
  });
});
