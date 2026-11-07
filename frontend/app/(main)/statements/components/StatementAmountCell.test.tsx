import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatementAmountCell } from './StatementAmountCell';
import type { StatementListItem } from './StatementsListItem';

const statement = (over: Partial<StatementListItem> = {}): StatementListItem => ({
  id: 'statement-1',
  fileName: 'statement.pdf',
  status: 'completed',
  createdAt: '2026-10-01T00:00:00.000Z',
  bankName: 'other',
  fileType: 'pdf',
  ...over,
});

const cell = (item: StatementListItem, onTeach = vi.fn(), reviewFlagged = false) =>
  render(
    <StatementAmountCell
      statement={item}
      amountLabel="-12.50 USD"
      isReceipt={false}
      isProcessing={false}
      reviewFlagged={reviewFlagged}
      onTeach={onTeach}
    />,
  );

describe('StatementAmountCell', () => {
  it('shows the amount of a statement the parser read', () => {
    cell(statement());
    expect(screen.getByText('-12.50')).toBeTruthy();
    expect(screen.queryByTestId('statement-teach')).toBeNull();
  });

  it('shows no amount but Teach for a statement the parser could not read', () => {
    const onTeach = vi.fn();
    cell(
      statement({
        status: 'needs_review',
        parsingDetails: { validation: { passed: false, warnings: [], reasonCodes: ['balance_chain'] } },
      }),
      onTeach,
    );
    expect(screen.queryByText('-12.50')).toBeNull();
    fireEvent.click(screen.getByTestId('statement-teach'));
    expect(onTeach).toHaveBeenCalled();
  });

  it('shows no badge while the statement is read', () => {
    const { container } = cell(statement({ status: 'processing' }));
    expect(container.querySelector('.seneca-stmt-badge')).toBeNull();
  });

  it('badges an unreconciled statement only when the row does not already say To review', () => {
    const unreconciled = statement({ status: 'needs_review' });
    const { container, unmount } = cell(unreconciled);
    expect(container.querySelector('.seneca-stmt-badge--review')).toBeTruthy();
    unmount();

    const flagged = cell(unreconciled, vi.fn(), true);
    expect(flagged.container.querySelector('.seneca-stmt-badge--review')).toBeNull();
  });
});
