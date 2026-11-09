import { CategorizationRule } from '@/entities/categorization-rule.entity';
import { Payee } from '@/entities/payee.entity';
import { Tag } from '@/entities/tag.entity';
import { type Transaction, TransactionCategorySource } from '@/entities/transaction.entity';
import { planRuleApply } from '@/modules/classification/engine/rule-apply-plan';
import { movePayeeConditionsInto } from '@/modules/classification/engine/rule-payee-merge';
import { applicableRules } from '@/modules/classification/engine/rule-refs';
import { assertRuleRefs } from '@/modules/classification/helpers/rule-validation';
import type { ClassificationRule } from '@/modules/classification/interfaces/classification-rule.interface';
import { RuleApplicationService } from '@/modules/classification/services/rule-application.service';
import { RuleHealthService } from '@/modules/classification/services/rule-health.service';

const WORKSPACE = 'workspace-1';
const STORE = 'ACME Store - Wireless Buds';
const GROCERIES = '11111111-1111-4111-8111-111111111111';
const GADGETS = '22222222-2222-4222-8222-222222222222';
const TAG_WORK = '44444444-4444-4444-8444-444444444444';
const FOREIGN = '99999999-9999-4999-8999-999999999999';

function row(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    workspaceId: WORKSPACE,
    counterpartyName: STORE,
    paymentPurpose: 'Card payment',
    transactionDate: '2026-10-01',
    debit: 25,
    amount: 25,
    categoryId: null,
    categorySource: null,
    isPrivate: false,
    ownerMemberId: null,
    createdAt: new Date(2026, 9, 20),
    ...overrides,
  } as unknown as Transaction;
}

const rule = (id: string, overrides: Partial<ClassificationRule> = {}) =>
  ({
    id,
    name: id,
    type: 'category',
    conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme' }],
    matchMode: 'all',
    result: {},
    priority: 0,
    isActive: true,
    createdAt: new Date(2026, 0, 1),
    ...overrides,
  }) as ClassificationRule & CategorizationRule;

const files = rule('files groceries', { priority: 3, result: { categoryId: GROCERIES } });
const blankOnly = rule('blank is gadgets', {
  priority: 2,
  conditions: [{ field: 'category', operator: 'is_empty', value: '' }],
  result: { categoryId: GADGETS },
});
const groceriesTagged = rule('groceries tagged', {
  priority: 1,
  conditions: [
    { field: 'category', operator: 'equals', value: GROCERIES },
    {
      matchMode: 'any',
      conditions: [
        { field: 'tags', operator: 'equals', value: TAG_WORK },
        { field: 'amount', operator: 'greater_than', value: 20 },
      ],
    },
  ],
  result: { tagIds: [TAG_WORK] },
});

/** A manager whose workspace owns every id but `FOREIGN`, and whose rows have `tags`. */
function managerWith(tags: Record<string, string[]> = {}) {
  return {
    getRepository: () => ({
      countBy: async ({ id }: { id: { value: string[] } }) =>
        id.value.filter(one => one !== FOREIGN).length,
    }),
    query: vi.fn(async (_sql: string, [, ids]: [string, string[]]) =>
      ids.flatMap(id => (tags[id] ?? []).map(tag_id => ({ transaction_id: id, tag_id }))),
    ),
  };
}

describe('the rules on a row being classified', () => {
  it('try each rule on the row as the rules above left it', async () => {
    const applicable = await applicableRules(
      managerWith() as never,
      WORKSPACE,
      [groceriesTagged, blankOnly, files],
      row('new'),
    );

    expect(applicable.map(one => one.id)).toEqual(['files groceries', 'groceries tagged']);
  });

  it('lay nothing over from a rule passed over for naming what is not the workspace’s', async () => {
    const foreign = { ...files, result: { categoryId: FOREIGN } };
    const applicable = await applicableRules(
      managerWith() as never,
      WORKSPACE,
      [foreign, blankOnly],
      row('new'),
    );

    expect(applicable.map(one => one.id)).toEqual(['blank is gadgets']);
  });

  it('read the tags of a saved row when a rule asks about them, and only then', async () => {
    const asksTags = rule('work rows', {
      conditions: [{ field: 'tags', operator: 'equals', value: TAG_WORK }],
      result: { categoryId: GADGETS },
    });
    const manager = managerWith({ saved: [TAG_WORK] });

    expect(await applicableRules(manager as never, WORKSPACE, [asksTags], row('saved'))).toHaveLength(1);
    expect(await applicableRules(manager as never, WORKSPACE, [asksTags], row('other'))).toHaveLength(0);
    expect(manager.query).toHaveBeenCalledTimes(2);
    // A row being imported has no id and no tags yet: nothing to read.
    await applicableRules(manager as never, WORKSPACE, [asksTags], row(undefined as never));
    await applicableRules(manager as never, WORKSPACE, [files], row('saved'));
    expect(manager.query).toHaveBeenCalledTimes(2);
  });
});

describe('the rules on a row classified again', () => {
  const PAYEE = '55555555-5555-4555-8555-555555555555';
  const NOTE = 'Filed by rule';
  const ids = async (rules: ClassificationRule[], saved: Transaction, tags: string[] = []) =>
    (await applicableRules(managerWith({ [saved.id]: tags }) as never, WORKSPACE, rules, saved)).map(
      one => one.id,
    );

  it('still match a row they filed when they ask for no category, or not their own', async () => {
    const notGadgets = rule('not gadgets', {
      conditions: [{ field: 'category', operator: 'not_equals', value: GADGETS }],
      result: { categoryId: GADGETS },
    });
    const filed = row('filed', { categoryId: GADGETS, categorySource: TransactionCategorySource.RULE });

    expect(await ids([blankOnly], filed)).toEqual(['blank is gadgets']);
    expect(await ids([notGadgets], filed)).toEqual(['not gadgets']);
  });

  it('leave a category a person picked, or one on a filed tax return, as the row’s', async () => {
    const picked = row('picked', { categoryId: GROCERIES, categorySource: TransactionCategorySource.MANUAL });
    const locked = row('locked', {
      categoryId: GROCERIES,
      categorySource: TransactionCategorySource.RULE,
      taxLocked: true,
    });

    expect(await ids([blankOnly], picked)).toEqual([]);
    expect(await ids([blankOnly], locked)).toEqual([]);
  });

  it('still match a row they tagged when they ask for none of that tag; a person’s other tag counts', async () => {
    const TAG_OTHER = '66666666-6666-4666-8666-666666666666';
    const untagged = rule('untagged', {
      conditions: [{ field: 'tags', operator: 'not_equals', value: [TAG_WORK] }],
      result: { categoryId: GADGETS, tagIds: [TAG_WORK] },
    });
    const other = rule('other', {
      conditions: [{ field: 'tags', operator: 'equals', value: TAG_OTHER }],
      result: { categoryId: GROCERIES },
    });
    const saved = row('saved', { categoryId: GADGETS, categorySource: TransactionCategorySource.RULE });

    expect(await ids([untagged], saved, [TAG_WORK])).toEqual(['untagged']);
    expect(await ids([untagged, other], saved, [TAG_WORK])).toEqual(['untagged']);
    expect(await ids([untagged, other], saved, [TAG_WORK, TAG_OTHER])).toEqual(['untagged', 'other']);
  });

  it('still match a row they gave a payee or a comment when they ask for none', async () => {
    const namesPayee = rule('names payee', {
      conditions: [{ field: 'payee', operator: 'is_empty', value: '' }],
      result: { payeeId: PAYEE },
    });
    const writesNote = rule('writes note', {
      conditions: [{ field: 'comment', operator: 'is_empty', value: '' }],
      result: { comment: NOTE },
    });
    const byRule = row('by rule', { payeeId: PAYEE, payeeSource: 'rule', comments: NOTE });
    const byHand = row('by hand', { payeeId: PAYEE, payeeSource: 'manual', comments: 'Own note' });

    expect(await ids([namesPayee, writesNote], byRule)).toEqual(['names payee', 'writes note']);
    expect(await ids([namesPayee, writesNote], byHand)).toEqual([]);
  });
});

describe('applying a rule whose conditions read what rules above set', () => {
  it('matches a row a rule above files, and leaves the category to it', () => {
    const plan = planRuleApply([row('open'), row('far', { counterpartyName: 'Corner Bakery' })], groceriesTagged, {
      above: [files],
      viewerMemberId: null,
      setsCategory: false,
      setsTags: true,
    });

    expect(plan.matches.map(one => one.id)).toEqual(['open']);
    expect(plan.tagged.map(one => one.id)).toEqual(['open']);
  });

  it('counts a row missing from the loaded tags as having none, not its relation', () => {
    const work = rule('work', {
      conditions: [{ field: 'tags', operator: 'is_empty', value: '' }],
      result: { categoryId: GADGETS },
    });
    const stale = row('stale', { tags: [{ id: TAG_WORK }] as Transaction['tags'] });
    const base = { viewerMemberId: null, setsCategory: true, setsTags: false };

    expect(planRuleApply([stale], work, { ...base, tagIds: new Map() }).matches).toHaveLength(1);
    expect(planRuleApply([stale], work, base).matches).toHaveLength(0);
  });
});

describe('the preview of a rule below others', () => {
  function previewService(rows: Transaction[], above: unknown[], tags: Record<string, string[]> = {}) {
    const query = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn(async () => rows),
    };
    const manager = {
      ...managerWith(tags),
      getRepository: (entity: unknown) =>
        entity === CategorizationRule ? { find: async () => above } : managerWith().getRepository(),
    };
    const transactions = { createQueryBuilder: () => query, manager };
    return new RuleApplicationService(transactions as never, {} as never, {} as never, {} as never, {} as never);
  }

  it('reads rows as the rules above leave them, marks who wins and says why', async () => {
    const draft = rule('draft', { conditions: groceriesTagged.conditions });
    const service = previewService([row('open'), row('tagged', { amount: 5 })], [files, draft], {
      tagged: [TAG_WORK],
    });

    const preview = await service.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: null,
      conditions: draft.conditions,
      ruleId: 'draft',
    });

    expect(preview.matches.map(match => match.id)).toEqual(['open', 'tagged']);
    expect(preview.shadowed).toBe(2);
    expect(preview.matches[0].wonBy).toEqual({ id: 'files groceries', name: 'files groceries' });
    expect(preview.matches[1].matchReason).toBe(
      `category equals "${GROCERIES}" (set by "files groceries") AND (tags equals "${TAG_WORK}")`,
    );
  });

  it('matches nothing a rule above has filed when it asks for no category', async () => {
    const draft = rule('draft', { conditions: blankOnly.conditions });
    const service = previewService([row('open')], [files, draft]);

    const preview = await service.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: null,
      conditions: draft.conditions,
      ruleId: 'draft',
    });
    const fresh = await service.previewRule({
      workspaceId: WORKSPACE,
      viewerMemberId: null,
      conditions: draft.conditions,
    });

    expect(preview.matchedTransactions).toBe(0);
    expect(fresh.matchedTransactions).toBe(1);
  });
});

describe('rule health on rules that ask about the category', () => {
  it('runs them on the row as it arrived, before the person filed it', async () => {
    const qb: Record<string, unknown> = {};
    for (const method of ['where', 'andWhere', 'orderBy', 'take']) {
      qb[method] = vi.fn(() => qb);
    }
    const filedByHand = (id: string) =>
      row(id, { categoryId: 'fun', categorySource: TransactionCategorySource.MANUAL });
    qb.getMany = vi.fn(async () => [filedByHand('a'), filedByHand('b'), filedByHand('c')]);
    const service = new RuleHealthService(
      { manager: managerWith() } as never,
      { createQueryBuilder: () => qb, manager: managerWith() } as never,
      {} as never,
      {} as never,
    );

    const contradicted = await (
      service as unknown as {
        contradictedRules: (ws: string, rules: unknown[], now: Date) => Promise<unknown[]>;
      }
    ).contradictedRules(WORKSPACE, [blankOnly], new Date(2026, 10, 1));

    expect(contradicted).toEqual([{ id: 'blank is gadgets', name: 'blank is gadgets', count: 3 }]);
  });
});

describe('saving a rule that names ids in its conditions', () => {
  const members = { findOne: async () => null } as never;
  const owned = (conditions: unknown[]) =>
    assertRuleRefs(managerWith() as never, members, WORKSPACE, { conditions: conditions as never, result: {} });

  it("refuses another workspace's category, tag or payee, inside a group too", async () => {
    await expect(owned([{ field: 'category', operator: 'equals', value: GROCERIES }])).resolves.toBeUndefined();
    await expect(owned([{ field: 'category', operator: 'equals', value: FOREIGN }])).rejects.toThrow();
    await expect(owned([{ field: 'tags', operator: 'not_equals', value: [TAG_WORK, FOREIGN] }])).rejects.toThrow();
    await expect(
      owned([{ matchMode: 'any', conditions: [{ field: 'payee', operator: 'equals', value: FOREIGN }] }]),
    ).rejects.toThrow();
  });

  it('looks each kind up as what it is', async () => {
    const asked: unknown[] = [];
    const manager = {
      getRepository: (entity: unknown) => ({
        countBy: async ({ id }: { id: { value: string[] } }) => {
          asked.push([entity, id.value]);
          return id.value.length;
        },
      }),
    };
    await assertRuleRefs(manager as never, members, WORKSPACE, {
      conditions: [
        { field: 'tags', operator: 'equals', value: TAG_WORK },
        { field: 'payee', operator: 'is_empty', value: '' },
      ],
      result: {},
    });

    expect(asked).toContainEqual([Tag, [TAG_WORK]]);
    expect(asked.some(entry => (entry as unknown[])[0] === Payee)).toBe(false);
  });
});

describe('merging payees', () => {
  it("rewrites the workspace's rules that ask about a merged payee", async () => {
    const stored = [
      { id: 'rule-a', conditions: [{ field: 'payee', operator: 'equals', value: FOREIGN }] },
    ];
    const query = vi.fn(async (sql: string) => (sql.startsWith('SELECT') ? stored : undefined));

    await movePayeeConditionsInto({ query } as never, WORKSPACE, GADGETS, [FOREIGN]);

    expect(query.mock.calls[0][1]).toEqual([WORKSPACE, [`%"${FOREIGN}"%`]]);
    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining('WHERE workspace_id = $2 AND id = $3'),
      [JSON.stringify([{ field: 'payee', operator: 'equals', value: GADGETS }]), WORKSPACE, 'rule-a'],
    ]);
  });
});
