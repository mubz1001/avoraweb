import { useId, useState } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { StarIcon } from './BrandIcons';
import './StarRating.css';

export const STAR_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

interface Props {
  value: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
  legend: string;
  error?: string;
  /** Id of the first radio, so a failed submit can focus it. */
  id?: string;
}

/**
 * A 1–5 star choice (docs/05 StarRating): a fieldset of five native radios, so arrow keys, Tab and screen readers work
 * without extra code. Stars up to the hover (mouse only) or the chosen value fill in; the word beside them names it.
 */
export function StarRating({ value, onChange, onBlur, legend, error, id }: Props) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset
      className={['stars', error && 'bad'].filter(Boolean).join(' ')}
      aria-describedby={error ? `m-${name}` : undefined}
    >
      <legend className="lbl">{legend}</legend>
      <div className="stars-row" onPointerLeave={() => setHover(0)}>
        {STAR_WORDS.map((word, i) => {
          const n = i + 1;
          return (
            <label
              key={n}
              className={n <= shown ? 'on' : undefined}
              onPointerEnter={(e) => setHover(e.pointerType === 'mouse' ? n : 0)}
            >
              <input
                type="radio"
                className="sr"
                name={name}
                id={n === 1 ? id : undefined}
                value={n}
                checked={value === n}
                aria-label={`${n} ${n === 1 ? 'star' : 'stars'}, ${word}`}
                onChange={() => onChange(n)}
                onBlur={onBlur}
              />
              <StarIcon width={34} height={34} />
            </label>
          );
        })}
        <span className="stars-word" aria-hidden="true">
          {shown ? STAR_WORDS[shown - 1] : ''}
        </span>
      </div>
      <div className="msg" id={`m-${name}`} role={error ? 'alert' : undefined}>
        {error}
      </div>
    </fieldset>
  );
}

/** A StarRating bound to a React Hook Form number field (0 = not chosen yet). */
export function StarField<T extends FieldValues>({
  control,
  name,
  legend,
  id,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  legend: string;
  id?: string;
}) {
  const {
    field,
    fieldState: { error },
  } = useController({ control, name });
  return (
    <StarRating
      legend={legend}
      id={id ?? String(name)}
      value={Number(field.value) || 0}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={error?.message}
    />
  );
}
