import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CityCombobox } from './CityCombobox';

const renderIt = (value: string, onChange = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CityCombobox type="hotel" value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
};

describe('CityCombobox clear button', () => {
  it('is shown only while there is text, and clears the field and keeps the focus in it', async () => {
    const onChange = renderIt('Mogadishu');
    const clear = screen.getByRole('button', { name: 'Clear location' });
    await userEvent.setup().click(clear);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ city: '', propertyId: '' });
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('is not there when the field is empty', () => {
    renderIt('');
    expect(screen.queryByRole('button', { name: 'Clear location' })).toBeNull();
  });
});
