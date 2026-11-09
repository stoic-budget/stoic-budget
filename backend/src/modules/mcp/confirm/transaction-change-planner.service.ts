import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { Category } from '../../../entities/category.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { ensureCanEditStatements } from '../../statements/statement-access';
import type { McpToolContext } from '../mcp-tool';
import {
  type ChangePlan,
  type PlannedRow,
  planTransactionChange,
  type TransactionChange,
} from './transaction-change-rules';

/** Reads what a bulk transaction tool would change, without changing anything. */
@Injectable()
export class TransactionChangePlanner {
  constructor(
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
  ) {}

  async plan(
    ctx: McpToolContext,
    ids: readonly string[],
    change: TransactionChange,
  ): Promise<ChangePlan> {
    // Refused at the preview as the write itself would refuse it.
    await ensureCanEditStatements(this.members, ctx.user.id, ctx.workspaceId);
    const target = change.categoryId
      ? await this.categories.findOne({
          where: { id: change.categoryId, workspaceId: ctx.workspaceId },
          select: { id: true, name: true },
        })
      : null;
    if (change.categoryId && !target) {
      throw new NotFoundException(appError('WORKSPACE_REF_NOT_FOUND'));
    }
    const found = await this.transactions.find({
      where: { id: In([...new Set(ids)]), workspaceId: ctx.workspaceId },
      relations: { category: true },
    });
    const rows: PlannedRow[] = found.map(row => ({
      id: row.id,
      transactionDate: row.transactionDate,
      amount: row.amount,
      currency: row.currency,
      counterpartyName: row.counterpartyName,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      isVerified: row.isVerified,
      taxLocked: row.taxLocked,
      isPrivate: row.isPrivate,
      ownerMemberId: row.ownerMemberId,
    }));
    return planTransactionChange(ids, rows, change, { name: target?.name ?? null }, ctx.memberId);
  }
}
