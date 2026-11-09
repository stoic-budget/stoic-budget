import * as Schema from 'effect/Schema';
import { DateOnly, type Wire } from '../common/wire';

/** Where a statement came from: a file the person imported, or a bank feed pull. */
export const CoverageSource = Schema.Literals(['manual', 'bank_sync']);
export type CoverageSource = Wire<typeof CoverageSource>;

/** Why a statement is taken for a second copy of an earlier one. */
export const CoverageDuplicateKind = Schema.Literals(['same_file', 'same_rows', 'same_range']);
export type CoverageDuplicateKind = Wire<typeof CoverageDuplicateKind>;

/** One statement of the account, as the days it covers. */
export const CoveragePeriod = Schema.Struct({
  statementId: Schema.String,
  fileName: Schema.String,
  from: DateOnly,
  to: DateOnly,
  /** The statement prints no period: its first and last row dates stand in. */
  inferred: Schema.Boolean,
  source: CoverageSource,
  /** The statement's parsing status (`completed`, `needs_review`, …). */
  status: Schema.String,
  balanceStart: Schema.NullOr(Schema.Number),
  balanceEnd: Schema.NullOr(Schema.Number),
  /** Money in minus money out over its counted rows. */
  counted: Schema.Number,
  /** The same over its rows still waiting in Review. */
  pending: Schema.Number,
  rowCount: Schema.Number,
  /** A second copy of an earlier statement: left out of every check below. */
  duplicateOf: Schema.NullOr(
    Schema.Struct({ statementId: Schema.String, kind: CoverageDuplicateKind }),
  ),
});
export type CoveragePeriod = Wire<typeof CoveragePeriod>;

/** Days in a row, both ends included. */
export const CoverageRange = Schema.Struct({ from: DateOnly, to: DateOnly, days: Schema.Number });
export type CoverageRange = Wire<typeof CoverageRange>;

export const CoverageOverlap = Schema.Struct({
  from: DateOnly,
  to: DateOnly,
  days: Schema.Number,
  statementIds: Schema.Array(Schema.String),
});
export type CoverageOverlap = Wire<typeof CoverageOverlap>;

/** One statement's closing balance against the next one's opening balance. */
export const CoverageChainBreak = Schema.Struct({
  fromStatementId: Schema.String,
  toStatementId: Schema.String,
  /** The first day of the later statement. */
  date: DateOnly,
  closing: Schema.Number,
  opening: Schema.Number,
  /** Opening minus closing. */
  difference: Schema.Number,
  /** Days no statement covers lie between the two. */
  afterGap: Schema.Boolean,
});
export type CoverageChainBreak = Wire<typeof CoverageChainBreak>;

/** A statement whose opening balance and rows do not add up to its closing balance. */
export const CoverageMovementMismatch = Schema.Struct({
  statementId: Schema.String,
  from: DateOnly,
  to: DateOnly,
  opening: Schema.Number,
  closing: Schema.Number,
  counted: Schema.Number,
  pending: Schema.Number,
  /** Closing minus opening minus every row (counted and waiting in Review). */
  difference: Schema.Number,
});
export type CoverageMovementMismatch = Wire<typeof CoverageMovementMismatch>;

export const CoverageMonthState = Schema.Literals(['covered', 'partial', 'gap', 'overlap']);
export type CoverageMonthState = Wire<typeof CoverageMonthState>;

export const CoverageMonth = Schema.Struct({
  /** `YYYY-MM`. */
  month: Schema.String,
  state: CoverageMonthState,
  coveredDays: Schema.Number,
  /** Days of the month counted: up to today in the current one. */
  days: Schema.Number,
});
export type CoverageMonth = Wire<typeof CoverageMonth>;

/**
 * `GET /wallets/:id/statement-coverage`: which days the account's statements
 * cover, day by day, and whether their balances chain up. Statements in the
 * trash, still being read or failed are left out.
 */
export const StatementCoverage = Schema.Struct({
  walletId: Schema.String,
  currency: Schema.String,
  firstDay: Schema.NullOr(DateOnly),
  lastDay: Schema.NullOr(DateOnly),
  periods: Schema.Array(CoveragePeriod),
  /** Days between the first and the last covered day that no statement covers. */
  gaps: Schema.Array(CoverageRange),
  /** From the day after the last covered day to today; null when it reaches today. */
  sinceLast: Schema.NullOr(CoverageRange),
  overlaps: Schema.Array(CoverageOverlap),
  chainBreaks: Schema.Array(CoverageChainBreak),
  movementMismatches: Schema.Array(CoverageMovementMismatch),
  /** Every chain break and movement difference added up: money no row explains. */
  unexplained: Schema.Number,
  months: Schema.Array(CoverageMonth),
});
export type StatementCoverage = Wire<typeof StatementCoverage>;
