import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fitSpoken, StayFit } from './StayFit';
import type { StayFit as Fit } from '@/lib/pricing';

const fit = (beds: number, guests: number, rooms: number, wantRooms: number): Fit => ({
  guests: { have: beds, want: guests },
  rooms: { have: rooms, want: wantRooms },
  short: Math.max(0, guests - beds),
});

describe('fitSpoken', () => {
  it('reads the search before any room is picked', () => {
    expect(fitSpoken(fit(0, 4, 0, 2))).toBe('4 guests, 2 rooms.');
  });
  it('says how many guests have a bed, and rooms against the search', () => {
    expect(fitSpoken(fit(2, 4, 1, 2))).toBe('Beds for 2 of your 4 guests. 1 of the 2 rooms you searched for.');
    expect(fitSpoken(fit(6, 4, 1, 1))).toBe('Beds for all 4 guests. 1 of the 1 room you searched for.');
  });
});

describe('StayFit', () => {
  const trigger = (onClick = vi.fn()) => ({ 'aria-haspopup': 'dialog' as const, 'aria-expanded': false, onClick });

  it('opens the calendar from the dates and guests & rooms from the fit', async () => {
    const dates = vi.fn();
    const party = vi.fn();
    render(
      <StayFit
        fit={fit(2, 4, 1, 2)}
        dates="Oct 27–29"
        datesSpoken="Oct 27–29, 2 nights"
        dateTrigger={trigger(dates)}
        partyTrigger={trigger(party)}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Oct 27–29, 2 nights. Change dates.' }));
    expect(dates).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: /Beds for 2 of your 4 guests.*Change guests and rooms/ }));
    expect(party).toHaveBeenCalledOnce();
  });
});
