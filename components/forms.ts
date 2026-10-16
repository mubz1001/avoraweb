import { useCallback, useEffect } from 'react';
import {
  useWatch,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';
import { z } from 'zod';
import { useToast } from './Toast';
import { isApiError } from '@/lib/api/client';
import { PW_SHORT_MSG } from '@/lib/validation/rules';

/** Turns a message rule ('' = valid) into a Zod string schema, so forms reuse the exact copy from lib/validation. */
export const rule = (check: (v: string) => string) =>
  z.string().superRefine((v, ctx) => {
    const message = check(v);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });

const flatten = (errors: FieldErrors, prefix = ''): string[] =>
  Object.entries(errors).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (!v || typeof v !== 'object') return [];
    return 'message' in v && typeof v.message === 'string' ? [path] : flatten(v as FieldErrors, path);
  });

/**
 * Submit handler with the validation behaviour of docs/01: on an invalid submit, focus the first invalid field in
 * on-screen (DOM) order, scroll it into view and toast "Please fix N fields". Use with `shouldFocusError: false`.
 */
export function useFormSubmit<T extends FieldValues>(form: UseFormReturn<T>, onValid: SubmitHandler<T>) {
  const toast = useToast();
  return useCallback(
    (e?: React.BaseSyntheticEvent) =>
      form.handleSubmit(onValid, (errors) => {
        const els = flatten(errors)
          .map((p) => document.getElementById(p.replace(/\./g, '-')))
          .filter((el): el is HTMLElement => !!el)
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        const first = els[0];
        if (first) {
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          first.focus({ preventScroll: true });
        }
        const n = Math.max(els.length, 1);
        toast(`Please fix ${n === 1 ? '1 field' : `${n} fields`}`);
      })(e),
    [form, onValid, toast],
  );
}

/** Re-checks the confirmation field when the password above it changes: the resolver only revalidates the field that was
 *  edited, so without this a match (or a mismatch) would go unnoticed until the confirmation was touched again. */
export function useConfirmSync<T extends FieldValues>(
  form: UseFormReturn<T>,
  password: FieldPath<T>,
  confirm: FieldPath<T>,
) {
  const value = useWatch({ control: form.control, name: password });
  useEffect(() => {
    if (form.getValues(confirm)) void form.trigger(confirm);
  }, [value, form, confirm]);
}

/** Copy for server field-error codes (docs/06 §1), keyed by code. */
const FIELD_COPY: Record<string, string> = {
  REQUIRED: 'This field is required.',
  INVALID_PHONE: 'Enter a 9-digit Somali mobile number starting with 6 or 7, e.g. 61 555 0142.',
  INVALID_EMAIL: "That email doesn't look right.",
  INVALID_NAME: 'Use letters only.',
  TOO_SHORT: PW_SHORT_MSG,
  WEAK_PASSWORD: 'That password is too easy to guess. Try a short phrase.',
  BREACHED_PASSWORD: 'That password has appeared in a data breach. Choose another.',
  INVALID_CARD: 'Enter a valid 16-digit Visa or Mastercard number.',
  INVALID_EXPIRY: 'Use MM/YY.',
  INVALID_CVC: '3–4 digits.',
};

/** Maps an ApiError's fieldErrors onto form fields. `map` translates API keys (e.g. "guest.phone") to form field names.
 *  Returns true when at least one field error was applied. */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  map: Record<string, string> = {},
): boolean {
  if (!isApiError(error)) return false;
  let applied = false;
  for (const [key, code] of Object.entries(error.fieldErrors)) {
    const name = map[key] ?? key;
    if (form.getValues(name as never) === undefined) continue;
    form.setError(
      name as never,
      { type: 'server', message: FIELD_COPY[code] ?? 'Check this field.' },
      { shouldFocus: !applied },
    );
    applied = true;
  }
  return applied;
}

/** Re-exported for the forms; it lives with the API errors so pages can use it without loading the form library. */
export { errorMessage } from '@/lib/api/errors';
