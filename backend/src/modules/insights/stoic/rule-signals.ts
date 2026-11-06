import { InsightType } from '../../../entities/insight.entity';
import type { RuleHealth } from '../../classification/services/rule-health.service';
import type { StoicSignal } from './stoic-signals';

/** Rows of a month a rule must have filed, and their share, before it is praised. */
const PRAISE_MIN_ROWS = 20;
const PRAISE_MIN_SHARE = 0.5;

/**
 * Rules are decisions made once, with a clear head. These signals ask whether
 * they still hold: one that points at nothing, one the person keeps overruling,
 * a decision they keep making by hand, a rule nothing meets any more.
 */
export function ruleSignals(health: RuleHealth | null): StoicSignal[] {
  if (!health) {
    return [];
  }
  return [
    ...health.broken.slice(0, 1).map(
      (rule): StoicSignal => ({
        key: 'stoic.rule_broken',
        type: InsightType.STOIC_RULE,
        priority: 55,
        params: { rule: rule.name },
        data: { ruleId: rule.id },
        subject: rule.id,
      }),
    ),
    ...health.contradicted.slice(0, 1).map(
      (rule): StoicSignal => ({
        key: 'stoic.rule_contradicted',
        type: InsightType.STOIC_RULE,
        priority: 45,
        params: { rule: rule.name, count: rule.count },
        data: { ruleId: rule.id },
        subject: rule.id,
      }),
    ),
    ...worthWriting(health),
    ...health.idle.slice(0, 1).map(
      (rule): StoicSignal => ({
        key: 'stoic.rule_idle',
        type: InsightType.STOIC_RULE,
        priority: 17,
        params: { rule: rule.name, months: rule.months },
        data: { ruleId: rule.id },
        subject: rule.id,
      }),
    ),
    ...rulesHold(health),
  ];
}

function worthWriting({ worthWriting: found }: RuleHealth): StoicSignal[] {
  return found
    ? [
        {
          key: 'stoic.rule_worth_writing',
          type: InsightType.STOIC_RULE,
          priority: 28,
          params: { count: found.count, payee: found.payee, decided: found.decided },
        },
      ]
    : [];
}

function rulesHold({ filed, contradicted, broken }: RuleHealth): StoicSignal[] {
  const holds =
    contradicted.length === 0 &&
    broken.length === 0 &&
    filed.byRule >= PRAISE_MIN_ROWS &&
    filed.byRule / filed.total >= PRAISE_MIN_SHARE;
  return holds
    ? [
        {
          key: 'stoic.praise_rules_hold',
          type: InsightType.STOIC_PRAISE,
          priority: 0,
          praise: true,
          params: { percent: Math.round((filed.byRule / filed.total) * 100) },
          data: { target: 'rules' },
        },
      ]
    : [];
}
