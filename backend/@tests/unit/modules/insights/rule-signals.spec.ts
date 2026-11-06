import { InsightType } from '@/entities/insight.entity';
import type { RuleHealth } from '@/modules/classification/services/rule-health.service';
import { ruleSignals } from '@/modules/insights/stoic/rule-signals';

const RULE = { id: 'rule-1', name: 'Rent' };

const healthy: RuleHealth = {
  broken: [],
  contradicted: [],
  worthWriting: null,
  idle: [],
  filed: { byRule: 0, total: 0 },
};

const keys = (health: Partial<RuleHealth>) =>
  ruleSignals({ ...healthy, ...health }).map(signal => signal.key);

describe('Rule signals', () => {
  it('says nothing when the rules could not be read', () => {
    expect(ruleSignals(null)).toEqual([]);
  });

  it('says nothing about rules that hold and are too few to praise', () => {
    expect(keys({ filed: { byRule: 3, total: 4 } })).toEqual([]);
  });

  it('opens the rule that points at nothing, above the serious line', () => {
    const [signal] = ruleSignals({ ...healthy, broken: [RULE] });
    expect(signal).toMatchObject({
      key: 'stoic.rule_broken',
      type: InsightType.STOIC_RULE,
      params: { rule: RULE.name },
      data: { ruleId: RULE.id },
      subject: RULE.id,
    });
    expect(signal.priority).toBeGreaterThanOrEqual(40);
  });

  it('names how often the person overruled a rule', () => {
    const [signal] = ruleSignals({ ...healthy, contradicted: [{ ...RULE, count: 4 }] });
    expect(signal).toMatchObject({
      key: 'stoic.rule_contradicted',
      params: { rule: RULE.name, count: 4 },
      data: { ruleId: RULE.id },
    });
  });

  it('points a decision worth writing at the rules list, not at one rule', () => {
    const [signal] = ruleSignals({
      ...healthy,
      worthWriting: { count: 2, payee: 'ACME Store', decided: 5 },
    });
    expect(signal).toMatchObject({
      key: 'stoic.rule_worth_writing',
      params: { count: 2, payee: 'ACME Store', decided: 5 },
    });
    expect(signal.data).toBeUndefined();
  });

  it('asks about one idle rule at a time, the first it is given', () => {
    const signals = ruleSignals({
      ...healthy,
      idle: [
        { ...RULE, months: 9 },
        { id: 'rule-2', name: 'Gym', months: 6 },
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ key: 'stoic.rule_idle', params: { months: 9 } });
  });

  it('praises rules that file most of the month, undisputed', () => {
    const [signal] = ruleSignals({ ...healthy, filed: { byRule: 30, total: 40 } });
    expect(signal).toMatchObject({
      key: 'stoic.praise_rules_hold',
      type: InsightType.STOIC_PRAISE,
      praise: true,
      params: { percent: 75 },
      data: { target: 'rules' },
    });
  });

  it.each([
    ['too small a share', { filed: { byRule: 20, total: 41 } }],
    ['a rule in dispute', { contradicted: [{ ...RULE, count: 3 }] }],
    ['a broken rule', { broken: [RULE] }],
  ] as const)('does not praise with %s', (_, health) => {
    expect(
      keys({ filed: { byRule: 30, total: 40 }, ...health }),
    ).not.toContain('stoic.praise_rules_hold');
  });
});
