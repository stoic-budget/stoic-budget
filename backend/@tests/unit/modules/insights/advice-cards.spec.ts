import { InsightCategory, InsightSeverity, InsightType } from '@/entities/insight.entity';
import { chooseAdviceCards, MAX_ADVICE_CARDS } from '@/modules/insights/advice-cards';
import type { InsightCandidate } from '@/modules/insights/analyzers/analyzer.interface';

const candidate = (messageKey: InsightCandidate['messageKey'], priority: number) =>
  ({
    type: InsightType.STOIC_PLAN,
    category: InsightCategory.STOIC,
    severity: InsightSeverity.INFO,
    deduplicationKey: `${messageKey}:${priority}`,
    messageKey,
    messageParams: {},
    data: { priority },
  }) satisfies InsightCandidate;

describe('chooseAdviceCards', () => {
  it('puts the most important first, whichever analyzer found it', () => {
    const chosen = chooseAdviceCards(
      [candidate('pattern.risky_allocation', 62)],
      [candidate('stoic.shortfall', 100), candidate('stoic.rule_idle', 17)],
    );
    expect(chosen.map(item => item.messageKey)).toEqual([
      'stoic.shortfall',
      'pattern.risky_allocation',
      'stoic.rule_idle',
    ]);
  });

  it('keeps to the cap, dropping the least important', () => {
    const many = Array.from({ length: MAX_ADVICE_CARDS + 3 }, (_, index) =>
      candidate('stoic.rule_idle', index),
    );
    const chosen = chooseAdviceCards([], many);
    expect(chosen).toHaveLength(MAX_ADVICE_CARDS);
    expect(chosen.at(-1)?.data.priority).toBe(3);
  });

  it('names the unbudgeted category once, in the card that opens its form', () => {
    const top = candidate('pattern.unbudgeted_top_category', 22);
    expect(
      chooseAdviceCards([top], [candidate('stoic.unbudgeted_share', 25)]).map(
        item => item.messageKey,
      ),
    ).toEqual(['stoic.unbudgeted_share']);
    expect(chooseAdviceCards([top], [])).toEqual([top]);
  });

  it('drops the rising card for a category the unusual card already names', () => {
    const about = (
      messageKey: InsightCandidate['messageKey'],
      priority: number,
      categoryId: string,
    ) => ({ ...candidate(messageKey, priority), data: { priority, categoryId } });
    const anomaly = about('trend.category_anomaly', 60, 'category-1');
    const sameRising = about('trend.category_rising', 58, 'category-1');
    const otherRising = about('trend.category_rising', 57, 'category-2');

    expect(chooseAdviceCards([anomaly, sameRising, otherRising], [])).toEqual([
      anomaly,
      otherRising,
    ]);
    expect(chooseAdviceCards([sameRising], [])).toEqual([sameRising]);
  });
});
