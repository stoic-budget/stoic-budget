import { DAY_MS } from './bank-sync-health';
import { providerRowKey } from './bank-sync-ofx.util';
import type { BankSyncTransaction } from './bank-sync-provider.interface';

/** A pending row the bank never booked is an authorisation that lapsed: gone after this. */
export const PENDING_MAX_AGE_DAYS = 14;

/** A stored pending row of the account being pulled, as far as the plan needs it. */
export interface StoredPendingRow {
  id: string;
  documentNumber: string | null;
  transactionDate: Date | string;
}

export interface PendingPlan {
  /** Stored pending rows the booked version replaces, each with that version. */
  post: Array<{ storedId: string; row: BankSyncTransaction }>;
  /** Stored pending rows the bank still lists as pending, with what it says now. */
  refresh: Array<{ storedId: string; row: BankSyncTransaction }>;
  /** Stored pending rows that never booked within `PENDING_MAX_AGE_DAYS`. */
  remove: string[];
  /** Rows still to import: new booked rows and new pending ones. */
  incoming: BankSyncTransaction[];
}

/**
 * Decides what a pull does with the account's pending rows.
 *
 * The provider's own id is tried first: most banks keep it when a row books.
 * A booked row under a new id (a bank that renumbers it) replaces the pending
 * row it resembles, by the same tolerant comparison (`isSame`: amount, date
 * window, payee) that keeps a re-pulled row from being imported twice, but
 * only among pending rows the provider no longer lists under their own id: a
 * row still listed as pending is a different purchase, however alike. And
 * only for a booked row the workspace does not hold yet: the provider lists
 * booked rows again on every pull, and one already stored is its own purchase,
 * never the booked version of a hold the bank reversed.
 *
 * Age is read from the row's own date, the same way for a stored row and an
 * incoming one, so an authorisation older than two weeks is neither kept nor
 * imported again on the next pull.
 */
export function planPendingRows(input: {
  accountId: string;
  stored: StoredPendingRow[];
  rows: BankSyncTransaction[];
  /** Provider row keys (`providerRowKey`) the workspace already holds as booked rows. */
  known: ReadonlySet<string>;
  now: Date;
  isSame: (row: BankSyncTransaction, stored: StoredPendingRow) => boolean;
}): PendingPlan {
  const { accountId, stored, rows, known, now, isSame } = input;
  const cutoff = now.getTime() - PENDING_MAX_AGE_DAYS * DAY_MS;
  const tooOld = (date: Date | string) => new Date(date).getTime() < cutoff;
  const byKey = new Map(stored.map(row => [row.documentNumber, row]));
  const listed = new Set(rows.map(row => providerRowKey(accountId, row.id)));
  const claimed = new Set<string>();
  const plan: PendingPlan = { post: [], refresh: [], remove: [], incoming: [] };

  for (const row of rows) {
    const lapsed = row.pending && tooOld(row.posted);
    const sameId = byKey.get(providerRowKey(accountId, row.id));
    if (sameId) {
      claimed.add(sameId.id);
      if (lapsed) plan.remove.push(sameId.id);
      else (row.pending ? plan.refresh : plan.post).push({ storedId: sameId.id, row });
      continue;
    }
    if (lapsed) continue;
    const lookalike =
      row.pending || known.has(providerRowKey(accountId, row.id))
        ? undefined
        : stored.find(
            candidate =>
              !claimed.has(candidate.id) &&
              !(candidate.documentNumber && listed.has(candidate.documentNumber)) &&
              isSame(row, candidate),
          );
    if (lookalike) {
      claimed.add(lookalike.id);
      plan.post.push({ storedId: lookalike.id, row });
      continue;
    }
    plan.incoming.push(row);
  }

  for (const row of stored) {
    if (!claimed.has(row.id) && tooOld(row.transactionDate)) plan.remove.push(row.id);
  }
  return plan;
}
