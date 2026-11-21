import { describe, expect, it } from 'vitest';
import { foldSmallest, MAX_SIDE_NODES, monthRange, withoutSubcategories } from '../cash-flow-flow';

describe('monthRange', () => {
  it('spans the whole month, leap February included', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('withoutSubcategories', () => {
  it('keeps sources, total and categories with the value flowing into them', () => {
    const sankey = {
      nodes: [
        { id: 'src:ACME', name: 'ACME Payroll', kind: 'source' as const },
        { id: 'total', name: 'Total', kind: 'total' as const },
        { id: 'cat:food', name: 'Food', kind: 'category' as const },
        { id: 'sub:grocery', name: 'Groceries', kind: 'subcategory' as const },
      ],
      links: [
        { source: 'src:ACME', target: 'total', value: 1000 },
        { source: 'total', target: 'cat:food', value: 300 },
        { source: 'cat:food', target: 'sub:grocery', value: 300 },
      ],
    };

    const shallow = withoutSubcategories(sankey);

    expect(shallow.nodes.map(node => node.id)).toEqual(['src:ACME', 'total', 'cat:food']);
    expect(shallow.links).toEqual(sankey.links.slice(0, 2));
  });
});

describe('foldSmallest', () => {
  const other = 'Other';
  const source = (n: number) => ({ id: `source:Payer ${n}`, name: `Payer ${n}`, kind: 'source' as const });
  const category = (n: number) => ({ id: `cat:${n}`, name: `Category ${n}`, kind: 'category' as const });
  const total = { id: 'total', name: 'Total', kind: 'total' as const };
  const saved = { id: 'saved', name: 'Left over', kind: 'saved' as const };

  it('folds the smallest categories into one Other node with their sum, keeping left over', () => {
    const spent = [50, 40, 30, 20, 10, 5];
    const categories = spent.map((_, n) => category(n));
    const sankey = {
      nodes: [source(0), total, ...categories, saved],
      links: [
        { source: source(0).id, target: 'total', value: 1000 },
        ...spent.map((value, n) => ({ source: 'total', target: category(n).id, value })),
        { source: 'total', target: 'saved', value: 845 },
      ],
    };

    const short = foldSmallest(sankey, other);
    const right = short.links.filter(link => link.source === 'total');

    expect(right).toHaveLength(MAX_SIDE_NODES);
    // Left over keeps its node, so three categories stay and the other three fold.
    expect(right.map(link => link.target)).toEqual(['cat:0', 'cat:1', 'cat:2', 'saved', 'cat:__other__']);
    expect(right.at(-1)?.value).toBe(20 + 10 + 5);
    expect(short.nodes.find(node => node.id === 'cat:__other__')?.name).toBe(other);
    const sum = (links: typeof right) => links.reduce((s, link) => s + link.value, 0);
    expect(sum(right)).toBe(sum(sankey.links.filter(link => link.source === 'total')));
  });

  it('folds the smallest sources the same way and leaves a short side alone', () => {
    const paid = [500, 400, 300, 200, 100, 50];
    const sankey = {
      nodes: [...paid.map((_, n) => source(n)), total, category(0)],
      links: [
        ...paid.map((value, n) => ({ source: source(n).id, target: 'total', value })),
        { source: 'total', target: category(0).id, value: 1550 },
      ],
    };

    const short = foldSmallest(sankey, other);
    const left = short.links.filter(link => link.target === 'total');

    expect(left).toHaveLength(MAX_SIDE_NODES);
    // No balance on this side: four payers stay and the two smallest fold.
    expect(left.at(-1)).toEqual({ source: 'source:__other__', target: 'total', value: 100 + 50 });
    expect(short.links.filter(link => link.source === 'total')).toEqual([
      { source: 'total', target: 'cat:0', value: 1550 },
    ]);
  });
});
