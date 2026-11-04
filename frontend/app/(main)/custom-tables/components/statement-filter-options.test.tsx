import { describe, expect, it, vi } from 'vitest';
import type { StatementListItem } from '@/app/lib/contracts/statements/statement-list';
import { statementFilterOptions } from './statement-filter-options';

// The thumbnail fetches on its own and has its own tests.
vi.mock('@/app/components/DocumentTypeIcon', () => ({ DocumentTypeIcon: () => null }));

function statement(overrides: Partial<StatementListItem>): StatementListItem {
  return {
    id: 'st-1',
    fileName: 'export_2022-01-19_2022-04-19.pdf',
    fileType: 'pdf',
    bankName: 'other',
    statementDateFrom: null,
    statementDateTo: null,
    parsingDetails: null,
    ...overrides,
  } as StatementListItem;
}

describe('statementFilterOptions', () => {
  it('names a statement by what it prints and its period, not by the uploaded file', () => {
    const institution = 'ACME Savings';
    const [option] = statementFilterOptions(
      [
        statement({
          statementDateFrom: '2022-01-19',
          statementDateTo: '2022-04-19',
          parsingDetails: { metadataExtracted: { institution } } as StatementListItem['parsingDetails'],
        }),
      ],
      'en-US',
    );

    expect(option.label).toBe(institution);
    expect(option.label).not.toContain('.pdf');
    expect(option.description).toBe('Jan 19, 2022 – Apr 19, 2022');
    expect(option.leading).toBeTruthy();
  });

  it('leaves the second line out when the statement has no period', () => {
    const [option] = statementFilterOptions([statement({})], 'en-US');
    expect(option.description).toBeUndefined();
  });
});
