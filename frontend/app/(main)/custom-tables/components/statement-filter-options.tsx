import { getBankDisplayName } from '@/app/(main)/statements/components/statement-state';
import { DocumentTypeIcon } from '@/app/components/DocumentTypeIcon';
import type { StatementListItem } from '@/app/lib/contracts/statements/statement-list';
import { getStatementDisplayMerchant } from '@/app/lib/statement-status';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { FilterDrawerOption } from './FilterDrawerField';

const DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;

/**
 * Statements as the Documents list names them: the bank (or the name a taught
 * statement prints), its period under it and its first page beside it, rather
 * than the uploaded file's name.
 */
export function statementFilterOptions(
  statements: readonly StatementListItem[],
  locale: string,
): FilterDrawerOption[] {
  return statements.map(statement => ({
    value: statement.id,
    label: getStatementDisplayMerchant(statement, getBankDisplayName(statement.bankName)),
    description:
      [statement.statementDateFrom, statement.statementDateTo]
        .filter((date): date is string => Boolean(date))
        .map(date => formatStoredDateWithOptions(date, DAY, locale))
        .join(' – ') || undefined,
    leading: (
      <DocumentTypeIcon
        fileType={statement.fileType}
        fileName={statement.fileName}
        fileId={statement.id}
        source="statement"
        size={28}
        muted
      />
    ),
  }));
}
