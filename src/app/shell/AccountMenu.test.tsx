import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';

const session = vi.hoisted(() => ({
  member: null as null | { id: string; firstName: string; lastName: string; email: string },
  signOut: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/session', () => ({
  useSession: () => ({ member: session.member, loading: false }),
  useAuthHref: () => (mode: string) => `/${mode}?next=%2F`,
  signOut: session.signOut,
  signOutAndSay: () => session.signOut(),
}));

const amina = { id: 'm1', firstName: 'Amina', lastName: 'Hassan', email: 'amina@example.com' };

function Harness({ here = '', at = '/', onClose = () => {} }: { here?: string; at?: string; onClose?: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <MemoryRouter initialEntries={[at]}>
      <button ref={btn}>Account</button>
      <AccountMenu id="acm" open onClose={onClose} trigger={btn} here={here} />
    </MemoryRouter>
  );
}

const rows = () => [...document.querySelectorAll('.acm-row')].map((e) => e.textContent?.trim());

describe('AccountMenu', () => {
  beforeEach(() => {
    session.member = null;
    session.signOut.mockClear();
  });

  it('offers a guest only sign-up and sign-in (Support and WhatsApp are in the header)', () => {
    render(<Harness />);
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup?next=%2F');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin?next=%2F');
    expect(rows()).toEqual([]);
    expect(screen.queryByText(/whatsapp/i)).toBeNull();
  });

  it('keeps the buttons on the sign-in page too, so the menu is never empty', () => {
    render(<Harness at="/signin?next=%2F" />);
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lists the account pages for a member, marks the current one and links each directly', () => {
    session.member = amina;
    render(<Harness here="profile" />);
    expect(rows()).toEqual(['My bookings', 'Favourites', 'Payment methods', 'Profile', 'Sign out']);
    expect(screen.getByRole('link', { name: 'Payment methods' })).toHaveAttribute('href', '/account/payments');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Favourites' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('amina@example.com')).toBeInTheDocument();
  });

  it('signs out and closes', async () => {
    session.member = amina;
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(session.signOut).toHaveBeenCalledOnce();
  });
});
