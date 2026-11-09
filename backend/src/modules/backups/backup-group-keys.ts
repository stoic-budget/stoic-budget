/**
 * uuid columns that are not a reference to one row: a key the rows of a group
 * share, or the subject an audit event names (a member, an import, a row since
 * deleted). Mapped when they name a restored row and kept otherwise.
 */
export const GROUP_KEY_COLUMNS: ReadonlySet<string> = new Set([
  'transactions.splitGroupId',
  'transactions.transferPairId',
  // The occurrences of a repeating bill share it; the first bill may be gone.
  'payables.seriesId',
  'audit_events.batchId',
  'audit_events.entityId',
]);
