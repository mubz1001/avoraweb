import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletPending } from './WalletPending';
import { ToastProvider } from '@/components/Toast';
import { checkoutApi } from '@/lib/api/endpoints';
import type { CreatedOrder } from '@/lib/api/schemas';

vi.mock('@/lib/api/endpoints', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/endpoints')>()),
  checkoutApi: { paymentStatus: vi.fn(), resendPrompt: vi.fn() },
}));
const paymentStatus = vi.mocked(checkoutApi.paymentStatus);

const order = {
  id: 'ord_test01',
  bookings: [{ ref: 'AV-TEST01' }],
  status: 'pending_payment',
  payment: { method: 'waafipay', brand: 'EVC Plus', payPhoneMasked: '+252 61 *** 0198' },
  paymentPrompt: { expiresAt: new Date(Date.now() + 90e3).toISOString() },
} as unknown as CreatedOrder;

function setup() {
  const cb = { onConfirmed: vi.fn(), onFailed: vi.fn(), onCancel: vi.fn() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WalletPending order={order} amount={{ amount: 20400, currency: 'USD' }} {...cb} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return cb;
}

beforeEach(() => {
  paymentStatus.mockReset();
  // jsdom has no modal <dialog>.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('WalletPending', () => {
  it('stays pending, and never reads as success, while the status is pending', async () => {
    paymentStatus.mockResolvedValue({ status: 'pending_payment' });
    const cb = setup();
    expect(await screen.findByRole('heading', { name: 'Waiting for your payment' })).toBeInTheDocument();
    await waitFor(() => expect(paymentStatus).toHaveBeenCalled());
    expect(screen.getByLabelText(/seconds left to approve/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /approved/i })).toBeNull();
    expect(cb.onConfirmed).not.toHaveBeenCalled();
    expect(cb.onFailed).not.toHaveBeenCalled();
  });

  it('confirms exactly once, only after the server says confirmed', async () => {
    paymentStatus.mockResolvedValue({ status: 'confirmed' });
    const cb = setup();
    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    await waitFor(() => expect(cb.onConfirmed).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(cb.onFailed).not.toHaveBeenCalled();
  });

  it('reports the server’s failure reason once and stops polling', async () => {
    paymentStatus.mockResolvedValue({ status: 'payment_failed', reason: 'USER_DECLINED' });
    const cb = setup();
    await waitFor(() => expect(cb.onFailed).toHaveBeenCalledWith('USER_DECLINED'));
    expect(cb.onFailed).toHaveBeenCalledTimes(1);
    const calls = paymentStatus.mock.calls.length;
    await new Promise((r) => setTimeout(r, 3500));
    expect(paymentStatus.mock.calls.length).toBe(calls);
  }, 10000);

  it('keeps waiting through a network error instead of failing', async () => {
    paymentStatus.mockRejectedValue(new Error('offline'));
    const cb = setup();
    expect(await screen.findByText(/Having trouble reaching AVORA/)).toBeInTheDocument();
    expect(cb.onFailed).not.toHaveBeenCalled();
    expect(cb.onConfirmed).not.toHaveBeenCalled();
  });
});
