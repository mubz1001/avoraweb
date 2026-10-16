import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateRangePicker } from './DateRangePicker';

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
  });
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onChange = vi.fn();
    render(<DateRangePicker hall={false} checkIn="2026-10-15" checkOut="2026-10-22" onChange={onChange} />);
    return { onChange, user: userEvent.setup() };
  };
  const open = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { expanded: false }));
  const summary = () => document.querySelector('.cal-sum')?.textContent;
  const done = () => screen.getByRole('button', { name: 'Done' });

  it('shows the current range in a summary line and applies it only when Done is pressed', async () => {
    const { onChange, user } = setup();
    await open(user);
    expect(summary()).toBe('7 nights · Thu, Oct 15 – Thu, Oct 22');

    await user.click(screen.getByRole('button', { name: 'Tue, Oct 20' }));
    expect(summary()).toBe('Select your check-out date');
    expect(done()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Sat, Oct 24' }));
    expect(summary()).toBe('4 nights · Tue, Oct 20 – Sat, Oct 24');

    // The calendar does not close by itself, and nothing is applied yet.
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.getByRole('dialog', { name: 'Choose your dates' })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    expect(done()).toBeEnabled();
    await user.click(done());
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ checkIn: '2026-10-20', checkOut: '2026-10-24' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('clears the draft: Clear empties the calendar and Done waits for a new range', async () => {
    const { onChange, user } = setup();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(summary()).toBe('Select your check-in date');
    expect(done()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Fri, Oct 16' }));
    await user.click(screen.getByRole('button', { name: 'Sun, Oct 18' }));
    expect(done()).toBeEnabled();
    await user.click(done());
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ checkIn: '2026-10-16', checkOut: '2026-10-18' });
  });

  it('keeps the previous dates when closed without Done', async () => {
    const { onChange, user } = setup();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Tue, Oct 20' }));
    await user.click(screen.getByRole('button', { name: 'Sat, Oct 24' }));
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
  });
});
