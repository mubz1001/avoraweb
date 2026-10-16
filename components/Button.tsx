import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import type { LinkProps } from 'react-router';
import { AppLink } from './AppLink';
import { Icon, type IconName } from './Icon';
import './Button.css';

export type ButtonVariant = 'primary' | 'ghost' | 'wa' | 'danger';

interface Look {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
}

export const buttonClass = ({ variant = 'primary', size = 'md', block }: Look, extra?: string) =>
  ['btn', variant !== 'primary' && variant, size === 'sm' && 'sm', block && 'block', extra].filter(Boolean).join(' ');

interface ButtonProps extends Look, ButtonHTMLAttributes<HTMLButtonElement> {
  /** While true the button is disabled (double-submit guard) and shows `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant,
  size,
  block,
  busy,
  busyLabel,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={buttonClass({ variant, size, block }, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && busyLabel ? <span>{busyLabel}</span> : children}
    </button>
  );
}

/** An in-app link that looks like a button (an AppLink, so it prefetches the page on press, hover and focus). */
export function ButtonLink({ variant, size, block, className, ...rest }: Look & LinkProps) {
  return <AppLink {...rest} className={buttonClass({ variant, size, block }, className)} />;
}

/** An external link (new tab) that looks like a button. */
export function ExternalButton({
  variant,
  size,
  block,
  className,
  children,
  ...rest
}: Look & AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return (
    <a {...rest} className={buttonClass({ variant, size, block }, className)} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
}

export function IconButton({ icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} className={['icon-btn', className].filter(Boolean).join(' ')} aria-label={label}>
      <Icon name={icon} />
    </button>
  );
}
