import { useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Icon } from './Icon';
import { PW_HINT, PW_SHORT_MSG } from '@/lib/validation/rules';
import { allCountries, capPhone, commonCountries, dialOf, phoneFmt, SOMALIA, type Country } from '@/lib/phone';
import { t } from '@/lib/i18n';

/**
 * Labelled form fields bound to React Hook Form. Markup and ids follow docs/05 Field: wrapper `#f-<id>`, control `#<id>`,
 * hint `#h-<id>` and message `#m-<id>` tied to the control with aria-describedby. Validation timing (docs/01 Checkout ›
 * Validation) comes from the form: `mode: 'onTouched'` checks on blur, then on every keystroke once touched. A touched
 * valid field turns green.
 */
interface Shared<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  hint?: ReactNode;
  id?: string;
  className?: string;
  /** Hidden fields stay mounted (and keep their value) but are not shown. */
  hidden?: boolean;
}

function useField<T extends FieldValues>({ control, name, id }: Pick<Shared<T>, 'control' | 'name' | 'id'>) {
  const {
    field: { ref, value, onChange, onBlur, name: fieldName },
    fieldState: { error: err, isTouched },
  } = useController({ control, name });
  const cid = id ?? String(name).replace(/\./g, '-');
  const error = err?.message ?? '';
  const status = error ? 'bad' : isTouched && value ? 'good' : '';
  // Plain values (not RHF's field object) so render code never reads through an object that carries a ref.
  const field = { value: (value ?? '') as string, onChange: onChange as (v: unknown) => void, onBlur, name: fieldName };
  return { field, inputRef: ref, cid, error, status };
}

function Shell({
  cid,
  label,
  hint,
  hintBad,
  error,
  status,
  className,
  hidden,
  children,
}: {
  cid: string;
  label: ReactNode;
  hint?: ReactNode;
  /** The hint is the rule that was broken: it turns red and no separate message repeats it. */
  hintBad?: boolean;
  error: string;
  status: string;
  className?: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={['field', status, className, hidden && 'hidden'].filter(Boolean).join(' ')} id={`f-${cid}`}>
      <label className="lbl" htmlFor={cid}>
        {label}
      </label>
      {children}
      {hint ? (
        <div className={['hint', hintBad && 'bad'].filter(Boolean).join(' ')} id={`h-${cid}`}>
          {hint}
        </div>
      ) : null}
      <div className="msg" id={`m-${cid}`}>
        {error}
      </div>
    </div>
  );
}

const describedBy = (cid: string, hint: unknown) => (hint ? `h-${cid} m-${cid}` : `m-${cid}`);

type InputAttrs = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'value' | 'onChange' | 'onBlur' | 'id' | 'hidden'
>;

/** `format` rewrites the value as it is typed (card number groups, MM/YY). */
export function TextField<T extends FieldValues>({
  label,
  hint,
  className,
  hidden,
  format,
  ...props
}: Shared<T> & InputAttrs & { format?: (v: string) => string }) {
  const { control, name, id, ...attrs } = props;
  const { field, inputRef, cid, error, status } = useField({ control, name, id });
  return (
    <Shell cid={cid} label={label} hint={hint} error={error} status={status} className={className} hidden={hidden}>
      <input
        {...attrs}
        id={cid}
        className="inp"
        name={field.name}
        ref={inputRef}
        value={field.value}
        onChange={(e) => field.onChange(format ? format(e.target.value) : e.target.value)}
        onBlur={field.onBlur}
        aria-invalid={!!error}
        aria-describedby={describedBy(cid, hint)}
      />
    </Shell>
  );
}

/** A multi-line text field. `max` adds a live "123 / 2,000" counter under it that turns red past the limit; the
 *  limit is enforced by the form's rule (typing is never cut off). */
export function TextAreaField<T extends FieldValues>({
  label,
  hint,
  className,
  hidden,
  max,
  ...props
}: Shared<T> &
  Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'name' | 'value' | 'onChange' | 'onBlur' | 'id' | 'hidden' | 'maxLength'
  > & { max?: number }) {
  const { control, name, id, ...attrs } = props;
  const { field, inputRef, cid, error, status } = useField({ control, name, id });
  const n = field.value.trim().length;
  const counter =
    max === undefined ? null : (
      <span className={n > max ? 'count over' : 'count'}>
        {n.toLocaleString('en-US')} / {max.toLocaleString('en-US')}
      </span>
    );
  const note =
    hint || counter ? (
      <>
        {hint ? <span>{hint}</span> : null}
        {counter}
      </>
    ) : null;
  return (
    <Shell cid={cid} label={label} hint={note} error={error} status={status} className={className} hidden={hidden}>
      <textarea
        {...attrs}
        id={cid}
        className="inp"
        name={field.name}
        ref={inputRef}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        aria-invalid={!!error}
        aria-describedby={describedBy(cid, note)}
      />
    </Shell>
  );
}

type PhoneProps<T extends FieldValues> = Shared<T> & { placeholder?: string; autoComplete?: string };

/** +252 mobile number; reformatted to "61 555 0142" on blur. With `countryName` (another form field holding the ISO
 *  country code) the "+252" becomes a country picker of every country, the most common first, and only Somali numbers
 *  are regrouped. */
export function PhoneField<T extends FieldValues>({
  countryName,
  ...props
}: PhoneProps<T> & { countryName?: FieldPath<T> }) {
  return countryName ? (
    <CountryPhoneField {...props} countryName={countryName} />
  ) : (
    <PhoneInput {...props} country={SOMALIA} prefix={<span className="cc">+252</span>} />
  );
}

const countryOption = (c: Country, group: string) => (
  <option key={`${group}${c.iso}`} value={c.iso}>
    {c.name} (+{c.dial})
  </option>
);

function CountryPhoneField<T extends FieldValues>({
  countryName,
  ...props
}: PhoneProps<T> & { countryName: FieldPath<T> }) {
  const { field: country } = useController({ control: props.control, name: countryName });
  const iso = String(country.value || SOMALIA);
  return (
    <PhoneInput
      {...props}
      country={iso}
      prefix={
        <label className="cc pick-cc">
          +{dialOf(iso)}
          <Icon name="chev" size={14} />
          <select
            aria-label={t('Country code')}
            value={iso}
            onChange={(e) => country.onChange(e.target.value)}
            onBlur={country.onBlur}
          >
            <optgroup label={t('Most common')}>{commonCountries.map((c) => countryOption(c, 'c'))}</optgroup>
            <optgroup label={t('All countries')}>{allCountries.map((c) => countryOption(c, 'a'))}</optgroup>
          </select>
        </label>
      }
    />
  );
}

function PhoneInput<T extends FieldValues>({
  label,
  hint,
  className,
  hidden,
  placeholder = '61 555 0142',
  country,
  prefix,
  ...props
}: PhoneProps<T> & { country: string; prefix: ReactNode }) {
  const { control, name, id, autoComplete = 'tel-national' } = props;
  const { field, inputRef, cid, error, status } = useField({ control, name, id });
  return (
    <Shell cid={cid} label={label} hint={hint} error={error} status={status} className={className} hidden={hidden}>
      <div className="phone">
        {prefix}
        <input
          id={cid}
          name={field.name}
          ref={inputRef}
          inputMode="tel"
          autoComplete={autoComplete}
          placeholder={country === SOMALIA ? placeholder : ''}
          value={field.value}
          onChange={(e) => field.onChange(capPhone(country, e.target.value))}
          onBlur={() => {
            if (field.value && country === SOMALIA) field.onChange(phoneFmt(String(field.value)));
            field.onBlur();
          }}
          aria-invalid={!!error}
          aria-describedby={describedBy(cid, hint)}
        />
      </div>
    </Shell>
  );
}

export function PasswordField<T extends FieldValues>({
  label,
  hint,
  className,
  hidden,
  autoComplete,
  confirm,
  ...props
}: Shared<T> & {
  autoComplete: 'current-password' | 'new-password';
  /** The "type it again" field: no length hint of its own. */
  confirm?: boolean;
}) {
  const { control, name, id } = props;
  const { field, inputRef, cid, error, status } = useField({ control, name, id });
  const [show, setShow] = useState(false);
  // A new password states its one rule up front. Breaking the length rule turns that hint red rather than adding a line
  // that says the same thing again.
  const shownHint = hint ?? (autoComplete === 'new-password' && !confirm ? PW_HINT : undefined);
  const short = !!shownHint && error === PW_SHORT_MSG;
  return (
    <Shell
      cid={cid}
      label={label}
      hint={shownHint}
      hintBad={short}
      error={short ? '' : error}
      status={status}
      className={className}
      hidden={hidden}
    >
      <div className="pw">
        <input
          id={cid}
          className="inp"
          type={show ? 'text' : 'password'}
          maxLength={128}
          autoComplete={autoComplete}
          name={field.name}
          ref={inputRef}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          aria-invalid={!!error}
          aria-describedby={describedBy(cid, shownHint)}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          <Icon name={show ? 'eyeoff' : 'eye'} />
        </button>
      </div>
    </Shell>
  );
}

/** Form-level error panel; renders nothing when there is no message. */
export function FormError({ children }: { children?: ReactNode }) {
  return children ? (
    <div className="formerr" role="alert">
      {children}
    </div>
  ) : null;
}
