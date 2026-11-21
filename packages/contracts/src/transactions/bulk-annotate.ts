import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/** `POST /transactions/bulk-annotate`: how many of the ticked rows it changed. */
export const BulkAnnotateResult = Schema.Struct({
  /** Rows that gained a tag or the comment; a row that already had both is not counted. */
  updated: Schema.Number,
  /**
   * Another member's private rows that kept their comment: what it says is
   * theirs, so the comment is not written there (the tags still are).
   */
  skippedPrivate: Schema.Number,
  /**
   * Rows whose comment would grow past the 1000 characters the comment field
   * takes; they keep their comment as it was (the tags still go on).
   */
  skippedTooLong: Schema.Number,
});
export type BulkAnnotateResult = Wire<typeof BulkAnnotateResult>;
