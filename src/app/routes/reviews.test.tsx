import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component as ReviewsPage } from './reviews';
import { ApiError } from '@/lib/api/client';
import { catalogApi } from '@/lib/api/endpoints';
import type { Property, Review } from '@/types';

vi.mock('@/lib/api/endpoints', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/endpoints')>()),
  catalogApi: { property: vi.fn(), reviews: vi.fn() },
}));
const property = vi.mocked(catalogApi.property);
const reviews = vi.mocked(catalogApi.reviews);

const review = (id: string, over: Partial<Review> = {}): Review => ({
  id,
  firstName: 'Amina',
  roomTypeName: 'Double Room',
  nights: 2,
  stayMonth: '2026-09',
  postedAt: '2026-09-20T10:00:00Z',
  score: 5,
  title: 'Lovely stay',
  text: 'Spotless room and kind staff.',
  topics: [],
  ...over,
});

const hotel = {
  id: 'nugaal',
  type: 'hotel',
  name: 'Nugaal Hotel',
  area: 'Hodan',
  city: 'Mogadishu',
  reviewSummary: { count: 12, score: 4.6, label: 'Excellent', topics: [] },
} as unknown as Property;

const view = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/stays/nugaal/reviews']}>
        <Routes>
          <Route path="/stays/:id/reviews" element={<ReviewsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  property.mockReset().mockResolvedValue(hotel);
  reviews.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('reviews page', () => {
  it('shows skeletons while loading, then the reviews', async () => {
    let done!: (v: Awaited<ReturnType<typeof catalogApi.reviews>>) => void;
    reviews.mockReturnValue(new Promise((r) => (done = r)));
    view();
    await vi.waitFor(() => expect(document.querySelector('.rv-list[aria-busy="true"]')).not.toBeNull());
    expect(document.querySelector('.rv-list .sk, .rv-list [aria-hidden]')).not.toBeNull();
    done({ items: [review('r1')], total: 1, nextCursor: null });
    expect(await screen.findByText('Spotless room and kind staff.')).toBeInTheDocument();
  });

  it('says the filters matched nothing, which is not a failed request', async () => {
    reviews.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    view();
    expect(await screen.findByText('No reviews match these filters')).toBeInTheDocument();
    expect(screen.queryByText('We couldn’t load reviews.')).toBeNull();
  });

  it('says the request failed, and retries', async () => {
    reviews.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'x')).mockResolvedValueOnce({
      items: [review('r1')],
      total: 1,
      nextCursor: null,
    });
    const user = userEvent.setup();
    view();
    expect(await screen.findByText('We couldn’t load reviews.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Spotless room and kind staff.')).toBeInTheDocument();
  });

  it('keeps the loaded reviews and offers a retry when "Show more" fails', async () => {
    reviews
      .mockResolvedValueOnce({ items: [review('r1')], total: 2, nextCursor: 'c2' })
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'x'))
      .mockResolvedValueOnce({
        items: [review('r2', { text: 'Second page review text.' })],
        total: 2,
        nextCursor: null,
      });
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByRole('button', { name: 'Show more reviews' }));
    expect(await screen.findByText('We couldn’t load more reviews.')).toBeInTheDocument();
    expect(screen.getByText('Spotless room and kind staff.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more reviews' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Second page review text.')).toBeInTheDocument();
    expect(reviews).toHaveBeenCalledTimes(3);
  });

  it('renders reviews with missing optional parts and markup-like text as plain text', async () => {
    reviews.mockResolvedValue({
      items: [
        review('r1', { firstName: '', title: '', text: '<img src=x onerror=alert(1)> <b>bold</b>' }),
        review('r2', { firstName: 'A'.repeat(80), text: 'u'.repeat(300) }),
      ],
      total: 2,
      nextCursor: null,
    });
    view();
    expect(await screen.findByText('<img src=x onerror=alert(1)> <b>bold</b>')).toBeInTheDocument();
    expect(document.querySelector('.rv-p img, .rv-p b')).toBeNull();
    expect(screen.getByText('u'.repeat(300))).toBeInTheDocument();
  });

  it('hides the summary when the property has none', async () => {
    property.mockResolvedValue({ ...hotel, reviewSummary: undefined } as unknown as Property);
    reviews.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    view();
    expect(await screen.findByText('No reviews yet')).toBeInTheDocument();
    expect(screen.queryByText(/undefined|NaN/)).toBeNull();
  });
});
