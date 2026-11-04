import { describe, expect, it } from 'vitest';
import {
  canSitBeside,
  DEFAULT_OVERVIEW_ROWS,
  hideSection,
  isDefaultLayout,
  KPI_SECTION_IDS,
  moveSection,
  normalizeRows,
  type OverviewRows,
  rowSpans,
  showSection,
} from './overview-layout';

const ROWS: OverviewRows = [['a'], ['b', 'c'], ['d']];

describe('moveSection', () => {
  it('puts a section on its own row above the target', () => {
    expect(moveSection(ROWS, 'd', 'a', 'above')).toEqual([['d'], ['a'], ['b', 'c']]);
  });

  it('puts a section on its own row below a pair, leaving its partner full width', () => {
    expect(moveSection(ROWS, 'b', 'd', 'below')).toEqual([['a'], ['c'], ['d'], ['b']]);
  });

  it('pairs a section with a lone one on the side it was dropped', () => {
    expect(moveSection(ROWS, 'd', 'a', 'left')).toEqual([['d', 'a'], ['b', 'c']]);
    expect(moveSection(ROWS, 'd', 'a', 'right')).toEqual([['a', 'd'], ['b', 'c']]);
  });

  it('swaps the two halves of a pair', () => {
    expect(moveSection(ROWS, 'c', 'b', 'left')).toEqual([['a'], ['c', 'b'], ['d']]);
  });

  it('leaves the layout alone when dropped on itself', () => {
    expect(moveSection(ROWS, 'b', 'b', 'above')).toBe(ROWS);
  });

  it('refuses a third section beside a pair', () => {
    expect(moveSection(ROWS, 'a', 'b', 'right')).toBe(ROWS);
  });

  it('puts a tile right next to the one it was dropped beside', () => {
    const tiles: OverviewRows = [['kpi-income', 'kpi-net'], ['safe-to-spend']];
    expect(moveSection(tiles, 'safe-to-spend', 'kpi-income', 'right')).toEqual([
      ['kpi-income', 'safe-to-spend', 'kpi-net'],
    ]);
  });

  it('lets a tile join a card, and two tiles, but not a third', () => {
    const rows: OverviewRows = [['goals'], ['kpi-income'], ['safe-to-spend'], ['kpi-net']];
    const one = moveSection(rows, 'kpi-income', 'goals', 'right');
    const two = moveSection(one, 'safe-to-spend', 'kpi-income', 'right');
    expect(two).toEqual([['goals', 'kpi-income', 'safe-to-spend'], ['kpi-net']]);
    expect(moveSection(two, 'kpi-net', 'safe-to-spend', 'right')).toBe(two);
  });

  it('lets the lead tile join a card as another card would, but not a card and a tile', () => {
    const rows: OverviewRows = [['goals'], ['kpi-spent'], ['kpi-net']];
    const paired = moveSection(rows, 'kpi-spent', 'goals', 'right');
    expect(paired).toEqual([['goals', 'kpi-spent'], ['kpi-net']]);

    const withTile: OverviewRows = [['goals', 'kpi-net'], ['kpi-spent']];
    expect(moveSection(withTile, 'kpi-spent', 'goals', 'right')).toBe(withTile);
  });

  it('gives a tile a row of its own when dropped above or below', () => {
    const rows: OverviewRows = [[...['kpi-income', 'kpi-spent']], ['goals']];
    expect(moveSection(rows, 'kpi-spent', 'goals', 'below')).toEqual([
      ['kpi-income'],
      ['goals'],
      ['kpi-spent'],
    ]);
  });
});

describe('rowSpans', () => {
  it('gives a lone card the row and two cards half each', () => {
    expect(Object.fromEntries(rowSpans(['goals']))).toEqual({ goals: 12 });
    expect(Object.fromEntries(rowSpans(['goals', 'budgets']))).toEqual({ goals: 6, budgets: 6 });
  });

  it('shares the row among tiles, and what a card leaves among tiles beside it', () => {
    expect(Object.fromEntries(rowSpans(['kpi-income', 'safe-to-spend', 'kpi-net']))).toEqual({
      'kpi-income': 4,
      'safe-to-spend': 4,
      'kpi-net': 4,
    });
    expect(Object.fromEntries(rowSpans(['goals', 'kpi-income', 'safe-to-spend']))).toEqual({
      goals: 6,
      'kpi-income': 3,
      'safe-to-spend': 3,
    });
    expect(Object.fromEntries(rowSpans(['kpi-net']))).toEqual({ 'kpi-net': 12 });
  });

  it('gives the lead tile twice the share of a tile beside it', () => {
    expect(Object.fromEntries(rowSpans(['kpi-spent', 'kpi-income', 'kpi-net']))).toEqual({
      'kpi-spent': 6,
      'kpi-income': 3,
      'kpi-net': 3,
    });
    expect(Object.fromEntries(rowSpans(['kpi-spent', 'kpi-income']))).toEqual({
      'kpi-spent': 8,
      'kpi-income': 4,
    });
    expect(Object.fromEntries(rowSpans(['goals', 'kpi-spent']))).toEqual({
      goals: 6,
      'kpi-spent': 6,
    });
    expect(Object.fromEntries(rowSpans(['kpi-spent']))).toEqual({ 'kpi-spent': 12 });
  });
});

describe('canSitBeside', () => {
  it('allows a lone target or the partner of the same pair, not a full pair', () => {
    expect(canSitBeside(ROWS, 'd', 'a')).toBe(true);
    expect(canSitBeside(ROWS, 'c', 'b')).toBe(true);
    expect(canSitBeside(ROWS, 'a', 'b')).toBe(false);
  });

  it('counts tiles as a quarter of the row, cards and the lead tile as half', () => {
    const pair: OverviewRows = [['kpi-income', 'kpi-net'], ['safe-to-spend'], ['kpi-spent']];
    expect(canSitBeside(pair, 'safe-to-spend', 'kpi-income')).toBe(true);
    expect(canSitBeside(pair, 'kpi-spent', 'kpi-income')).toBe(true);

    const three: OverviewRows = [['kpi-income', 'kpi-net', 'safe-to-spend'], ['goals'], ['kpi-spent']];
    expect(canSitBeside(three, 'kpi-spent', 'kpi-income')).toBe(false);
    expect(canSitBeside(three, 'goals', 'kpi-income')).toBe(false);
  });
});

describe('normalizeRows', () => {
  it('falls back to the default when nothing was saved', () => {
    expect(normalizeRows(null)).toEqual(DEFAULT_OVERVIEW_ROWS);
    expect(normalizeRows({ rows: 'nonsense' })).toEqual(DEFAULT_OVERVIEW_ROWS);
  });

  it('drops sections that no longer exist and duplicates, and appends new ones', () => {
    const saved = [['net-worth', 'gone'], ['crypto', 'net-worth'], []];
    const rows = normalizeRows({ rows: saved });

    expect(rows.slice(0, 3)).toEqual([['getting-started'], ['net-worth'], ['crypto']]);
    expect(rows.flat().sort()).toEqual([...DEFAULT_OVERVIEW_ROWS.flat(), 'crypto'].sort());
  });

  it('opens an older saved layout with the setup checklist, and leaves a placed one alone', () => {
    expect(normalizeRows({ rows: [['activity'], ['crypto']] }).slice(0, 2)).toEqual([
      ['getting-started'],
      ['activity'],
    ]);
    expect(
      normalizeRows({ rows: [['crypto'], ['getting-started']] }).slice(0, 2),
    ).toEqual([['crypto'], ['getting-started']]);
  });

  it('never keeps more in a row than fits', () => {
    const rows = normalizeRows({ rows: [['goals', 'crypto', 'net-worth']] });

    expect(rows[1]).toEqual(['goals', 'crypto']);
    expect(rows.flat()).toContain('net-worth');
  });

  it('turns the old single KPI row into the tiles in its place', () => {
    const rows = normalizeRows({ rows: [['getting-started'], ['goals'], ['kpis', 'crypto']] });

    expect(rows.slice(0, 4)).toEqual([
      ['getting-started'],
      ['goals'],
      ['kpi-spent', 'kpi-income', 'kpi-net'],
      ['crypto'],
    ]);
    expect(rows.flat().sort()).toEqual([...DEFAULT_OVERVIEW_ROWS.flat(), 'crypto'].sort());
  });

  it('keeps a saved row of four KPI tiles whole once the savings rate joined the net tile', () => {
    const rows = normalizeRows({
      rows: [['kpi-income', 'kpi-spent', 'kpi-net', 'kpi-savings'], ['goals']],
    });

    expect(rows.slice(0, 3)).toEqual([
      ['getting-started'],
      ['kpi-income', 'kpi-spent', 'kpi-net'],
      ['goals'],
    ]);
  });
});

describe('hidden and optional sections', () => {
  it('keeps the widgets that are off by default out until they are switched on', () => {
    const rows = normalizeRows({ rows: [['goals']] }).flat();

    expect(rows).not.toContain('taxes');
    expect(rows).not.toContain('money-owed');
    expect(rows).not.toContain('crypto');
    expect(rows).toContain('safe-to-spend');
    expect(normalizeRows({ rows: [['goals'], ['taxes']] }).flat()).toContain('taxes');
  });

  it('does not bring back a section that was hidden', () => {
    const hidden = hideSection(DEFAULT_OVERVIEW_ROWS, [], 'net-worth');
    const rows = normalizeRows({ rows: hidden.overviewRows, hidden: hidden.hiddenSections });

    expect(hidden.hiddenSections).toEqual(['net-worth']);
    expect(rows.flat()).not.toContain('net-worth');
    expect(rows.flat()).toContain('goals');
  });

  it('closes the gap a hidden section leaves and puts a shown one on a row at the bottom', () => {
    const rows: OverviewRows = [['goals'], ['net-worth'], ['budgets', 'cash-runway']];
    expect(hideSection(rows, [], 'net-worth').overviewRows).toEqual([
      ['goals'],
      ['budgets', 'cash-runway'],
    ]);
    expect(showSection(rows, ['taxes'], 'taxes')).toEqual({
      overviewRows: [...rows, ['taxes']],
      hiddenSections: [],
    });
  });

  it('hides a section that is both saved in a row and marked hidden', () => {
    expect(normalizeRows({ rows: [['goals', 'crypto']], hidden: ['crypto'] })[1]).toEqual([
      'goals',
    ]);
  });
});

describe('the shipped layout', () => {
  // Saved in the Administrator workspace on 2026-11-02, nothing hidden.
  const administrator = [
    ['getting-started'],
    ['kpi-income', 'kpi-spent', 'kpi-net', 'kpi-savings'],
    ['cash-flow'],
    ['top-categories', 'recent-transactions'],
    ['balances', 'safe-to-spend'],
    ['goals', 'cash-runway'],
    ['budgets', 'month-close'],
    ['net-worth'],
    ['activity'],
    ['advice'],
  ];

  // The Administrator layout of 2026-10-21, from before two sections were folded into others.
  const older = {
    rows: [
      ['getting-started', 'budgets'],
      ['kpi-income', 'kpi-spent', 'kpi-net', 'kpi-savings'],
      ['cash-flow', 'goals'],
      ['top-categories', 'recent-transactions'],
      ['safe-to-spend', 'cash-runway'],
      ['spend-calendar'],
      ['net-worth', 'upcoming-charges'],
      ['activity'],
      ['advice', 'month-close'],
    ],
    hidden: [],
  };

  it('is the Administrator layout, its KPI row led by what is left to spend', () => {
    // The savings rate went into the net tile.
    expect(DEFAULT_OVERVIEW_ROWS).toEqual(
      administrator.map(row => (row.includes('kpi-spent') ? [...KPI_SECTION_IDS] : row)),
    );
    expect(DEFAULT_OVERVIEW_ROWS.flat()).not.toContain('money-owed');
    expect(DEFAULT_OVERVIEW_ROWS.flat()).not.toContain('taxes');
  });

  it('keeps the saved layout as it was, adding a section shipped after it at the end', () => {
    // Less the spending calendar, which is now a view of the cash flow card,
    // upcoming charges, which went into the subscriptions card, and the savings
    // rate, which went into the net tile.
    expect(normalizeRows(older)).toEqual([
      ...older.rows
        .filter(row => !row.includes('spend-calendar'))
        .map(row => row.filter(id => id !== 'upcoming-charges' && id !== 'kpi-savings')),
      ['balances'],
    ]);
  });
});
