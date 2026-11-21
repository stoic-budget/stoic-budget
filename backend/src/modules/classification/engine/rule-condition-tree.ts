import type {
  ClassificationCondition,
  ClassificationConditionGroup,
  RuleConditionNode,
} from '../interfaces/classification-rule.interface';

/** Checks that need no value: the field is blank, or it is not. */
export const EMPTINESS_OPERATORS = new Set<ClassificationCondition['operator']>([
  'is_empty',
  'is_not_empty',
]);

/** Whether the entry is a group of conditions rather than one condition. */
export function isConditionGroup(node: RuleConditionNode): node is ClassificationConditionGroup {
  return Array.isArray((node as Partial<ClassificationConditionGroup>).conditions);
}

/** Every condition of a rule, those inside its groups too. */
export function leafConditions(nodes: readonly RuleConditionNode[]): ClassificationCondition[] {
  return nodes.flatMap(node => (isConditionGroup(node) ? node.conditions : [node]));
}

/** The values a condition holds: several for "any of them", else its one. */
export function conditionValues(condition: ClassificationCondition): Array<string | number> {
  return typeof condition.value === 'string' || typeof condition.value === 'number'
    ? [condition.value]
    : [...condition.value];
}

/** The ids a rule's conditions on `field` name. A check for blank names none. */
export function conditionRefs(
  nodes: readonly RuleConditionNode[] | null | undefined,
  field: ClassificationCondition['field'],
): string[] {
  return leafConditions(nodes ?? [])
    .filter(condition => condition.field === field && !EMPTINESS_OPERATORS.has(condition.operator))
    .flatMap(condition => conditionValues(condition).map(String));
}

/** Whether any condition of the rules looks at `field`. */
export function conditionsUse(
  rules: ReadonlyArray<{ conditions: readonly RuleConditionNode[] }>,
  field: ClassificationCondition['field'],
): boolean {
  return rules.some(rule => leafConditions(rule.conditions).some(one => one.field === field));
}

/**
 * The conditions with every id of `from` on `field` replaced by `to`: a payee
 * folded into another is the one the rule asks about from then on.
 */
export function replaceConditionRefs(
  nodes: readonly RuleConditionNode[],
  field: ClassificationCondition['field'],
  from: ReadonlySet<string>,
  to: string,
): RuleConditionNode[] {
  const swap = (condition: ClassificationCondition): ClassificationCondition => {
    if (condition.field !== field) {
      return condition;
    }
    const { value } = condition;
    if (typeof value === 'string') {
      return from.has(value) ? { ...condition, value: to } : condition;
    }
    if (typeof value === 'number') {
      return condition;
    }
    return { ...condition, value: [...new Set(value.map(one => (from.has(one) ? to : one)))] };
  };
  return nodes.map(node =>
    isConditionGroup(node) ? { ...node, conditions: node.conditions.map(swap) } : swap(node),
  );
}
