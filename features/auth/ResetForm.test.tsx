import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetForm } from './AuthForms';
import { ApiError } from '@/lib/api/client';
import { accountApi } from '@/lib/api/endpoints';

vi.mock('@/lib/api/endpoints', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/endpoints')>()),
  accountApi: { confirmReset: vi.fn() },
}));
vi.mock('@/lib/session', () => ({ forgetSession: vi.fn() }));
const confirm = vi.mocked(accountApi.confirmReset);

const setup = (token = 'rst_abcdef123456') => {
  const cb = { onSignIn: vi.fn(), onRequestNew: vi.fn() };
  render(
    <MemoryRouter>
      <ResetForm token={token} {...cb} />
    </MemoryRouter>,
  );
  return cb;
};

beforeEach(() => {
  confirm.mockReset();
});

describe('ResetForm', () => {
  it('says a missing or malformed link can’t be used, and offers a new one', async () => {
    const cb = setup('');
    expect(screen.getByRole('heading', { name: 'This link can’t be used' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(cb.onRequestNew).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('checks the password before asking the server', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('Confirm your password.')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters.')).toHaveClass('bad');
    expect(screen.queryByText('Use at least 8 characters.')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('saves the password and sends the person to sign in', async () => {
    confirm.mockResolvedValue(undefined);
    const cb = setup();
    await userEvent.type(screen.getByLabelText('New password'), 'orange kettle drum');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'orange kettle drum');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledWith({ token: 'rst_abcdef123456', password: 'orange kettle drum' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(cb.onSignIn).toHaveBeenCalledOnce();
  });

  it('turns an expired or used link into the same next step', async () => {
    confirm.mockRejectedValue(new ApiError(410, 'TOKEN_EXPIRED', 'expired'));
    setup();
    await userEvent.type(screen.getByLabelText('New password'), 'orange kettle drum');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'orange kettle drum');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('heading', { name: 'This link can’t be used' })).toBeInTheDocument();
  });

  it('keeps the link usable after a lost connection and clears the field', async () => {
    confirm.mockRejectedValue(
      new ApiError(0, 'NETWORK', 'We couldn’t reach AVORA. Check your connection and try again.'),
    );
    setup();
    const field = screen.getByLabelText('New password');
    await userEvent.type(field, 'orange kettle drum');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'orange kettle drum');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t reach AVORA/);
    await waitFor(() => expect(field).toHaveValue(''));
    expect(screen.getByRole('button', { name: 'Save new password' })).toBeEnabled();
  });

  it('asks for the same password twice and re-checks when the first one changes', async () => {
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New password'), 'orange kettle dru');
    await user.type(screen.getByLabelText('Confirm new password'), 'orange kettle drum');
    await user.tab();
    expect(await screen.findByText('Passwords don’t match.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'm');
    await waitFor(() => expect(screen.queryByText('Passwords don’t match.')).toBeNull());
    await user.type(screen.getByLabelText('New password'), 'x');
    expect(await screen.findByText('Passwords don’t match.')).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });
});
