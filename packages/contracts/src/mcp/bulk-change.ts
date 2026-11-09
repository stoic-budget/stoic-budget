import * as Schema from 'effect/Schema';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';

/** What a row says about the fields a bulk MCP tool changes. */
export const McpRowState = Schema.Struct({
  categoryId: Schema.NullOr(Schema.String),
  categoryName: Schema.NullOr(Schema.String),
  approved: Schema.Boolean,
});
export type McpRowState = Wire<typeof McpRowState>;

/** One row the call changes, before and after; another member's private row shows no merchant. */
export const McpChangeExample = Schema.Struct({
  id: Schema.String,
  date: DateOnly,
  amount: Schema.NullOr(DecimalString),
  currency: Schema.String,
  counterparty: Schema.NullOr(Schema.String),
  before: McpRowState,
  after: McpRowState,
});
export type McpChangeExample = Wire<typeof McpChangeExample>;

/**
 * Ids the call leaves alone, by reason: not in this workspace, already as
 * asked, another member's private row, or a row a filed tax return locks.
 */
export const McpSkippedRows = Schema.Struct({
  reason: Schema.Literals(['not_found', 'unchanged', 'private', 'tax_locked']),
  ids: Schema.Array(Schema.String),
});
export type McpSkippedRows = Wire<typeof McpSkippedRows>;

/**
 * The answer of an MCP tool that changes many rows. The first call is a
 * `preview` with a `confirmToken`; the same call with that token is `applied`.
 * `rows` is how many rows would change, or did.
 */
export const McpBulkChange = Schema.Struct({
  status: Schema.Literals(['preview', 'applied']),
  tool: Schema.String,
  rows: Schema.Number,
  skipped: Schema.Array(McpSkippedRows),
  examples: Schema.Array(McpChangeExample),
  confirmToken: Schema.optionalKey(Schema.String),
  expiresAt: Schema.optionalKey(Timestamp),
  next: Schema.String,
});
export type McpBulkChange = Wire<typeof McpBulkChange>;
