import { isApiError } from './client';

/** Plain-language message for an error with no field to attach to. */
const MESSAGES: Record<string, string> = {
  BAD_CREDENTIALS: 'That email and password don’t match. Check them and try again, or reset your password.',
  RATE_LIMITED: 'Too many attempts. Wait 5 minutes and try again.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  BAD_PASSWORD: 'Your current password is incorrect.',
  SESSION_EXPIRED: 'That sign-up took too long. Please start again.',
  UNAUTHORIZED: 'Your session has ended. Sign in again.',
  DUPLICATE_METHOD: 'This payment method is already saved.',
  LIMIT_REACHED: 'You can save up to 10 payment methods. Remove one first.',
  METHOD_EXPIRED: 'That card has expired.',
  ALREADY_REVIEWED: 'You’ve already reviewed this stay.',
  NOT_ELIGIBLE: 'This stay can’t be reviewed yet.',
  NETWORK: 'We couldn’t reach AVORA. Check your connection and try again.',
};

/** "in 5 minutes" from a Retry-After in seconds (never less than a minute: it is a lock, not a blink). */
const waitText = (seconds: number) => {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? 'in 1 minute' : `in ${m} minutes`;
};

export const errorMessage = (e: unknown) => {
  if (!isApiError(e)) return 'Something went wrong. Please try again.';
  if (e.code === 'RATE_LIMITED' && e.retryAfter) return `Too many attempts. Try again ${waitText(e.retryAfter)}.`;
  return MESSAGES[e.code] ?? e.message;
};
