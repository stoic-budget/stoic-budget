'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import type { Transaction } from '../editHelpers';
import { groupByPayee, needsCategory, unnamedRows } from '../helpers/payee-groups';
import { useRowFixes } from '../hooks/useRowFixes';
import { EditTransactionsTable, type EditTransactionsTableProps } from './EditTransactionsTable';
import { PayeeGroupsTable } from './PayeeGroupsTable';
import { RowEditDialog, type RowEditLabels } from './RowEditDialog';
import { SuggestionsHint, useSuggestionsHint } from './SuggestionsHint';

type View = 'rows' | 'payees';

type StatementRowsSectionProps = EditTransactionsTableProps & {
  /** Opens the category drawer for these rows. */
  onPickRows: (rows: Transaction[]) => void;
  /**
   * Given while the statement's rows do not add up: rows may then be edited,
   * added and deleted by hand, and this reloads the page after each change.
   */
  fixRows?: () => Promise<void>;
};

function text(labels: EditTransactionsTableProps['labels'], key: string, fallback: string): string {
  return labels[key]?.value ?? fallback;
}

function rowEditLabels(
  labels: EditTransactionsTableProps['labels'],
  columns: EditTransactionsTableProps['columns'],
): RowEditLabels {
  const column = (key: string, fallback: string) => columns[key]?.value ?? fallback;
  return {
    editRow: text(labels, 'editRow', 'Edit row'),
    addRow: text(labels, 'addRow', 'Add a missing row'),
    date: column('date', 'Date'),
    counterparty: column('counterparty', 'Counterparty'),
    paymentPurpose: column('paymentPurposeShort', 'Payment purpose'),
    amount: column('amount', 'Amount'),
    moneyOut: text(labels, 'moneyOut', 'Money out'),
    moneyIn: text(labels, 'moneyIn', 'Money in'),
    save: text(labels, 'saveRow', 'Save'),
    cancel: text(labels, 'cancel', 'Cancel'),
  };
}

/**
 * The statement's rows, or the same rows by payee. While something waits for a
 * category the page opens on payees: a pick there files all of a payee's rows.
 * Once the person picks a view it stays.
 */
export function StatementRowsSection({
  onPickRows,
  fixRows,
  ...tableProps
}: StatementRowsSectionProps): React.ReactElement {
  const { transactions, labels, columns, locale, formatNumber } = tableProps;
  const fixes = useRowFixes(
    useParams<{ id: string }>().id,
    fixRows ?? (async () => undefined),
    text(labels, 'rowSaveFailed', 'Could not save the row'),
  );
  // The row open in the editor: a row, `null` for a new one, `undefined` for none.
  const [editing, setEditing] = useState<Transaction | null | undefined>(undefined);
  const [picked, setPicked] = useState<View | null>(null);
  const groups = groupByPayee(transactions);
  const toFile = groups.filter(group => group.unfiled > 0).length;
  const view: View = picked ?? (toFile > 0 ? 'payees' : 'rows');
  const payeesLabel = text(labels, 'viewByPayee', 'By payee');
  const unfiled = transactions.filter(needsCategory);
  const unnamed = unnamedRows(transactions);
  const hint = useSuggestionsHint();
  const unfiledTotal = unfiled.reduce(
    (sum, row) => sum + (Number(row.credit) || 0) - (Number(row.debit) || 0),
    0,
  );

  return (
    <Box>
      {hint.open ? (
        <SuggestionsHint
          onClose={hint.close}
          labels={{
            title: text(labels, 'hintTitle', 'You will not fill this in every time'),
            suggested: text(
              labels,
              'hintSuggested',
              'Dashed categories are suggestions. Check them and accept them all at once.',
            ),
            learns: text(
              labels,
              'hintLearns',
              'Every choice you make is remembered: the next statements arrive mostly filed.',
            ),
            gaps: text(
              labels,
              'hintGaps',
              'A row with no suggestion is normal: the bank did not say who was paid. Only you know what the money was for, and you need not file everything.',
            ),
            gotIt: text(labels, 'hintGotIt', 'Got it'),
          }}
        />
      ) : null}
      <Box
        sx={{
          mb: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <TextTabs
          value={view}
          onChange={setPicked}
          ariaLabel={text(labels, 'viewSwitch', 'Show rows')}
          options={[
            { value: 'rows', label: text(labels, 'viewRows', 'Rows') },
            {
              value: 'payees',
              label: toFile > 0 ? `${payeesLabel} · ${toFile}` : payeesLabel,
            },
          ]}
        />
        {hint.open ? null : (
          <Button
            size="small"
            variant="text"
            onClick={hint.show}
            sx={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-muted)' }}
          >
            {text(labels, 'hintShow', 'How categories get filled')}
          </Button>
        )}
      </Box>
      {fixRows ? (
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {text(labels, 'rowFixHint', 'The rows do not add up to the statement’s balances.')}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => setEditing(null)}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {text(labels, 'addRow', 'Add a missing row')}
          </Button>
        </Box>
      ) : null}
      {editing !== undefined ? (
        <RowEditDialog
          row={editing}
          labels={rowEditLabels(labels, columns)}
          onClose={() => setEditing(undefined)}
          onSave={values => fixes.saveRow(editing, values)}
        />
      ) : null}
      {view === 'payees' ? (
        <PayeeGroupsTable
          groups={groups}
          locale={locale}
          formatNumber={formatNumber}
          labels={{
            payee: text(labels, 'payeeColumn', 'Payee'),
            rows: text(labels, 'rowsColumn', 'Rows'),
            amount: columns.amount?.value ?? 'Amount',
            category: columns.category?.value ?? 'Category',
            mixed: text(labels, 'mixedCategories', 'Mixed'),
            suggested: text(labels, 'suggestedCategory', 'Suggested'),
            noCategory: text(labels, 'noCategoryOption', 'No category'),
            assignCategory: text(labels, 'assignCategory', 'Assign category'),
          }}
          onPick={group => {
            setPicked('payees');
            onPickRows(group.rows);
          }}
        />
      ) : (
        <EditTransactionsTable
          {...tableProps}
          onEdit={fixRows ? setEditing : undefined}
          onDelete={
            fixRows
              ? async id => {
                  await tableProps.onDelete(id);
                  await fixes.afterDelete();
                }
              : tableProps.onDelete
          }
        />
      )}
      {/* Rows the bank printed no payee for are different shops: filed one by one. */}
      {view === 'payees' && unnamed.length > 0 ? (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {text(
              labels,
              'unnamedRows',
              '{count} rows name no payee: the bank printed only the kind of operation',
            ).replace('{count}', String(unnamed.length))}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => setPicked('rows')}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {text(labels, 'fileUnnamedInRows', 'File them in Rows')}
          </Button>
        </Box>
      ) : null}
      {/* The tail: what is left after the big payees, filed with one pick. */}
      {view === 'payees' && unfiled.length > 1 ? (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {text(labels, 'restToFile', '{count} rows still without a category').replace(
              '{count}',
              String(unfiled.length),
            )}
            {' · '}
            <span className={PRIVATE_CLASS}>
              {unfiledTotal < 0
                ? `−${formatNumber(-unfiledTotal)}`
                : `+${formatNumber(unfiledTotal)}`}
            </span>
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              setPicked('payees');
              onPickRows(unfiled);
            }}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {text(labels, 'fileRestAtOnce', 'File them all at once')}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
