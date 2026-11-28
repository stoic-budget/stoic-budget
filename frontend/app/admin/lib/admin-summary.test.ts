import { describe, expect, it } from 'vitest';
import type { ParserHealthBank, ParserHealthLayout } from '@/app/lib/contracts';
import { bankLevel, parserHealthLevel, sortBanks } from './admin-summary';

const layout = (isNew: boolean): ParserHealthLayout => ({
  fingerprint: isNew ? 'new' : 'old',
  parser: 'ExampleParser',
  headings: ['date:date | description:details'],
  unknownWords: [],
  statements: 1,
  firstSeen: '2026-10-01T00:00:00.000Z',
  lastSeen: '2026-10-02T00:00:00.000Z',
  isNew,
});

const bank = (name: string, overrides: Partial<ParserHealthBank> = {}): ParserHealthBank => ({
  bank: name,
  statements: 10,
  needsReview: 0,
  errors: 0,
  declined: 0,
  reasons: [],
  layouts: [layout(false)],
  ...overrides,
});

describe('bankLevel', () => {
  it('is fine when every statement parsed in a known layout', () => {
    expect(bankLevel(bank('fine'))).toBe('ok');
  });

  it.each([
    ['held for review', { needsReview: 1 }],
    ['declined', { declined: 1 }],
    ['in a new layout', { layouts: [layout(false), layout(true)] }],
  ])('is worth a look with statements %s', (_case, overrides) => {
    expect(bankLevel(bank('look', overrides))).toBe('warning');
  });

  it('is an error once a statement failed, whatever else', () => {
    expect(bankLevel(bank('failed', { errors: 1, needsReview: 3 }))).toBe('error');
  });
});

describe('parserHealthLevel', () => {
  it('takes the worst bank, and is fine with no banks at all', () => {
    const since = '2026-10-01T00:00:00.000Z';
    expect(parserHealthLevel({ since, banks: [] })).toBe('ok');
    expect(parserHealthLevel({ since, banks: [bank('a'), bank('b', { declined: 2 })] })).toBe(
      'warning',
    );
  });
});

describe('sortBanks', () => {
  it('puts problems first, worst first, then the busiest', () => {
    const quiet = bank('quiet', { statements: 3 });
    const busy = bank('busy', { statements: 40 });
    const held = bank('held', { statements: 1, needsReview: 1 });
    const failed = bank('failed', { statements: 2, errors: 1 });

    expect(sortBanks([quiet, busy, held, failed]).map(b => b.bank)).toEqual([
      'failed',
      'held',
      'busy',
      'quiet',
    ]);
  });
});
