import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewDialog } from './ReviewDialog';
import { ToastProvider } from '@/components/Toast';
import { ApiError } from '@/lib/api/client';
import { accountApi } from '@/lib/api/endpoints';
import { readReviewDraft, saveReviewDraft } from '@/lib/reviewDrafts';
import type { Booking } from '@/types';

vi.mock('@/lib/api/endpoints', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/endpoints')>()),
  accountApi: { submitReview: vi.fn() },
}));
const send = vi.mocked(accountApi.submitReview);

const booking = {
  ref: 'AV-TEST01',
  status: 'confirmed',
  property: {
    id: 'nugaal',
    name: 'Nugaal Hotel',
    area: 'Hodan',
    city: 'Mogadishu',
    type: 'hotel',
    hue: 30,
    propertyType: 'Hotel',
  },
  trip: { type: 'hotel', city: 'Mogadishu', checkIn: '2026-10-01', checkOut: '2026-10-03', guests: 2, rooms: 1 },
  quote: { lines: [{ roomTypeId: 'double', qty: 1, name: 'Double Room' }] },
} as unknown as Booking;

const TEXT = 'The room was spotless and the staff were wonderful throughout.';

function setup() {
  const cb = { onClose: vi.fn(), onReviewed: vi.fn() };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <ReviewDialog booking={booking} memberId="u1" {...cb} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), ...cb };
}

const fill = async (user: ReturnType<typeof userEvent.setup>, text = TEXT, stars = '4 stars, Very good') => {
  await user.click(screen.getByRole('radio', { name: stars }));
  await user.type(screen.getByLabelText('Your review'), text);
};
const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Submit review' }));

beforeEach(() => {
  send.mockReset();
  sessionStorage.clear();
  // jsdom has no modal <dialog>.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ReviewDialog', () => {
  it('names the stay being reviewed', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Review your stay' })).toBeInTheDocument();
    expect(screen.getByText('Nugaal Hotel')).toBeInTheDocument();
    expect(screen.getByText('Hodan, Mogadishu')).toBeInTheDocument();
    expect(screen.getByText('AV-TEST01')).toBeInTheDocument();
  });

  it('asks for a rating and enough text before sending, and clears the errors once fixed', async () => {
    const { user } = setup();
    await submit(user);
    expect(await screen.findByText('Choose a star rating.')).toBeInTheDocument();
    expect(screen.getByText('Enter your review.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your review'), 'Too short');
    expect(await screen.findByText(/at least 30 characters\./)).toBeInTheDocument();
    expect(screen.getByLabelText('Your review')).toBeInvalid();
    await user.type(screen.getByLabelText('Your review'), ' and now it is long enough to send.');
    await user.click(screen.getByRole('radio', { name: '3 stars, Good' }));
    expect(screen.queryByText('Choose a star rating.')).toBeNull();
    expect(screen.queryByText(/at least 30 characters\./, { selector: '.msg' })).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('treats whitespace as no review', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: '4 stars, Very good' }));
    await user.type(screen.getByLabelText('Your review'), ' '.repeat(40));
    await submit(user);
    expect(await screen.findByText('Enter your review.')).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it('counts characters and refuses text over the limit', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: '4 stars, Very good' }));
    const box = screen.getByLabelText('Your review');
    await user.click(box);
    await user.paste('x'.repeat(2001));
    expect(screen.getByText('2,001 / 2,000')).toBeInTheDocument();
    await submit(user);
    expect(await screen.findByText(/under 2,000 characters/)).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends emoji and international text as typed (trimmed)', async () => {
    send.mockResolvedValue(undefined);
    const { user } = setup();
    const text = '😊 Très bien, 很好, مرحبا — a lovely stay with kind staff.';
    await fill(user, `  ${text}  `);
    await submit(user);
    await screen.findByText('Thanks for your review');
    expect(send).toHaveBeenCalledWith('AV-TEST01', { score: 4, text }, expect.any(String));
  });

  it('sends the rating and text, then confirms and forgets the draft', async () => {
    send.mockResolvedValue(undefined);
    const { user, onReviewed } = setup();
    await fill(user);
    expect(readReviewDraft('u1', 'AV-TEST01')).toEqual({ score: 4, text: TEXT });
    await submit(user);
    await screen.findByText('Thanks for your review');
    expect(send).toHaveBeenCalledWith('AV-TEST01', { score: 4, text: TEXT }, expect.any(String));
    expect(onReviewed).toHaveBeenCalledWith('AV-TEST01');
    expect(screen.getByText(/once it’s been checked/)).toBeInTheDocument();
    expect(readReviewDraft('u1', 'AV-TEST01')).toBeUndefined();
  });

  it('sends once however many times the button is pressed', async () => {
    let finish!: () => void;
    send.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { user } = setup();
    await fill(user);
    const button = screen.getByRole('button', { name: 'Submit review' });
    await user.dblClick(button);
    await user.keyboard('{Enter}');
    expect(send).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    finish();
    await screen.findByText('Thanks for your review');
  });

  it('shows one calm message after no answer, keeps the review and the same key', async () => {
    send.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline')).mockResolvedValueOnce(undefined);
    const { user } = setup();
    await fill(user);
    await submit(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('There was an unexpected error posting your review');
    expect(alert).toHaveTextContent('Please try again later.');
    expect(screen.getByLabelText('Your review')).toHaveValue(TEXT);
    expect(screen.getByRole('radio', { name: '4 stars, Very good' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled();
    await submit(user);
    await screen.findByText('Thanks for your review');
    expect(send.mock.calls[1]![2]).toBe(send.mock.calls[0]![2]);
  });

  it('treats a timeout and a server error the same way', async () => {
    send
      .mockRejectedValueOnce(new ApiError(0, 'TIMEOUT', 'slow'))
      .mockRejectedValueOnce(new ApiError(503, 'INTERNAL', 'x'));
    const { user } = setup();
    await fill(user);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('There was an unexpected error posting your review');
    await submit(user);
    await screen.findByText('There was an unexpected error posting your review', { exact: false });
    expect(send.mock.calls[1]![2]).toBe(send.mock.calls[0]![2]);
  });

  it('starts a new key after the server gives a definite answer, and keeps the draft', async () => {
    send.mockRejectedValueOnce(new ApiError(422, 'VALIDATION_FAILED', 'x')).mockResolvedValueOnce(undefined);
    const { user } = setup();
    await fill(user);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your rating and review');
    expect(screen.getByLabelText('Your review')).toHaveValue(TEXT);
    await submit(user);
    await screen.findByText('Thanks for your review');
    expect(send.mock.calls[1]![2]).not.toBe(send.mock.calls[0]![2]);
  });

  it('says so when the stay was already reviewed', async () => {
    send.mockRejectedValue(new ApiError(409, 'ALREADY_REVIEWED', 'x'));
    const { user, onReviewed } = setup();
    await fill(user);
    await submit(user);
    expect(await screen.findByText('Already reviewed')).toBeInTheDocument();
    expect(onReviewed).toHaveBeenCalledWith('AV-TEST01');
  });

  it('offers no retry when the server says the stay can’t be reviewed', async () => {
    send.mockRejectedValue(new ApiError(403, 'NOT_ELIGIBLE', 'x'));
    const { user, onReviewed } = setup();
    await fill(user);
    await submit(user);
    expect(await screen.findByRole('heading', { name: 'This stay can’t be reviewed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit review' })).toBeNull();
    expect(onReviewed).not.toHaveBeenCalled();
  });

  it('keeps what was typed when closed, and restores it on reopening', async () => {
    const first = setup();
    await first.user.click(screen.getByRole('radio', { name: '2 stars, Fair' }));
    await first.user.type(screen.getByLabelText('Your review'), 'Draft');
    await first.user.click(screen.getByRole('button', { name: 'Close' }));
    expect(first.onClose).toHaveBeenCalledOnce();
    expect(readReviewDraft('u1', 'AV-TEST01')).toEqual({ score: 2, text: 'Draft' });
    expect(readReviewDraft('u2', 'AV-TEST01')).toBeUndefined();
  });

  it('opens with a saved draft', () => {
    saveReviewDraft('u1', 'AV-TEST01', { score: 5, text: TEXT });
    setup();
    expect(screen.getByLabelText('Your review')).toHaveValue(TEXT);
    expect(screen.getByRole('radio', { name: '5 stars, Excellent' })).toBeChecked();
  });
});
