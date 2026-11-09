import { OWNER_SHARED } from '../../../common/utils/transaction-owner.util';
import type { RulePack } from '../../../contracts/classification/rule-packs';
import { EMPTINESS_OPERATORS, isConditionGroup } from '../engine/rule-condition-tree';
import type {
  ClassificationCondition,
  ClassificationResult,
  MatchMode,
  RuleConditionNode,
} from '../interfaces/classification-rule.interface';

export type PackRule = RulePack['rules'][number];
/** What a pack rule names, and has to be found in the workspace by that name. */
export type RefKind = 'category' | 'tag' | 'payee' | 'account' | 'member';
/** The workspace's names of each kind: by id to export, by lower-cased name to import. */
export type NameBook = Record<RefKind, ReadonlyMap<string, string>>;

export interface MissingName {
  kind: RefKind;
  name: string;
  creatable: boolean;
}

/** A pack rule turned into the workspace's ids, with the names it could not find. */
export interface ResolvedPackRule {
  conditions: RuleConditionNode[];
  matchMode: MatchMode;
  result: ClassificationResult;
  missing: MissingName[];
}

/**
 * Stands in for a name the workspace lacks, so the rule can still be checked
 * and tried: no row points at it, so "is" never holds and "is not" always does.
 */
export const UNRESOLVED_ID = '00000000-0000-4000-8000-000000000000';

const FIELD_KIND: Partial<Record<ClassificationCondition['field'], RefKind>> = {
  category: 'category',
  payee: 'payee',
  tags: 'tag',
  wallet: 'account',
  owner: 'member',
};
const CREATABLE = new Set<RefKind>(['category', 'tag', 'payee']);

/** The key a name is looked up by: case and the spaces around it do not count. */
export const nameKey = (name: string) => name.trim().toLowerCase();

/** The conditions with each value on a field that points at something passed through `swap`. */
function swapRefs(
  nodes: readonly RuleConditionNode[],
  swap: (kind: RefKind, value: string) => string,
): RuleConditionNode[] {
  const one = (condition: ClassificationCondition): ClassificationCondition => {
    const kind = FIELD_KIND[condition.field];
    if (!kind || EMPTINESS_OPERATORS.has(condition.operator)) {
      return condition;
    }
    // The household is a word, not a member: it travels as it is.
    const map = (value: string) =>
      kind === 'member' && value === OWNER_SHARED ? value : swap(kind, value);
    const { value } = condition;
    if (typeof value === 'number') {
      return condition;
    }
    return { ...condition, value: typeof value === 'string' ? map(value) : value.map(map) };
  };
  return nodes.map(node =>
    isConditionGroup(node) ? { ...node, conditions: node.conditions.map(one) } : one(node),
  );
}

/**
 * A rule as a pack holds it: what it matches and sets by name, never by id.
 * An id whose record is gone has no name and travels as an empty one, which
 * no workspace has and no import makes. A gone tag it adds is dropped instead:
 * adding it does nothing here either (rule-tags).
 */
export function toPackRule(
  rule: {
    name: string;
    description: string | null;
    isActive: boolean;
    matchMode: MatchMode;
    conditions: RuleConditionNode[];
    result: ClassificationResult;
  },
  names: NameBook,
  folder: string | null,
): PackRule {
  const name = (kind: RefKind, id: string) => names[kind].get(id) ?? '';
  const { result } = rule;
  const tags = (result.tagIds ?? []).flatMap(id => names.tag.get(id) ?? []);
  return {
    name: rule.name,
    description: rule.description,
    folder,
    isActive: rule.isActive,
    matchMode: rule.matchMode,
    conditions: swapRefs(rule.conditions, name) as PackRule['conditions'],
    result: {
      ...(result.categoryId ? { category: name('category', result.categoryId) } : {}),
      ...(result.walletId ? { account: name('account', result.walletId) } : {}),
      ...(result.ownerMemberId !== undefined
        ? { owner: result.ownerMemberId === null ? null : name('member', result.ownerMemberId) }
        : {}),
      ...(tags.length ? { tags } : {}),
      ...(result.payeeId ? { payee: name('payee', result.payeeId) } : {}),
      ...(result.comment ? { comment: result.comment } : {}),
      ...(result.excludeFromBudgets ? { excludeFromBudgets: true as const } : {}),
      ...(result.notify
        ? {
            notify: {
              member: result.notify.memberId ? name('member', result.notify.memberId) : null,
            },
          }
        : {}),
    },
  };
}

/**
 * A pack rule in this workspace's ids. A name the workspace lacks becomes
 * `UNRESOLVED_ID` and is listed: a category, tag or payee can be made, an
 * account or a member cannot, nor a blank name (a record gone where the pack
 * was made).
 */
export function resolvePackRule(rule: PackRule, ids: NameBook): ResolvedPackRule {
  const missing = new Map<string, MissingName>();
  const id = (kind: RefKind, name: string) => {
    const key = nameKey(name);
    const found = key ? ids[kind].get(key) : undefined;
    if (found) {
      return found;
    }
    missing.set(`${kind}:${key}`, { kind, name, creatable: Boolean(key) && CREATABLE.has(kind) });
    return UNRESOLVED_ID;
  };
  const { result: from } = rule;
  const result: ClassificationResult = {
    // An empty name is there to be found missing, not to be passed over.
    ...(from.category !== undefined ? { categoryId: id('category', from.category) } : {}),
    ...(from.account !== undefined ? { walletId: id('account', from.account) } : {}),
    ...(from.owner !== undefined
      ? { ownerMemberId: from.owner === null ? null : id('member', from.owner) }
      : {}),
    ...(from.tags?.length ? { tagIds: from.tags.map(tag => id('tag', tag)) } : {}),
    ...(from.payee !== undefined ? { payeeId: id('payee', from.payee) } : {}),
    ...(from.comment ? { comment: from.comment } : {}),
    ...(from.excludeFromBudgets ? { excludeFromBudgets: true } : {}),
    ...(from.notify
      ? {
          notify: {
            memberId: from.notify.member === null ? null : id('member', from.notify.member),
          },
        }
      : {}),
  };
  const conditions = swapRefs(rule.conditions as RuleConditionNode[], id);
  return { conditions, matchMode: rule.matchMode, result, missing: [...missing.values()] };
}

/** A missing category goes in as income when the rule asks for income rows, else as spending. */
export function categoryTypeOf(rule: PackRule): 'income' | 'expense' {
  const asksIncome = rule.conditions
    .flatMap(node => ('conditions' in node ? node.conditions : [node]))
    .some(
      condition =>
        condition.field === 'direction' &&
        condition.operator === 'equals' &&
        condition.value === 'income',
    );
  return asksIncome ? 'income' : 'expense';
}
