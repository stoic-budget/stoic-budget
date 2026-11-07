import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { AddStatementRowBody, StatementRecheck } from '../../contracts';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { recheckedChecks } from '../parsing/helpers/statement-recheck.helper';
import { validateParsedStatement } from '../parsing/helpers/statement-validation.helper';
import type { ParseCheck } from '../parsing/interfaces/parsed-statement.interface';
import { ensureCanModifyStatement } from './statement-access';
import { StatementsService } from './statements.service';

/** A balance within a cent of the expected one is the same balance. */
const TOLERANCE = 0.01;

const toNumber = (value: number | string | null | undefined) =>
  value === null || value === undefined ? undefined : Number(value);

/**
 * The last resort for a statement no reading gets right: its rows corrected
 * by hand (edited and deleted through the transactions, added here), and its
 * checks held against the rows as they now are, until they add up.
 */
@Injectable()
export class StatementRowsService {
  constructor(
    @InjectRepository(Statement)
    private readonly statements: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    private readonly statementsService: StatementsService,
  ) {}

  /** A row the reading missed, in the statement's account and currency; then the checks again. */
  async addRow(
    id: string,
    userId: string,
    workspaceId: string,
    body: AddStatementRowBody,
  ): Promise<StatementRecheck> {
    const statement = await this.editable(id, userId, workspaceId);
    const sibling = await this.transactions.findOne({
      where: { workspaceId, statementId: statement.id },
      select: { id: true, currency: true, walletId: true, ownerMemberId: true },
    });
    const value = Math.abs(body.amount);
    const out = body.amount < 0;
    await this.transactions.save(
      this.transactions.create({
        workspaceId,
        statementId: statement.id,
        transactionDate: new Date(body.transactionDate),
        counterpartyName: body.counterpartyName,
        paymentPurpose: body.paymentPurpose ?? '',
        debit: out ? value : null,
        credit: out ? null : value,
        amount: value,
        currency: sibling?.currency ?? statement.currency,
        transactionType: out ? TransactionType.EXPENSE : TransactionType.INCOME,
        walletId: sibling?.walletId ?? statement.walletId ?? undefined,
        ownerMemberId: sibling?.ownerMemberId ?? null,
      }),
    );
    return this.recheckStatement(statement);
  }

  async recheck(id: string, userId: string, workspaceId: string): Promise<StatementRecheck> {
    return this.recheckStatement(await this.editable(id, userId, workspaceId));
  }

  private async editable(id: string, userId: string, workspaceId: string): Promise<Statement> {
    const statement = await this.statementsService.findOne(id, workspaceId);
    await ensureCanModifyStatement(this.members, statement, userId, workspaceId);
    return statement;
  }

  /**
   * The statement's validation against its rows as they are now: the balance
   * equation and the printed totals (statement-recheck.helper). A statement
   * held for review whose rows now add up is completed; one already completed
   * stays so, since a person confirmed it or it read right.
   */
  private async recheckStatement(statement: Statement): Promise<StatementRecheck> {
    const rows = await this.transactions.find({
      where: { workspaceId: statement.workspaceId, statementId: statement.id, isDuplicate: false },
      select: { id: true, debit: true, credit: true, currency: true },
    });
    const moved = rows.map(row => ({
      debit: toNumber(row.debit),
      credit: toNumber(row.credit),
      currency: row.currency,
    }));
    const sums = {
      debits: moved.reduce((sum, row) => sum + (row.debit ?? 0), 0),
      credits: moved.reduce((sum, row) => sum + (row.credit ?? 0), 0),
    };
    const balances = {
      balanceStart: toNumber(statement.balanceStart) ?? null,
      balanceEnd: toNumber(statement.balanceEnd) ?? null,
    };
    const details = statement.parsingDetails ?? {};
    const checks = recheckedChecks(
      // Written by the parser from its own `ParseCheck`s.
      (details.checks ?? []) as ParseCheck[],
      sums,
      balances.balanceStart !== null && balances.balanceEnd !== null,
    );
    const validation = validateParsedStatement(balances, moved, { tolerance: TOLERANCE, checks });
    const status =
      validation.passed && statement.status === StatementStatus.NEEDS_REVIEW
        ? StatementStatus.COMPLETED
        : statement.status;
    await this.statements.update({ id: statement.id, workspaceId: statement.workspaceId }, {
      status,
      totalTransactions: rows.length,
      totalDebit: sums.debits,
      totalCredit: sums.credits,
      parsingDetails: { ...details, checks, validation, warnings: validation.warnings },
    } as QueryDeepPartialEntity<Statement>);
    return { status, passed: validation.passed, reasonCodes: validation.reasonCodes };
  }
}
