import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceFilter } from './PriceFilter';

const range = { min: 40, max: 300, step: 10 };

function Harness({ onCommit }: { onCommit: (v: number) => void }) {
  const [value, setValue] = useState(300);
  return (
    <>
      <PriceFilter
        unit="night"
        range={range}
        value={value}
        onCommit={(v) => {
          onCommit(v);
          setValue(v);
        }}
      />
      <button onClick={() => setValue(300)}>Clear</button>
    </>
  );
}

describe('PriceFilter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('follows a drag at once but writes once, 200ms after the last move', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const slider = screen.getByRole('slider', { name: 'Maximum price per night' });
    for (const v of [280, 250, 200, 150]) fireEvent.change(slider, { target: { value: String(v) } });
    expect(slider).toHaveValue('150');
    expect(screen.getByText('$150')).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(150);
  });

  it('writes at once on release, and not again when the timer would have fired', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '120' } });
    fireEvent.pointerUp(slider);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(120);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.blur(slider);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('keeps the thumb where the drag is when an earlier write lands late, and resets on Clear', () => {
    // The router commits the URL asynchronously: "Land" applies the last write, as a later render would.
    function LaggyHarness() {
      const [value, setValue] = useState(300);
      const [pending, setPending] = useState(300);
      return (
        <>
          <PriceFilter unit="night" range={range} value={value} onCommit={setPending} />
          <button onClick={() => setValue(pending)}>Land</button>
          <button onClick={() => setValue(300)}>Clear</button>
        </>
      );
    }
    render(<LaggyHarness />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '200' } });
    act(() => vi.advanceTimersByTime(200)); // 200 written, not yet landed
    fireEvent.change(slider, { target: { value: '100' } }); // still dragging
    fireEvent.click(screen.getByRole('button', { name: 'Land' }));
    expect(slider).toHaveValue('100');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(slider).toHaveValue('300');
    expect(screen.getByText('Any')).toBeInTheDocument();
  });
});
