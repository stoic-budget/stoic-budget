import * as Schema from 'effect/Schema';
import { RulePack } from '@/contracts/classification/rule-packs';
import {
  categoryTypeOf,
  type NameBook,
  nameKey,
  resolvePackRule,
  toPackRule,
  UNRESOLVED_ID,
} from '@/modules/classification/helpers/rule-pack-names';
import type { ClassificationResult } from '@/modules/classification/interfaces/classification-rule.interface';

const GADGETS = '22222222-2222-4222-8222-222222222222';
const TAG_WORK = '44444444-4444-4444-8444-444444444444';
const PAYEE_ACME = '66666666-6666-4666-8666-666666666666';
const CARD = '88888888-8888-4888-8888-888888888888';
const MEMBER_ONE = '99999999-9999-4999-8999-999999999999';

/** The source workspace's names by id. */
const names: NameBook = {
  category: new Map([[GADGETS, 'Gadgets']]),
  tag: new Map([[TAG_WORK, 'Work']]),
  payee: new Map([[PAYEE_ACME, 'ACME Store']]),
  account: new Map([[CARD, 'Main card']]),
  member: new Map([[MEMBER_ONE, 'Member One']]),
};

/** The same names in another workspace, under other ids, keyed as an import looks them up. */
const OTHER = {
  category: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tag: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  payee: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  account: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  member: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
};
const otherIds: NameBook = {
  category: new Map([[nameKey('Gadgets'), OTHER.category]]),
  tag: new Map([[nameKey('Work'), OTHER.tag]]),
  payee: new Map([[nameKey('ACME Store'), OTHER.payee]]),
  account: new Map([[nameKey('Main card'), OTHER.account]]),
  member: new Map([[nameKey('Member One'), OTHER.member]]),
};

const result: ClassificationResult = {
  categoryId: GADGETS,
  walletId: CARD,
  ownerMemberId: null,
  tagIds: [TAG_WORK],
  payeeId: PAYEE_ACME,
  comment: 'Office kit',
  excludeFromBudgets: true,
  notify: { memberId: MEMBER_ONE },
};
const stored = {
  name: 'ACME office kit',
  description: null,
  isActive: true,
  matchMode: 'all' as const,
  conditions: [
    { field: 'counterparty_name' as const, operator: 'contains' as const, value: 'acme' },
    {
      matchMode: 'any' as const,
      conditions: [
        { field: 'payee' as const, operator: 'equals' as const, value: PAYEE_ACME },
        { field: 'tags' as const, operator: 'not_equals' as const, value: [TAG_WORK] },
        { field: 'owner' as const, operator: 'equals' as const, value: 'shared' },
        { field: 'category' as const, operator: 'is_empty' as const, value: '' },
      ],
    },
  ],
  result,
};

describe('a rule as a pack holds it', () => {
  it('names everything it points at and holds no id', () => {
    const packed = toPackRule(stored, names, 'Office');

    expect(packed.result).toEqual({
      category: 'Gadgets',
      account: 'Main card',
      owner: null,
      tags: ['Work'],
      payee: 'ACME Store',
      comment: 'Office kit',
      excludeFromBudgets: true,
      notify: { member: 'Member One' },
    });
    expect(packed.folder).toBe('Office');
    const text = JSON.stringify(packed);
    for (const id of [GADGETS, TAG_WORK, PAYEE_ACME, CARD, MEMBER_ONE]) {
      expect(text).not.toContain(id);
    }
  });

  it('comes back in another workspace under that workspace’s ids, whole', () => {
    const resolved = resolvePackRule(toPackRule(stored, names, null), otherIds);

    expect(resolved.missing).toEqual([]);
    expect(resolved.result).toEqual({
      categoryId: OTHER.category,
      walletId: OTHER.account,
      ownerMemberId: null,
      tagIds: [OTHER.tag],
      payeeId: OTHER.payee,
      comment: 'Office kit',
      excludeFromBudgets: true,
      notify: { memberId: OTHER.member },
    });
    expect(resolved.conditions).toEqual([
      { field: 'counterparty_name', operator: 'contains', value: 'acme' },
      {
        matchMode: 'any',
        conditions: [
          { field: 'payee', operator: 'equals', value: OTHER.payee },
          { field: 'tags', operator: 'not_equals', value: [OTHER.tag] },
          { field: 'owner', operator: 'equals', value: 'shared' },
          { field: 'category', operator: 'is_empty', value: '' },
        ],
      },
    ]);
  });

  it('finds names whatever their case and the spaces around them', () => {
    const shouting = { ...otherIds, category: new Map([[nameKey('  GADGETS '), OTHER.category]]) };

    expect(resolvePackRule(toPackRule(stored, names, null), shouting).result.categoryId).toBe(
      OTHER.category,
    );
  });
});

describe('names a workspace lacks', () => {
  const empty: NameBook = {
    category: new Map(),
    tag: new Map(),
    payee: new Map(),
    account: new Map(),
    member: new Map(),
  };

  it('lists each once, saying which can be made, and stands in a placeholder for it', () => {
    const resolved = resolvePackRule(toPackRule(stored, names, null), empty);

    expect(resolved.missing).toEqual([
      { kind: 'category', name: 'Gadgets', creatable: true },
      { kind: 'account', name: 'Main card', creatable: false },
      { kind: 'tag', name: 'Work', creatable: true },
      { kind: 'payee', name: 'ACME Store', creatable: true },
      { kind: 'member', name: 'Member One', creatable: false },
    ]);
    expect(resolved.result.categoryId).toBe(UNRESOLVED_ID);
  });

  it('exports a gone record as an empty name, which no workspace resolves', () => {
    const gone = { ...stored, result: { categoryId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } };

    expect(toPackRule(gone, names, null).result).toEqual({ category: '' });
  });

  it('keeps a pack valid when a rule points at gone records, and drops a gone tag it adds', () => {
    const GONE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const stale = {
      ...stored,
      conditions: [{ field: 'payee' as const, operator: 'equals' as const, value: GONE }],
      result: { categoryId: GONE, tagIds: [GONE, TAG_WORK], notify: { memberId: GONE } },
    };
    const packed = toPackRule(stale, names, null);
    const pack = { kind: 'categorization-rules', version: 1, exportedAt: '2026-11-01T10:00:00.000Z' };

    expect(packed.result).toEqual({ category: '', tags: ['Work'], notify: { member: '' } });
    expect(() => Schema.decodeUnknownSync(RulePack)({ ...pack, rules: [packed] })).not.toThrow();
    // A gone tag alone leaves no tags at all.
    expect(toPackRule({ ...stale, result: { tagIds: [GONE] } }, names, null).result).toEqual({});
  });

  it('never offers to make a blank name, which stands for a record gone where the pack was made', () => {
    const blank = {
      ...toPackRule(stored, names, null),
      conditions: [],
      result: { category: '   ', tags: [''], payee: '', comment: 'blank' },
    } as RulePack['rules'][number];

    expect(resolvePackRule(blank, empty).missing).toEqual([
      { kind: 'category', name: '   ', creatable: false },
      { kind: 'tag', name: '', creatable: false },
      { kind: 'payee', name: '', creatable: false },
    ]);
    // Not even when the workspace has a record whose name is blank.
    const withBlank: NameBook = { ...empty, category: new Map([['', OTHER.category]]) };
    expect(resolvePackRule(blank, withBlank).result.categoryId).toBe(UNRESOLVED_ID);
  });
});

describe('the type of a category an import makes', () => {
  const packRule = (conditions: RulePack['rules'][number]['conditions']) =>
    ({ ...toPackRule(stored, names, null), conditions }) as RulePack['rules'][number];

  it('is income for a rule about income rows, spending otherwise', () => {
    expect(
      categoryTypeOf(packRule([{ field: 'direction', operator: 'equals', value: 'income' }])),
    ).toBe('income');
    expect(categoryTypeOf(packRule([{ field: 'amount', operator: 'greater_than', value: 5 }]))).toBe(
      'expense',
    );
  });
});
