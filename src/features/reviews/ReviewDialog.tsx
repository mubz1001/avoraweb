import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { useModalDialog } from '@/components/ConfirmDialog';
import { FormError, TextAreaField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { PropertyImage } from '@/components/PropertyImage';
import { StayFacts } from '@/features/booking/StayFacts';
import { StarField } from '@/components/StarRating';
import { errorMessage, rule, useFormSubmit } from '@/components/forms';
import { isApiError } from '@/lib/api/client';
import { accountApi, queryKeys } from '@/lib/api/endpoints';
import { clearReviewDraft, readReviewDraft, saveReviewDraft, type ReviewDraft } from '@/lib/reviewDrafts';
import { REVIEW_TEXT, reviewTextMsg } from '@/lib/validation/rules';
import type { Booking } from '@/types';
import '@/components/ConfirmDialog.css';
import './reviews.css';

const schema = z.object({
  score: z.number().int().min(1, 'Choose a star rating.').max(5),
  text: rule(reviewTextMsg),
});

interface Props {
  booking: Booking;
  /** Whose draft this is: unsent entries are kept per member and booking, for this tab. */
  memberId: string;
  onClose: () => void;
  /** The server took the review (or already had one): the booking shows "Review sent". */
  onReviewed: (ref: string) => void;
}

/** No answer at all (lost connection, timeout, a 5xx, anything unexpected): the review may or may not have been stored. */
const noAnswer = (e: unknown) =>
  !isApiError(e) || e.code === 'NETWORK' || e.code === 'TIMEOUT' || (e.status >= 500 && e.code !== 'BAD_RESPONSE');

/**
 * Write a review for one past stay (docs/05 ReviewDialog). Opened only from a booking card, so the booking, and with it
 * the hotel, is fixed: the guest sees which stay they are rating and cannot pick another. A native modal <dialog>
 * (focus trap, Esc, focus back on the button that opened it); a bottom sheet on phones. While sending, every way out is
 * blocked. What was typed is kept for the tab as it is typed, so a failure, a reload or an expired session never costs the
 * review. The idempotency key stays the same only while the outcome is unknown, so a retry cannot post twice; any
 * definite answer from the server starts a fresh key.
 */
export function ReviewDialog({ booking: b, memberId, onClose, onReviewed }: Props) {
  const p = b.property;
  const hall = p.type === 'hall';
  const qc = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const key = useRef(crypto.randomUUID());
  const [problem, setProblem] = useState('');
  const form = useForm<ReviewDraft>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    shouldFocusError: false,
    defaultValues: readReviewDraft(memberId, b.ref) ?? { score: 0, text: '' },
  });
  useModalDialog(dialog, true);

  // Keep the draft as it is typed (an empty form is no draft).
  const typed = useWatch({ control: form.control });
  useEffect(() => {
    saveReviewDraft(memberId, b.ref, { score: typed.score ?? 0, text: typed.text ?? '' });
  }, [typed.score, typed.text, memberId, b.ref]);

  const send = useMutation({
    mutationFn: (v: ReviewDraft) =>
      accountApi.submitReview(b.ref, { score: v.score, text: v.text.trim() }, key.current),
    onSuccess: () => {
      clearReviewDraft(memberId, b.ref);
      onReviewed(b.ref);
      void qc.invalidateQueries({ queryKey: queryKeys.myBookings });
      void qc.invalidateQueries({ queryKey: queryKeys.property(p.id) });
      void qc.invalidateQueries({ queryKey: ['reviews', p.id] });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'ALREADY_REVIEWED') {
        clearReviewDraft(memberId, b.ref);
        onReviewed(b.ref);
        return;
      }
      if (noAnswer(e)) {
        // Same key on purpose: if the review did go through, sending it again is answered with the original result.
        setProblem('There was an unexpected error posting your review. Please try again later.');
        return;
      }
      key.current = crypto.randomUUID();
      setProblem(isApiError(e) && e.status === 422 ? 'Check your rating and review, then try again.' : errorMessage(e));
    },
  });
  const submit = useFormSubmit(form, (v) => {
    if (send.isPending) return;
    setProblem('');
    send.mutate(v);
  });

  const already = send.isError && isApiError(send.error) && send.error.code === 'ALREADY_REVIEWED';
  // The server says this stay can't be reviewed (not yours, not finished, not confirmed): there is nothing to retry.
  const refused = send.isError && isApiError(send.error) && (send.error.status === 403 || send.error.status === 404);
  const finished = send.isSuccess || already || refused;
  const close = () => {
    if (send.isPending) return;
    dialog.current?.close();
    onClose();
  };

  return (
    // The native `cancel` event (Esc) and a press on the backdrop are the keyboard and pointer twins of the close button.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      className="cdlg rvd"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="cdlg-in">
        <button type="button" className="icon-btn cdlg-x" aria-label="Close" disabled={send.isPending} onClick={close}>
          <Icon name="close" />
        </button>
        {finished ? (
          <div className="rvd-done" role="status">
            <div className={['tick', (already || refused) && 'neutral'].filter(Boolean).join(' ')}>
              <Icon name={already || refused ? 'review' : 'check'} />
            </div>
            <h2 id={titleId}>
              {already ? 'Already reviewed' : refused ? 'This stay can’t be reviewed' : 'Thanks for your review'}
            </h2>
            <p className="muted">
              {already || refused
                ? errorMessage(send.error)
                : `It will appear on ${p.name}’s page once it’s been checked.`}
            </p>
            <Button block onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <h2 id={titleId}>{hall ? 'Review your event' : 'Review your stay'}</h2>
            <div className="rvd-stay">
              <PropertyImage type={p.type} hue={p.hue} label={p.propertyType} image={p.image} className="rvd-ph" />
              <div className="rvd-info">
                <b>{p.name}</b>
                <StayFacts booking={b} />
                <div className="rvd-ref">{b.ref}</div>
              </div>
            </div>
            <form onSubmit={(e) => void submit(e)} onChange={() => setProblem('')} noValidate>
              <StarField control={form.control} name="score" legend="Overall rating" />
              <TextAreaField
                control={form.control}
                name="text"
                label="Your review"
                max={REVIEW_TEXT.max}
                rows={6}
                placeholder="What did you like? What could be better? Mention the room, staff, location, Wi-Fi or breakfast. Honest feedback helps other guests."
                disabled={send.isPending}
                hint={`At least ${REVIEW_TEXT.min} characters.`}
              />
              <FormError>{problem}</FormError>
              <div className="cdlg-actions">
                <Button type="submit" busy={send.isPending} busyLabel="Sending…">
                  Submit review
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
