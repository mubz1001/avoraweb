import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchForm } from './SearchForm';
import type { Trip } from '@/types';

const trip: Trip = {
  type: 'hotel',
  city: 'Mogadishu',
  checkIn: '2026-10-20',
  checkOut: '2026-10-22',
  guests: 2,
  rooms: 1,
};

describe('SearchForm, instant', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('has no button and applies a burst of changes once, 250ms after the last', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    render(<SearchForm trip={trip} hideCity instant onSubmit={onSubmit} />);
    expect(screen.queryByRole('button', { name: /update|search/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Guests & rooms' }));
    await user.click(screen.getByRole('button', { name: 'More guests' }));
    await user.click(screen.getByRole('button', { name: 'More guests' }));
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]![0].trip).toMatchObject({ guests: 4, rooms: 1, checkIn: '2026-10-20' });
  });

  it('drops a pending change when the form goes away', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    const { unmount } = render(<SearchForm trip={trip} hideCity instant onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Guests & rooms' }));
    await user.click(screen.getByRole('button', { name: 'More guests' }));
    unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the Search button everywhere else', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SearchForm trip={trip} onSubmit={() => {}} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });
});
