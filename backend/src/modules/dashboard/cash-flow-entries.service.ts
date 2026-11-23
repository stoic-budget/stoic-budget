import { forwardRef, Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { canReadPrivate, PRIVATE_PLACEHOLDER } from '../../common/utils/transaction-privacy.util';
import type { DashboardCashFlowEntriesResponse, DashboardCashFlowEntry } from '../../contracts';
import { Payable } from '../../entities/payable.entity';
import { Receipt } from '../../entities/receipt.entity';
import type { Statement } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { BudgetWithinLimitService } from '../budgets/budget-within-limit.service';
import { PayPeriodService } from '../pay-period/pay-period.service';
import { recentRowHrefs } from './bill-hrefs';
import { DashboardService, round2 } from './dashboard.service';
import { parseMonthWindow } from './dashboard-window.util';

/** The rows behind the dashboard cash flow card's day tooltip. */
@Injectable()
export class CashFlowEntriesService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,
    @InjectRepository(Payable)
    private readonly payableRepo: Repository<Payable>,
    private readonly dashboard: DashboardService,
    @Inject(forwardRef(() => BudgetWithinLimitService))
    private readonly withinLimit: BudgetWithinLimitService,
    @Optional() private readonly payPeriods?: PayPeriodService,
  ) {}

  /**
   * The rows behind one month's daily cash flow, named, for the card's day tooltip. Same filters
   * and sides as `sumCashFlowByBucket`, so the names add up to the bar they sit on.
   */
  async getCashFlowEntries(
    workspaceId: string,
    month: string,
    viewerMemberId: string | null,
  ): Promise<DashboardCashFlowEntriesResponse> {
    // The month the dashboard shows: the workspace's own when it starts on another day.
    const window = parseMonthWindow(month, await this.payPeriods?.contextFor(workspaceId));
    if (!window) {
      return { entries: [] };
    }
    const currency = await this.dashboard.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');
    this.dashboard.applyActiveStatementTransactionFilters(
      query,
      workspaceId,
      window.since,
      window.endDate,
    );

    const [rows, withinLimit] = await Promise.all([
      query
        .select('t.id', 'id')
        .addSelect("TO_CHAR(t.transactionDate, 'YYYY-MM-DD')", 'date')
        .addSelect('t.counterpartyName', 'counterpartyName')
        .addSelect('s.fileName', 'fileName')
        .addSelect('t.transactionType', 'transactionType')
        .addSelect('t.debit', 'debit')
        .addSelect('t.credit', 'credit')
        .addSelect('t.currency', 'currency')
        .addSelect('t.isPrivate', 'isPrivate')
        .addSelect('t.ownerMemberId', 'ownerMemberId')
        .addSelect('s.id', 'statementId')
        .addSelect('s.status', 'statementStatus')
        // Only what tells a scan apart: a month has hundreds of rows, each would carry the whole parse.
        .addSelect(
          "jsonb_build_object('detectedBy', s.parsing_details->'detectedBy', 'importPreview', jsonb_build_object('source', s.parsing_details->'importPreview'->'source'))",
          'parsingDetails',
        )
        .andWhere('t.transactionType IN (:...sides)', {
          sides: [TransactionType.INCOME, TransactionType.EXPENSE],
        })
        .getRawMany<{
          id: string;
          date: string;
          counterpartyName: string | null;
          fileName: string | null;
          transactionType: TransactionType;
          debit: string | null;
          credit: string | null;
          currency: string;
          isPrivate: boolean;
          ownerMemberId: string | null;
          statementId: string | null;
          statementStatus: Statement['status'];
          parsingDetails: Statement['parsingDetails'];
        }>(),
      this.withinLimit.withinLimitSpending(workspaceId, window.since, window.endDate),
    ]);
    const budgetedById = new Map(withinLimit.map(row => [row.transactionId, row]));
    const hrefOf = await recentRowHrefs(this.receiptRepo, this.payableRepo, workspaceId, rows);
    // Each row at its own day's rate, as the bar it sits on.
    const days = [...rows, ...withinLimit].map(row => ({ currency: row.currency, day: row.date }));
    const convert = await this.dashboard.dayConverter(currency, days, workspaceId);

    const entries: DashboardCashFlowEntry[] = [];
    for (const [index, row] of rows.entries()) {
      const kind = row.transactionType === TransactionType.INCOME ? 'income' : 'expense';
      const amount = round2(
        convert(kind === 'income' ? row.credit : row.debit, row.currency, row.date),
      );
      if (amount <= 0) {
        continue;
      }
      const name = this.cashFlowEntryName(row, viewerMemberId);
      const within = kind === 'expense' ? budgetedById.get(row.id) : undefined;
      // The within-limit part, in the workspace currency and never above the expense.
      const budgeted = within
        ? Math.min(amount, round2(convert(within.amount, within.currency, row.date)))
        : 0;
      // Someone else's private row keeps its document to itself, as it keeps its name.
      const href = canReadPrivate(row, viewerMemberId) ? hrefOf(index) : null;
      entries.push({ date: row.date, name, kind, amount, budgeted, href });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    return { entries };
  }

  /** Who a day-tooltip row is for: the counterparty, else the file, hidden when it is private. */
  private cashFlowEntryName(
    row: {
      counterpartyName: string | null;
      fileName: string | null;
      isPrivate: boolean;
      ownerMemberId: string | null;
    },
    viewerMemberId: string | null,
  ): string {
    if (!canReadPrivate(row, viewerMemberId)) {
      return PRIVATE_PLACEHOLDER;
    }
    return row.counterpartyName?.trim() || row.fileName?.trim() || PRIVATE_PLACEHOLDER;
  }
}
