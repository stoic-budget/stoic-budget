import type { Transaction } from '@/entities/transaction.entity';
import { layerRules, matchingRules } from '@/modules/classification/engine/rule-layers';
import type {
  ClassificationResult,
  ClassificationRule,
} from '@/modules/classification/interfaces/classification-rule.interface';

const STORE = 'ACME Store - Wireless Buds';
const row = { counterpartyName: STORE, paymentPurpose: 'Card payment', amount: 25 } as Transaction;

function rule(name: string, result: ClassificationResult, value = 'acme store'): ClassificationRule {
  return {
    id: name,
    name,
    type: 'category',
    conditions: [{ field: 'counterparty_name', operator: 'contains', value }],
    result,
    priority: 0,
    isActive: true,
  };
}

describe('rules laid over each other', () => {
  it('keeps only the rules that match the row, in their order', () => {
    const rules = [rule('a', {}), rule('b', {}, 'corner bakery'), rule('c', {})];

    expect(matchingRules(rules, row).map(match => match.name)).toEqual(['a', 'c']);
  });

  it('gives each field to the best rule that decides it', () => {
    const tagsOnly = rule('tags only', { tagIds: ['tag-gadgets'] });
    const files = rule('files', { categoryId: 'cat-electronics' });
    const filesToo = rule('files too', { categoryId: 'cat-other', walletId: 'wallet-cash' });

    const layers = layerRules([tagsOnly, files, filesToo]);

    // The rule that only tags no longer keeps the row from its category.
    expect(layers.setBy.categoryId).toBe(files);
    // The third rule lost the category but still decides the account.
    expect(layers.setBy.walletId).toBe(filesToo);
    expect(layers.contributors).toEqual([tagsOnly, files, filesToo]);
  });

  it('adds the tags of every matching rule, each once', () => {
    const layers = layerRules([
      rule('one', { tagIds: ['tag-a', 'tag-b'] }),
      rule('two', { tagIds: ['tag-b', 'tag-c'] }),
    ]);

    expect(layers.tagIds).toEqual(['tag-a', 'tag-b', 'tag-c']);
  });

  it('takes an owner of null for a decision: the household', () => {
    const shared = rule('shared', { ownerMemberId: null });
    const mine = rule('mine', { ownerMemberId: 'member-1' });

    expect(layerRules([shared, mine]).setBy.ownerMemberId).toBe(shared);
    expect(layerRules([rule('silent', {}), mine]).setBy.ownerMemberId).toBe(mine);
  });

  it('leaves out a rule that added nothing', () => {
    const first = rule('first', { categoryId: 'cat-electronics', tagIds: ['tag-a'] });
    const repeats = rule('repeats', { categoryId: 'cat-other', tagIds: ['tag-a'] });

    expect(layerRules([first, repeats]).contributors).toEqual([first]);
  });

  it('is empty when nothing matches', () => {
    expect(layerRules([])).toEqual({ setBy: {}, tagIds: [], contributors: [] });
  });
});

describe('a rule that leaves a new row out of budgets', () => {
  it('writes the flag onto the row being imported, alongside what the other rules set', async () => {
    const { applyRuleLayers } = await import('@/modules/classification/engine/rule-result');
    const classification: Partial<Transaction> = {};

    applyRuleLayers(
      layerRules([
        rule('files', { categoryId: 'cat-electronics' }),
        rule('leaves out', { excludeFromBudgets: true }),
      ]),
      classification,
      row,
    );

    expect(classification).toMatchObject({
      categoryId: 'cat-electronics',
      excludedFromBudgets: true,
    });
  });

  it('counts the rule as one that added to the row, so its history names it', () => {
    const leaving = rule('leaves out', { excludeFromBudgets: true });

    expect(layerRules([leaving]).contributors).toEqual([leaving]);
  });

  it('leaves the flag alone when no rule asks for it, and a rule that only tells adds nothing', async () => {
    const { applyRuleLayers } = await import('@/modules/classification/engine/rule-result');
    const classification: Partial<Transaction> = {};
    const telling = rule('tells', { notify: { memberId: null } });

    applyRuleLayers(layerRules([telling]), classification, row);

    expect(classification).not.toHaveProperty('excludedFromBudgets');
    expect(layerRules([telling]).contributors).toEqual([]);
  });
});
