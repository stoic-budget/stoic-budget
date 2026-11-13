export interface ClassificationRule {
  id?: string;
  name: string;
  type: 'category' | 'branch' | 'wallet' | 'article' | 'activity_type';
  conditions: RuleConditionNode[];
  /** How the conditions combine; all of them when absent. */
  matchMode?: MatchMode;
  result: ClassificationResult;
  priority: number;
  isActive: boolean;
}

/** Whether a row has to pass all of a rule's conditions or any one of them. */
export type MatchMode = 'all' | 'any';

export interface ClassificationCondition {
  field:
    | 'counterparty_name'
    | 'payment_purpose'
    | 'amount'
    | 'counterparty_bin'
    | 'document_number'
    /**
     * Who the row belongs to, as a membership id or the literal `shared`. A row
     * being imported belongs to the owner of its statement's account.
     */
    | 'owner'
    /** `income` or `expense`: amounts are stored unsigned, the direction says which. */
    | 'direction'
    | 'payment_type'
    /** The account (wallet) the row sits in, by id. */
    | 'wallet'
    /** The row's currency code. */
    | 'currency'
    /** The day number, 1 to 31, of the row's date. */
    | 'day_of_month'
    /**
     * The row's category, payee and tags by id, and its comment as text. They
     * read the row as the rules ranked above have left it in the same pass
     * (engine/rule-row-state): a person's pick stays, a rule above sets what
     * it decides, and its tags join the row's own.
     */
    | 'category'
    | 'payee'
    /** Several at once: `equals` holds when the row has any of the values, `not_equals` when none. */
    | 'tags'
    | 'comment';
  operator:
    | 'contains'
    | 'equals'
    | 'starts_with'
    | 'ends_with'
    | 'regex'
    | 'greater_than'
    | 'less_than'
    /** Negations hold for a row with no value: it does not contain anything. */
    | 'not_contains'
    | 'not_equals'
    /** From `value` to `valueTo`, both included. */
    | 'between'
    /** Blank text, no category or payee, no tags. `value` is '' and is not read. */
    | 'is_empty'
    | 'is_not_empty';
  /** Several values mean "any of them"; with a negation, none of them. */
  value: string | number | readonly string[];
  /** The upper end of `between`. */
  valueTo?: number;
}

/** Conditions that hold together, all of them or any one, as one condition of the rule. */
export interface ClassificationConditionGroup {
  matchMode: MatchMode;
  conditions: ClassificationCondition[];
}

/**
 * One entry of a rule's conditions: a condition, or a group of them. Groups go
 * one level deep. A rule saved before groups holds plain conditions only.
 */
export type RuleConditionNode = ClassificationCondition | ClassificationConditionGroup;

export interface ClassificationResult {
  categoryId?: string;
  branchId?: string;
  walletId?: string;
  article?: string;
  activityType?: string;
  /**
   * Hands the row to one member, or to the household with `null`. A rule saying
   * so beats inheriting the owner from the wallet: the user asked for it by name.
   */
  ownerMemberId?: string | null;
  /** Tags added to the row. Never a replacement: the tags it already has stay. */
  tagIds?: string[];
  /** Written as the row's comment when it has none: a person's comment is never replaced. */
  comment?: string;
  /** The payee the row is given, unless a person picked one for it. */
  payeeId?: string;
}
