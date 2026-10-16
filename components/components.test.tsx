import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Accordion, useAccordion } from './Accordion';
import { Stepper } from './Controls';
import { PhoneField, TextField } from './Field';
import { PropertyImage } from './PropertyImage';
import { StarRating } from './StarRating';
import { errorMessage, rule, useFormSubmit } from './forms';
import { ToastProvider, useToast } from './Toast';
import { ApiError } from '@/lib/api/client';
import { emailMsg, phoneMsg } from '@/lib/validation/rules';

describe('Stepper', () => {
  function Harness() {
    const [v, setV] = useState(1);
    return (
      <Stepper
        value={v}
        min={0}
        max={2}
        onChange={setV}
        label="Double Room quantity"
        decLabel="Remove one"
        incLabel="Add one"
      />
    );
  }
  it('stays within bounds and disables the buttons at the limits', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dec = screen.getByRole('button', { name: 'Remove one' });
    const inc = screen.getByRole('button', { name: 'Add one' });
    await user.click(inc);
    expect(screen.getByRole('status')).toHaveTextContent('2');
    expect(inc).toBeDisabled();
    await user.click(dec);
    await user.click(dec);
    expect(screen.getByRole('status')).toHaveTextContent('0');
    expect(dec).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Double Room quantity' })).toBeInTheDocument();
  });
});

describe('Accordion', () => {
  function Harness() {
    const acc = useAccordion();
    return (
      <>
        <button type="button" {...acc.triggerProps}>
          Edit
        </button>
        <Accordion {...acc.panelProps}>
          <a href="#x">inside</a>
        </Accordion>
      </>
    );
  }
  it('wires aria-expanded / aria-controls and keeps the closed panel out of the tab order', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const btn = screen.getByRole('button', { name: 'Edit' });
    const panel = container.querySelector('.acc')!;
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel).toHaveAttribute('inert');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveClass('open');
    expect(panel).not.toHaveAttribute('inert');
  });
});

describe('form validation timing', () => {
  const schema = z.object({ email: rule(emailMsg), phone: rule(phoneMsg) });
  function Harness({ onDone }: { onDone: (v: z.infer<typeof schema>) => void }) {
    const form = useForm({
      resolver: zodResolver(schema),
      mode: 'onTouched',
      reValidateMode: 'onChange',
      shouldFocusError: false,
      defaultValues: { email: '', phone: '' },
    });
    const submit = useFormSubmit(form, onDone);
    return (
      <form onSubmit={submit} noValidate>
        <TextField control={form.control} name="email" label="Email" type="email" />
        <PhoneField control={form.control} name="phone" label="Mobile number" />
        <button type="submit">Pay</button>
      </form>
    );
  }

  it('waits for blur, then validates live; valid fields turn green', async () => {
    const user = userEvent.setup();
    render(<Harness onDone={() => {}} />);
    const email = screen.getByLabelText('Email');
    await user.type(email, 'amina@');
    expect(document.getElementById('f-email')).not.toHaveClass('bad');
    await user.tab();
    expect(document.getElementById('f-email')).toHaveClass('bad');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toContain('m-email');
    await user.type(email, 'example.com');
    expect(document.getElementById('f-email')).toHaveClass('good');
  });

  it('reformats the phone on blur', async () => {
    const user = userEvent.setup();
    render(<Harness onDone={() => {}} />);
    const phone = screen.getByLabelText('Mobile number');
    await user.type(phone, '0615550142');
    await user.tab();
    expect(phone).toHaveValue('61 555 0142');
  });

  it('on submit focuses the first invalid field in on-screen order and toasts the count', async () => {
    const user = userEvent.setup();
    let done = false;
    render(
      <ToastProvider>
        <Harness onDone={() => (done = true)} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Pay' }));
    expect(done).toBe(false);
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Please fix 2 fields');
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Mobile number'), '615550142');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Pay' }));
    });
    expect(done).toBe(true);
  });
});

describe('Toast action', () => {
  function Harness({ onUndo }: { onUndo: () => void }) {
    const toast = useToast();
    return <button onClick={() => toast('Basket cleared', { label: 'Undo', onClick: onUndo })}>Clear</button>;
  }
  it('runs the action once and dismisses the toast', async () => {
    const user = userEvent.setup();
    let undone = 0;
    render(
      <ToastProvider>
        <Harness onUndo={() => undone++} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('status')).toHaveTextContent('Basket cleared');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undone).toBe(1);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('StarRating', () => {
  function Harness({ error }: { error?: string }) {
    const [v, setV] = useState(0);
    return <StarRating legend="Overall rating" value={v} onChange={setV} {...(error ? { error } : {})} />;
  }
  it('picks a star by click and by arrow keys, and names the choice', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    await user.click(screen.getByRole('radio', { name: '4 stars, Very good' }));
    expect(screen.getByRole('radio', { name: '4 stars, Very good' })).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '5 stars, Excellent' })).toBeChecked();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '3 stars, Good' })).toBeChecked();
    await user.unhover(screen.getByRole('radio', { name: '4 stars, Very good' }).closest('label')!);
    expect(screen.getByText('Good')).toBeInTheDocument();
  });
  it('shows its error message', () => {
    render(<Harness error="Choose a star rating." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a star rating.');
  });
});

describe('PropertyImage', () => {
  it('falls back to the placeholder tile when the photo fails to load', () => {
    const { container } = render(
      <PropertyImage
        type="hotel"
        hue={10}
        label="Lobby"
        image={{ url: '/x.jpg', alt: 'Lobby', width: 4, height: 3 }}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Lobby' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('div.ph')).not.toBeNull();
  });
});

describe('errorMessage', () => {
  it('says how long a lock lasts when the server tells us', () => {
    expect(errorMessage(new ApiError(429, 'RATE_LIMITED', 'x', { retryAfter: 300 }))).toBe(
      'Too many attempts. Try again in 5 minutes.',
    );
    expect(errorMessage(new ApiError(429, 'RATE_LIMITED', 'x', { retryAfter: 20 }))).toBe(
      'Too many attempts. Try again in 1 minute.',
    );
    expect(errorMessage(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe(
      'Too many attempts. Wait 5 minutes and try again.',
    );
  });
});
