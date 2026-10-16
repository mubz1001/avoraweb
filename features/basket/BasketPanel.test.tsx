import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { BasketPanel } from './BasketPanel';

vi.mock('@/lib/basket/useBasket', () => ({
  useBasket: () => ({ basket: null, stays: [], count: 0, loading: false, set: vi.fn(), move: vi.fn() }),
}));

function Harness() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <MemoryRouter>
      <button ref={btn} onClick={() => setOpen((o) => !o)}>
        Basket
      </button>
      <BasketPanel id="b" open={open} onClose={() => setOpen(false)} trigger={btn} />
    </MemoryRouter>
  );
}

describe('BasketPanel', () => {
  it('is out of reach while closed, opens on the button and closes on Esc with focus back on the button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Closed: inert, so it can't be focused or tapped, and its body isn't rendered yet (it is rendered ahead once the browser is idle). The stylesheet
    // also hides it (`visibility`), which jsdom doesn't load; that is checked in the browser.
    expect(document.querySelector('.dd-pop')).toHaveAttribute('inert');
    expect(screen.queryByText('Your basket is empty')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Basket' }));
    expect(document.querySelector('.dd-pop')).not.toHaveAttribute('inert');
    expect(document.querySelector('.dd-pop')).toHaveClass('open');
    expect(screen.getByRole('dialog', { name: 'Your basket' })).toBeInTheDocument();
    expect(screen.getByText('Your basket is empty')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    act(() => {});
    expect(document.querySelector('.dd-pop')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Basket' })).toHaveFocus();
  });

  it('closes on a press outside, but not on the button that opened it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>Page</p>
        <Harness />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Basket' }));
    await user.click(screen.getByText('Page'));
    expect(document.querySelector('.dd-pop')).not.toHaveClass('open');
  });
});
