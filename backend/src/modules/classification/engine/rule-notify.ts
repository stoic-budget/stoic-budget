import type { Transaction } from '../../../entities/transaction.entity';
import type { ClassificationRule } from '../interfaces/classification-rule.interface';
import { passRules } from './rule-layers';
import { passStartState } from './rule-row-state';

type KeyedRow = Pick<Transaction, 'id' | 'fingerprint' | 'statementId' | 'documentNumber'>;

/**
 * What tells a row apart from every later copy of it: its dedupe fingerprint
 * (the same purchase imported again, from the same file or a new one), else
 * its statement and document number (a bank sync's provider key travels as
 * the document number), else the row itself (a row typed in once).
 */
export function ruleRowKey(row: KeyedRow): string {
  if (row.fingerprint) {
    return `fp:${row.fingerprint}`;
  }
  if (row.statementId && row.documentNumber) {
    return `doc:${row.statementId}:${row.documentNumber}`.slice(0, 200);
  }
  return `row:${row.id}`;
}

/** Who hears about a match: one member, everyone (`null`), or nobody (`undefined`). */
export function notifyRecipient(
  row: Pick<Transaction, 'isPrivate' | 'ownerMemberId'>,
  notify: { memberId: string | null },
): string | null | undefined {
  if (!row.isPrivate) {
    return notify.memberId;
  }
  // A private row is its owner's alone: nobody else hears what it was.
  if (!row.ownerMemberId) {
    return undefined;
  }
  return notify.memberId === null || notify.memberId === row.ownerMemberId
    ? row.ownerMemberId
    : undefined;
}

export interface RuleNotifyMatch {
  row: Transaction;
  rule: ClassificationRule;
  /** One member, or every member with `null`. */
  memberId: string | null;
  key: string;
}

/**
 * The (rule, row) pairs to tell people about among rows just booked: every
 * rule that tells and matches the row, the rules tried best first in one pass
 * as on import (each sees what the matching ones above set on the row). A
 * rule that tells is never a field of the row, so each such rule notifies on
 * its own. `rules` are the workspace's applicable active rules, best first;
 * `tagIds` the rows' tags when a rule asks about them.
 */
export function ruleNotifyMatches(
  rows: readonly Transaction[],
  rules: readonly ClassificationRule[],
  tagIds?: ReadonlyMap<string, readonly string[]>,
): RuleNotifyMatch[] {
  if (!rules.some(rule => rule.result.notify)) {
    return [];
  }
  return rows.flatMap(row => {
    const start = passStartState(row, rules, tagIds ? (tagIds.get(row.id) ?? []) : undefined);
    return passRules(rules, row, start).matching.flatMap(rule => {
      const notify = rule.result.notify;
      const memberId = notify ? notifyRecipient(row, notify) : undefined;
      return memberId === undefined ? [] : [{ row, rule, memberId, key: ruleRowKey(row) }];
    });
  });
}
