import { z } from 'zod';
import { session, storageKeys } from '@/lib/storage';

export interface ReviewDraft {
  score: number;
  text: string;
}

/** What a member had typed into a review and not sent, kept for this browser tab (sessionStorage) so a reload, the Back
 *  button or an expired session doesn't lose it. One entry per member and booking; read like an API response, since
 *  storage is editable. An explicit sign-out clears all of them (`clearReviewDrafts`). */
const drafts = z.record(z.string(), z.object({ score: z.number().int().min(0).max(5), text: z.string().max(5000) }));

const all = () => {
  const r = drafts.safeParse(session.get<unknown>(storageKeys.reviewDrafts, {}));
  return r.success ? r.data : {};
};
const keyOf = (memberId: string, ref: string) => `${memberId}:${ref}`;

export const readReviewDraft = (memberId: string, ref: string): ReviewDraft | undefined => all()[keyOf(memberId, ref)];

/** An empty form is no draft. */
export function saveReviewDraft(memberId: string, ref: string, draft: ReviewDraft) {
  const rest = { ...all() };
  if (draft.score || draft.text.trim()) rest[keyOf(memberId, ref)] = draft;
  else delete rest[keyOf(memberId, ref)];
  session.set(storageKeys.reviewDrafts, rest);
}

export const clearReviewDraft = (memberId: string, ref: string) =>
  saveReviewDraft(memberId, ref, { score: 0, text: '' });
export const clearReviewDrafts = () => session.del(storageKeys.reviewDrafts);
