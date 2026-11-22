import { describe, expect, it } from 'vitest';
import type { CategorizationRule, RuleGroup } from '@/app/lib/contracts';
import { sectionsOf, withPartReordered } from './rule-folders';

const folder = (id: string, name: string): RuleGroup => ({
  id,
  name,
  position: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
});
const rule = (id: string, groupId: string | null = null) =>
  ({ id, name: id, groupId }) as unknown as CategorizationRule;

const SHOPS = folder('folder-shops', 'Shops');
const BILLS = folder('folder-bills', 'Bills');

describe('sectionsOf', () => {
  it('puts the rules in no folder first, then each folder, every part in list order', () => {
    const rules = [rule('a', SHOPS.id), rule('b'), rule('c', SHOPS.id), rule('d', 'gone-folder')];

    const sections = sectionsOf(rules, [SHOPS, BILLS]);

    expect(sections.map(section => [section.folder?.id ?? null, section.rules.map(r => r.id)])).toEqual([
      [null, ['b', 'd']],
      ['folder-shops', ['a', 'c']],
      ['folder-bills', []],
    ]);
  });
});

describe('withPartReordered', () => {
  it('reorders a folder’s rules among the places they held, leaving every other rule in place', () => {
    const all = [rule('a', SHOPS.id), rule('b'), rule('c', SHOPS.id), rule('d')];

    const next = withPartReordered(all, [all[2], all[0]]);

    expect(next.map(r => r.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});
