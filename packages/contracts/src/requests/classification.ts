import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

const RuleText = Schema.String.check(Schema.isMaxLength(200));

/** Whether a rule asks for all of its conditions or for any one of them. */
export const RuleMatchMode = Schema.Literals(['all', 'any']);

/** One test a categorization rule runs on a transaction. */
export const ClassificationConditionInput = Schema.Struct({
  field: Schema.Literals([
    'counterparty_name',
    'payment_purpose',
    'amount',
    'counterparty_bin',
    'document_number',
    'owner',
    /** `income` or `expense`. */
    'direction',
    'payment_type',
    /** The account (wallet) the row sits in, by id. */
    'wallet',
    /** The row's currency code. */
    'currency',
    /** The day number, 1 to 31, of the row's date. */
    'day_of_month',
  ]),
  operator: Schema.Literals([
    'contains',
    'equals',
    'starts_with',
    'ends_with',
    'regex',
    'greater_than',
    'less_than',
    'not_contains',
    'not_equals',
    /** From `value` to `valueTo`, both included. */
    'between',
  ]),
  // Bounded: a rule runs against every imported row, and a long pattern is
  // where a pathological regex hides. Several values mean "any of them" (with
  // a negation: none of them).
  value: Schema.Union([
    RuleText,
    Schema.Finite,
    Schema.Array(RuleText).check(Schema.isMinLength(1), Schema.isMaxLength(20)),
  ]),
  /** The upper end of `between`. */
  valueTo: Schema.optional(Schema.Finite),
});
export type ClassificationConditionInput = Wire<typeof ClassificationConditionInput>;

/** What a matching rule sets on the transaction. */
export const ClassificationResultInput = Schema.Struct({
  categoryId: Schema.optional(Schema.String.check(Schema.isUUID())),
  branchId: Schema.optional(Schema.String.check(Schema.isUUID())),
  walletId: Schema.optional(Schema.String.check(Schema.isUUID())),
  article: Schema.optional(Schema.String),
  activityType: Schema.optional(Schema.String),
  /** Hands the row to one member, or to the household with `null`. */
  ownerMemberId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Tags added to the row; the ones it already has stay. */
  tagIds: Schema.optional(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(20)),
  ),
  /** Written as the row's comment when it has none. */
  comment: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500))),
  /** The payee the row is given, unless a person picked one for it. */
  payeeId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** Instead of `payeeId`: a payee by name, made on save when the workspace has none of it. */
  payeeName: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
});
export type ClassificationResultInput = Wire<typeof ClassificationResultInput>;

export const CreateCategorizationRuleBody = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  description: optionalNullable(Schema.String),
  conditions: Schema.Array(ClassificationConditionInput).check(Schema.isMinLength(1)),
  matchMode: optionalNullable(RuleMatchMode),
  result: ClassificationResultInput,
  priority: optionalNullable(Schema.Int),
  isActive: optionalNullable(Schema.Boolean),
});
export type CreateCategorizationRuleBody = Wire<typeof CreateCategorizationRuleBody>;

export const UpdateCategorizationRuleBody = Schema.Struct({
  name: optionalNullable(Schema.String),
  description: optionalNullable(Schema.String),
  // Never empty: a rule with no condition would otherwise be one about every row.
  conditions: optionalNullable(
    Schema.Array(ClassificationConditionInput).check(Schema.isMinLength(1)),
  ),
  matchMode: optionalNullable(RuleMatchMode),
  result: optionalNullable(ClassificationResultInput),
  priority: optionalNullable(Schema.Int),
  isActive: optionalNullable(Schema.Boolean),
});
export type UpdateCategorizationRuleBody = Wire<typeof UpdateCategorizationRuleBody>;

export const TestCategorizationRuleBody = Schema.Struct({
  conditions: Schema.Array(ClassificationConditionInput).check(Schema.isMinLength(1)),
  matchMode: optionalNullable(RuleMatchMode),
  /** Rows to test against; without them the workspace's most recent rows are used. */
  transactionIds: Schema.optional(Schema.Array(Schema.String).check(Schema.isMinLength(1))),
  /** The saved rule being edited: rules ranked above it are what can win its rows. */
  ruleId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** The account the draft sets: the answer counts the matches it would move there. */
  walletId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type TestCategorizationRuleBody = Wire<typeof TestCategorizationRuleBody>;

/**
 * Inline structural types on a `@Body()` leave the global ValidationPipe with an
 * `Object` metatype, so nothing was validated — `transactionIds` could arrive as
 * anything, including a non-array that then threw deeper in the service.
 */
export const ClassifyBulkBody = Schema.Struct({
  transactionIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type ClassifyBulkBody = Wire<typeof ClassifyBulkBody>;

/** `POST /classification/transaction/:id`. */
export const ClassifyTransactionParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});
export type ClassifyTransactionParams = Wire<typeof ClassifyTransactionParams>;

/** `POST /classification/statements/:id/suggestions`. */
export const StatementSuggestionsParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});
export type StatementSuggestionsParams = Wire<typeof StatementSuggestionsParams>;

/** `/categorization-rules/:id`. */
export const CategorizationRuleParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});
export type CategorizationRuleParams = Wire<typeof CategorizationRuleParams>;

/** `PUT /categorization-rules/order`: every rule of the workspace, the first one wins. */
export const ReorderCategorizationRulesBody = Schema.Struct({
  ids: Schema.Array(Schema.String.check(Schema.isUUID())).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1000),
  ),
});
export type ReorderCategorizationRulesBody = Wire<typeof ReorderCategorizationRulesBody>;
