import type { Transaction } from '../types';

/** What the API sends in place of a field of someone else's private row. */
const PRIVATE_PLACEHOLDER = '—';

/**
 * Whether the viewer may read, and so edit, the row's comment: any shared
 * row, and a private one only when it is their own, as the API decides. The
 * placeholder of a redacted row is never treated as a comment, so it can
 * never be saved back over the real one.
 */
export function canReadComment(
  transaction: Pick<Transaction, 'isPrivate' | 'ownerMemberId' | 'comments'>,
  selfMemberId: string | null,
): boolean {
  if (!transaction.isPrivate) {
    return true;
  }
  return (
    selfMemberId !== null &&
    transaction.ownerMemberId === selfMemberId &&
    transaction.comments !== PRIVATE_PLACEHOLDER
  );
}
