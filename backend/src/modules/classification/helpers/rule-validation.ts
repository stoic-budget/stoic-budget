import { BadRequestException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { assertOwnerMemberInWorkspace } from '../../../common/utils/transaction-owner.util';
import {
  assertWorkspaceOwned,
  assertWorkspaceRefs,
} from '../../../common/utils/workspace-refs.util';
import { PaymentType } from '../../../contracts';
import { Category } from '../../../entities/category.entity';
import { Payee } from '../../../entities/payee.entity';
import { Tag } from '../../../entities/tag.entity';
import { Wallet } from '../../../entities/wallet.entity';
import type { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { findOrCreatePayeeByName } from '../../payees/payee-resolution';
import {
  conditionRefs,
  conditionValues,
  EMPTINESS_OPERATORS,
  leafConditions,
} from '../engine/rule-condition-tree';
import type {
  ClassificationCondition,
  ClassificationResult,
  RuleConditionNode,
} from '../interfaces/classification-rule.interface';

const DIRECTIONS = new Set(['income', 'expense']);
const PAYMENT_TYPES = new Set<string>(PaymentType.literals);

function invalid(condition: ClassificationCondition): BadRequestException {
  return new BadRequestException(
    appError('CATEGORIZATION_RULE_CONDITION_INVALID', {
      field: condition.field,
      value: String(condition.value),
    }),
  );
}

type Operator = ClassificationCondition['operator'];

const TEXT_OPERATORS: Operator[] = [
  'contains',
  'equals',
  'starts_with',
  'ends_with',
  'regex',
  'not_contains',
  'not_equals',
  // Kept for rules saved through the API before fields had their own operators.
  'greater_than',
  'less_than',
];
const NUMBER_OPERATORS: Operator[] = ['equals', 'greater_than', 'less_than', 'between'];
const CHOICE_OPERATORS: Operator[] = ['equals', 'not_equals'];
/** Text a row may also lack: a payee, a purpose, a reference, a comment. */
const BLANKABLE_TEXT_OPERATORS: Operator[] = [...TEXT_OPERATORS, 'is_empty', 'is_not_empty'];
/** A category, a payee, tags: one of these ids (tags: any of them), none of them, or nothing. */
const REF_OPERATORS: Operator[] = ['equals', 'not_equals', 'is_empty', 'is_not_empty'];

/** The checks each field takes. A field not listed here is free text. */
const OPERATORS_OF: Partial<Record<ClassificationCondition['field'], Operator[]>> = {
  amount: NUMBER_OPERATORS,
  day_of_month: NUMBER_OPERATORS,
  currency: CHOICE_OPERATORS,
  payment_type: CHOICE_OPERATORS,
  counterparty_name: BLANKABLE_TEXT_OPERATORS,
  payment_purpose: BLANKABLE_TEXT_OPERATORS,
  counterparty_bin: BLANKABLE_TEXT_OPERATORS,
  document_number: BLANKABLE_TEXT_OPERATORS,
  comment: BLANKABLE_TEXT_OPERATORS,
  category: REF_OPERATORS,
  payee: REF_OPERATORS,
  tags: REF_OPERATORS,
};

const REF_FIELDS = new Set<ClassificationCondition['field']>(['category', 'payee', 'tags']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether every value of a numeric condition is a number the field can hold, in order. */
function numbersHold(condition: ClassificationCondition): boolean {
  const range = condition.operator === 'between';
  if ((condition.valueTo !== undefined) !== range || typeof condition.value === 'object') {
    return false;
  }
  const numbers = range ? [Number(condition.value), condition.valueTo] : [Number(condition.value)];
  const day = condition.field === 'day_of_month';
  return (
    numbers.every(
      number =>
        typeof number === 'number' &&
        Number.isFinite(number) &&
        (!day || (Number.isInteger(number) && number >= 1 && number <= 31)),
    ) &&
    (!range || Number(condition.value) <= Number(condition.valueTo))
  );
}

/** Whether the condition asks something that can hold: a check its field takes, with values that fit it. */
function conditionHolds(condition: ClassificationCondition): boolean {
  const operators = OPERATORS_OF[condition.field] ?? TEXT_OPERATORS;
  if (!operators.includes(condition.operator)) {
    return false;
  }
  if (operators === NUMBER_OPERATORS) {
    return numbersHold(condition);
  }
  if (condition.valueTo !== undefined) {
    return false;
  }
  if (EMPTINESS_OPERATORS.has(condition.operator)) {
    // Nothing to compare with: a value here would be a mistake read as a check.
    return condition.value === '';
  }
  const values = conditionValues(condition).map(String);
  if (REF_FIELDS.has(condition.field)) {
    return values.every(value => UUID.test(value));
  }
  switch (condition.field) {
    case 'direction':
      return values.every(value => DIRECTIONS.has(value));
    case 'payment_type':
      return values.every(value => PAYMENT_TYPES.has(value));
    case 'currency':
      return values.every(value => /^[a-z]{3}$/i.test(value));
    default:
      // A pattern is one pattern: alternatives belong inside it.
      return condition.operator !== 'regex' || typeof condition.value === 'string';
  }
}

/**
 * A condition that could never hold is the caller's mistake, not a rule that
 * silently never fires: a regex that does not compile, a direction other than
 * income or expense, an amount that is not a number, a range the wrong way
 * round, a check the field does not take.
 */
export function assertConditionsValid(nodes: readonly RuleConditionNode[]): void {
  for (const condition of leafConditions(nodes)) {
    if (condition.operator === 'regex' && typeof condition.value === 'string') {
      try {
        new RegExp(condition.value, 'i');
      } catch {
        throw new BadRequestException(
          appError('CATEGORIZATION_RULE_PATTERN_INVALID', { pattern: condition.value }),
        );
      }
    }
    if (!conditionHolds(condition)) {
      throw invalid(condition);
    }
  }
}

/**
 * Every id a rule names, in its conditions and in what it sets, belongs to this
 * workspace: each row the rule matches would point at it.
 */
export async function assertRuleRefs(
  manager: EntityManager,
  members: Repository<WorkspaceMember>,
  workspaceId: string,
  rule: {
    conditions?: readonly RuleConditionNode[] | null;
    result?: ClassificationResult | null;
  },
): Promise<void> {
  const asked = (field: ClassificationCondition['field']) => conditionRefs(rule.conditions, field);
  await Promise.all([
    assertWorkspaceOwned(manager, Wallet, asked('wallet'), workspaceId),
    assertWorkspaceOwned(manager, Category, asked('category'), workspaceId),
    assertWorkspaceOwned(
      manager,
      Tag,
      [...asked('tags'), ...(rule.result?.tagIds ?? [])],
      workspaceId,
    ),
    assertWorkspaceOwned(manager, Payee, [...asked('payee'), rule.result?.payeeId], workspaceId),
    assertWorkspaceRefs(manager, workspaceId, rule.result ?? {}),
    assertOwnerMemberInWorkspace(members, workspaceId, rule.result?.ownerMemberId),
    // The one member told about new matches; `null` is every member.
    assertOwnerMemberInWorkspace(members, workspaceId, rule.result?.notify?.memberId),
  ]);
}

/**
 * Whether the rule sets anything "apply to existing rows" can write. Telling
 * people is not one of them: applying a rule to old rows notifies nobody.
 */
export function hasApplicableAction(result: ClassificationResult): boolean {
  return Boolean(
    result.categoryId ||
      result.walletId ||
      result.tagIds?.length ||
      result.comment ||
      result.payeeId ||
      result.excludeFromBudgets,
  );
}

/**
 * What a rule sets, as it is stored: a payee given by name becomes the id of
 * the workspace's payee of that name, made now when there is none. An id
 * given beside the name is the one that counts.
 */
export async function resolveRulePayee<Result extends ClassificationResult>(
  manager: EntityManager,
  workspaceId: string,
  input: Result & { payeeName?: string },
): Promise<Result> {
  const { payeeName, ...result } = input;
  if (payeeName === undefined || result.payeeId) {
    return result as Result;
  }
  const payee = await findOrCreatePayeeByName(manager, workspaceId, payeeName);
  return { ...result, payeeId: payee.id } as Result;
}
