import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { toMinor } from '../../common/utils/money.util';
import {
  applyOwnerFilter,
  assertOwnerMemberInWorkspace,
} from '../../common/utils/transaction-owner.util';
import { redactPrivate, redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { assertWorkspaceOwned, assertWorkspaceRefs } from '../../common/utils/workspace-refs.util';
import type {
  BulkUpdateItemInput,
  SplitPartInput,
  SplitTransactionBody,
  UpdateTransactionBody,
} from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Branch } from '../../entities/branch.entity';
import { Category, CategoryType } from '../../entities/category.entity';
import { Statement } from '../../entities/statement.entity';
import { TaxSource, Transaction, TransactionType } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { ensurePrivateCategory } from '../categories/private-category';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { partyOf } from '../tax/assignment-party';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import { markChoicesByHand } from './helpers/choices-by-hand';
import { assertEditAllowed } from './helpers/pair-guards';
import {
  assertFilesKeepTheirReaders,
  NOTHING_REPOINTED,
  repointSplitParts,
} from './helpers/repoint-split-parts';
import { gatherSplitFingerprint } from './helpers/split-fingerprint';
import { lockSplitGroup } from './helpers/split-group-lock';
import { assertMayReshape, assertSplittable, memberIdOf } from './helpers/split-guards';
import { assertTaxEditable } from './helpers/tax-edit-guard';
import { applyPartCategory, cloneForSplit } from './helpers/transaction-split-clone';
import { applyListFilters, type TransactionListFilters } from './transaction-list-filters';
import { assertUnsplittable } from './unsplit-guards';

export type TransactionWithConversion = Transaction & {
  convertedAmount?: number;
  conversionRate?: number;
  convertedCurrency?: string;
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    statementRepository: Repository<Statement>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly taxAssignmentService: TaxAssignmentService,
  ) {}

  /** Bumps the version the cached reports are keyed by; they are keyed by workspace. */
  private async invalidateReports(workspaceId: string): Promise<void> {
    const key = `reports:version:${workspaceId}`;
    await this.cacheManager.set(key, Date.now().toString(), 0);
  }

  /** Checked in the workspace being edited, not the one the user registered with. */
  private async ensureCanEditStatements(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
  }

  async findAll(
    workspaceId: string,
    filters: TransactionListFilters,
    viewerMemberId: string | null = null,
  ): Promise<{ data: TransactionWithConversion[]; total: number; page: number; limit: number }> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .leftJoinAndSelect('transaction.statement', 'statement')
      .andWhere('(transaction.statementId IS NULL OR statement.deletedAt IS NULL)')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .leftJoinAndSelect('transaction.payee', 'payee')
      .leftJoinAndSelect('transaction.reimbursementOf', 'reimbursementOf');

    applyOwnerFilter(query, 'transaction', filters.owner ?? { kind: 'all' });

    applyListFilters(query, filters, viewerMemberId);

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Same-day rows keep one order across pages, the one the running balance follows.
    query
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .skip(skip)
      .take(limit);

    const [rows, total] = await query.getManyAndCount();
    const rawData = redactPrivateRows(rows, viewerMemberId);

    if (!filters.convertTo) {
      return { data: rawData, total, page, limit };
    }

    const targetCurrency = filters.convertTo.toUpperCase();
    const items = rawData.map(tx => ({
      amount: Number(tx.amount) || Number(tx.debit) || Number(tx.credit) || 0,
      currency: currencyCodeOrDefault(tx.currency),
      date: tx.transactionDate,
    }));
    const conversions = await this.exchangeRatesService.bulkConvert(
      items,
      targetCurrency,
      workspaceId,
    );

    const data: TransactionWithConversion[] = rawData.map((tx, i) => {
      const conv = conversions[i];
      return Object.assign(Object.create(Object.getPrototypeOf(tx)), tx, {
        convertedAmount: conv.converted,
        conversionRate: conv.rate,
        convertedCurrency: targetCurrency,
      });
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, workspaceId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, workspaceId },
      relations: {
        category: true,
        branch: true,
        wallet: true,
        payee: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
    }

    return transaction;
  }

  /** `findOne` as the caller is allowed to read it. */
  async findOneFor(
    id: string,
    workspaceId: string,
    viewerMemberId: string | null,
  ): Promise<Transaction> {
    return redactPrivate(await this.findOne(id, workspaceId), viewerMemberId);
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    updateDto: UpdateTransactionBody,
    batchId?: string | null,
    viewerMemberId: string | null = null,
  ): Promise<Transaction> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const transaction = await this.findOne(id, workspaceId);
    assertEditAllowed(transaction, updateDto);
    await this.assertWorkspaceOwnedRefs(updateDto, workspaceId);
    const movedForPrivacy = await this.applyPrivacy(transaction, updateDto, viewerMemberId);
    const before = { ...transaction };
    const previousCategoryId = transaction.categoryId;
    assertTaxEditable(transaction, updateDto);

    // Recalculate amount if debit/credit changed
    if (updateDto.debit !== undefined || updateDto.credit !== undefined) {
      const debit = updateDto.debit !== undefined ? updateDto.debit : transaction.debit;
      const credit = updateDto.credit !== undefined ? updateDto.credit : transaction.credit;
      updateDto.amount = debit || credit || 0;

      // Update transaction type
      if (debit && debit > 0) {
        updateDto.transactionType = TransactionType.EXPENSE;
      } else if (credit && credit > 0) {
        updateDto.transactionType = TransactionType.INCOME;
      }
    } else if (
      updateDto.amountForeign !== undefined &&
      updateDto.exchangeRate !== undefined &&
      updateDto.amount === undefined
    ) {
      const nativeAmount = Number(updateDto.amountForeign) * Number(updateDto.exchangeRate);
      updateDto.amount = nativeAmount;
    }

    Object.assign(transaction, updateDto);

    // `findOne` loaded the relation objects. On save TypeORM takes a loaded
    // relation over the foreign-key column, so a changed id would silently be
    // written back as the old one. Drop the stale objects; the id is the truth.
    if (updateDto.categoryId !== undefined) {
      transaction.category = undefined as unknown as Category | null;
    }
    if (updateDto.branchId !== undefined) {
      transaction.branch = undefined as unknown as Branch | null;
    }
    if (updateDto.walletId !== undefined) {
      transaction.wallet = undefined as unknown as Wallet | null;
    }
    if (updateDto.ownerMemberId !== undefined) {
      transaction.ownerMember = undefined as unknown as WorkspaceMember | null;
    }

    markChoicesByHand(transaction, updateDto, { previousCategoryId, movedForPrivacy });

    const saved = await this.transactionRepository.save(transaction);
    await this.invalidateReports(workspaceId);

    // Audit: capture transaction update with before/after snapshot.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: {
        updatedFields: Object.keys(updateDto),
      },
      batchId: batchId ?? null,
      isUndoable: true,
    });

    // A correction teaches by itself: the row's own category is what the payee
    // history reads next time, so there is nothing else to record.

    return saved;
  }

  /**
   * Moves a row in or out of the workspace's `Private` category.
   *
   * Only the owner of a row may hide it: a row the household shares has nobody
   * to keep a secret from, and a row somebody else owns is not yours to hide.
   *
   * The category really moves rather than being masked when read. A mask would
   * make every total depend on who is asking, and two such totals differ by
   * exactly the hidden amount.
   */
  private async applyPrivacy(
    transaction: Transaction,
    updateDto: UpdateTransactionBody,
    viewerMemberId: string | null,
  ): Promise<boolean> {
    if (updateDto.isPrivate === undefined || updateDto.isPrivate === transaction.isPrivate) {
      // Drop the key rather than blank it: `Object.assign` copies an
      // `undefined` value too, and the row would then look changed to the audit
      // — "changed: isPrivate" on an edit that touched nothing of the sort.
      // biome-ignore lint/performance/noDelete: an undefined assignment, which is what the rule suggests, creates the key and marks the row as changed
      delete updateDto.isPrivate;
      return false;
    }

    if (updateDto.isPrivate) {
      if (!transaction.ownerMemberId || transaction.ownerMemberId !== viewerMemberId) {
        throw new BadRequestException(appError('TRANSACTION_PRIVATE_NOT_OWNER'));
      }
      const privateCategory = await ensurePrivateCategory(
        this.categoryRepository,
        transaction.workspaceId,
        transaction.transactionType === TransactionType.INCOME
          ? CategoryType.INCOME
          : CategoryType.EXPENSE,
      );
      transaction.privateCategoryId = transaction.categoryId;
      // Through the DTO, not the entity: `findOne` loaded the `category`
      // relation, and on save a loaded relation wins over the column, so an id
      // assigned here alone would be written back as the old one. The block
      // below already drops the stale object for a DTO-driven change.
      updateDto.categoryId = privateCategory.id;
    } else {
      updateDto.categoryId = transaction.privateCategoryId ?? undefined;
      transaction.privateCategoryId = null;
    }
    return true;
  }

  async bulkUpdate(
    workspaceId: string,
    userId: string,
    items: BulkUpdateItemInput[],
    viewerMemberId: string | null = null,
  ): Promise<Transaction[]> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const updatedTransactions: Transaction[] = [];
    const batchId = items.length > 1 ? randomUUID() : null;

    for (const item of items) {
      try {
        const transaction = await this.update(
          item.id,
          workspaceId,
          userId,
          item.updates,
          batchId,
          viewerMemberId,
        );
        updatedTransactions.push(transaction);
      } catch (error) {
        console.error('Error updating transaction %s:', item.id, error);
      }
    }

    if (updatedTransactions.length > 0) {
      await this.invalidateReports(workspaceId);
    }

    return updatedTransactions;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /** Every workspace-scoped reference an update body can carry. */
  private assertWorkspaceOwnedRefs(
    updateDto: Pick<
      UpdateTransactionBody,
      'categoryId' | 'branchId' | 'walletId' | 'ownerMemberId'
    >,
    workspaceId: string,
  ): Promise<unknown> {
    return Promise.all([
      assertWorkspaceRefs(this.transactionRepository.manager, workspaceId, updateDto),
      assertOwnerMemberInWorkspace(
        this.workspaceMemberRepository,
        workspaceId,
        updateDto.ownerMemberId,
      ),
    ]);
  }

  /**
   * Divides a transaction's money across its parts.
   *
   * The requested amounts are rounded to cents and the LAST part absorbs the
   * residual, so the parts sum to `total` (and `foreignTotal`) exactly rather than
   * drifting by the cent the validation tolerance permits.
   */
  private allocateParts(
    total: number,
    foreignTotal: number | null,
    parts: SplitPartInput[],
  ): { amounts: number[]; foreignAmounts: (number | null)[] } {
    const amounts = parts.map(part => this.round2(Number(part.amount)));
    const lastIndex = amounts.length - 1;
    amounts[lastIndex] = this.round2(
      total - amounts.slice(0, lastIndex).reduce((sum, value) => sum + value, 0),
    );

    const foreignAmounts: (number | null)[] = amounts.map(amount =>
      foreignTotal === null ? null : this.round2((foreignTotal * amount) / total),
    );
    if (foreignTotal !== null) {
      foreignAmounts[lastIndex] = this.round2(
        foreignTotal -
          foreignAmounts.slice(0, lastIndex).reduce<number>((sum, value) => sum + (value ?? 0), 0),
      );
    }

    return { amounts, foreignAmounts };
  }

  /**
   * Splits one transaction into N parts in place.
   *
   * The original row becomes part 0 and N-1 siblings are inserted; the parts sum
   * to the original amount, so balance/dashboard/reports/budgets aggregates need
   * no awareness of splits at all.
   */
  async split(
    id: string,
    workspaceId: string,
    userId: string,
    dto: SplitTransactionBody,
  ): Promise<Transaction[]> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const viewerMemberId = await memberIdOf(this.workspaceMemberRepository, workspaceId, userId);
    const original = await this.findOne(id, workspaceId);
    await assertWorkspaceOwned(
      this.transactionRepository.manager,
      Category,
      dto.parts.map(part => part.categoryId),
      workspaceId,
    );
    // Fast path only: reject an obviously invalid request before opening a DB
    // transaction and taking a row lock. The authoritative check is the one below.
    assertSplittable(original, dto, viewerMemberId);

    const before = { ...original };
    const splitGroupId = randomUUID();

    const saved = await this.transactionRepository.manager.transaction(async manager => {
      const repo = manager.getRepository(Transaction);

      // Re-read under a write lock: the fast-path check ran outside this
      // transaction, so a concurrent split — or an update() changing the amount or
      // the type — may have landed since. Everything below therefore derives from
      // `locked`, never from the stale `original`.
      const locked = await repo.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
      }

      const total = assertSplittable(locked, dto, viewerMemberId);
      const isExpense = locked.transactionType === TransactionType.EXPENSE;
      const rawForeign = locked.amountForeign ?? null;
      const { amounts, foreignAmounts } = this.allocateParts(
        total,
        rawForeign === null ? null : Number(rawForeign),
        dto.parts,
      );

      const template = cloneForSplit(locked);
      const rows: Transaction[] = [];

      for (const [index, part] of dto.parts.entries()) {
        const amount = amounts[index];
        const row = index === 0 ? locked : repo.create(template as Transaction);

        row.amount = amount;
        row.debit = isExpense ? amount : null;
        row.credit = isExpense ? null : amount;
        row.amountForeign = foreignAmounts[index];
        row.splitGroupId = splitGroupId;
        row.splitIndex = index;
        // Part 0 keeps the whole row's fingerprint (the clone never copies it):
        // it names the bank's row, which a split does not change, so importing
        // that row again is known as a repeat of it (#633).

        applyPartCategory(row, part.categoryId, locked.isPrivate);
        row.paymentPurpose = part.paymentPurpose ?? row.paymentPurpose;
        row.comments = part.comments ?? row.comments;

        // Re-assessed after the category override, because a part moved to a
        // different category may fall under a different rule. A rate the user
        // picked by hand is carried through; an auto-assigned one is derived
        // again from the part's own amount and category.
        const assignment = await this.taxAssignmentService.resolve({
          workspaceId,
          transactionDate: row.transactionDate,
          amountMinor: toMinor(amount),
          categoryId: row.categoryId,
          transactionType: row.transactionType,
          transactionNature: row.transactionNature,
          explicitTaxRateId: row.taxSource === TaxSource.MANUAL ? row.taxRateId : null,
          ...partyOf(row),
        });

        row.taxRateId = assignment.taxRateId;
        row.taxRuleId = assignment.taxRuleId;
        row.taxSource = assignment.taxSource;
        row.taxAmount = assignment.taxAmount;
        row.taxNetAmount = assignment.taxNetAmount;
        row.taxReverseCharge = assignment.taxReverseCharge;
        row.taxNotionalAmount = assignment.taxNotionalAmount;

        rows.push(await repo.save(row));
      }

      return rows;
    });

    await this.invalidateReports(workspaceId);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { operation: 'split', splitGroupId, partCount: saved.length },
      isUndoable: false,
    });

    return saved;
  }

  /**
   * Returns every part of the split group the given transaction belongs to,
   * ordered as the split created them. An unsplit transaction is a group of one.
   */
  async getSplitParts(id: string, workspaceId: string): Promise<Transaction[]> {
    const transaction = await this.findOne(id, workspaceId);
    if (!transaction.splitGroupId) {
      return [transaction];
    }

    return this.transactionRepository.find({
      // Same relations as findOne, so a caller gets one shape either way.
      where: { workspaceId, splitGroupId: transaction.splitGroupId },
      relations: {
        category: true,
        branch: true,
        wallet: true,
        payee: true,
      },
      order: { splitIndex: 'ASC' },
    });
  }

  /**
   * Merges a split group back into a single row: the lowest splitIndex survives
   * carrying the group's total, the other parts are deleted. The inverse of
   * split(), and like it invisible to every aggregate, since the total is unchanged.
   *
   * The survivor keeps its own categoryId, paymentPurpose and comments — i.e.
   * part 0's, which may be a per-part override rather than what the row held
   * before it was split. Those pre-split values are not stored anywhere, so they
   * cannot be restored; that loss is accepted, not an oversight.
   */
  async unsplit(id: string, workspaceId: string, userId: string): Promise<Transaction> {
    await this.ensureCanEditStatements(userId, workspaceId);
    const viewerMemberId = await memberIdOf(this.workspaceMemberRepository, workspaceId, userId);

    // Fast path only: reject an obviously invalid request before opening a DB
    // transaction and taking row locks. The authoritative read is the locked one.
    const target = await this.findOne(id, workspaceId);
    if (!target.splitGroupId) {
      throw new BadRequestException(appError('TRANSACTION_NOT_SPLIT'));
    }
    const splitGroupId = target.splitGroupId;

    // Plain copies for the audit diff, not entities: spreading drops the
    // entity's own methods.
    let before: Array<Partial<Transaction>> = [];
    let repointed = NOTHING_REPOINTED;

    const merged = await this.transactionRepository.manager.transaction(async manager => {
      const repo = manager.getRepository(Transaction);

      // Lock the whole group in one ordered statement. A concurrent unsplit of the
      // same group, or a delete of one of its parts, queues here instead of
      // double-counting the total or deleting rows this one already folded in.
      const parts = await lockSplitGroup(repo, workspaceId, splitGroupId);

      // Empty means the group is gone — another request unsplit it while this one
      // waited for the lock. A single part is a group that lost its siblings some
      // other way; clearing its markers below is the right repair either way.
      if (parts.length === 0) {
        throw new BadRequestException(appError('TRANSACTION_NOT_SPLIT'));
      }

      // Folding the parts back deletes all but one, and a part on a filed
      // return may not disappear from under it.
      if (parts.some(part => part.taxLocked)) {
        throw new BadRequestException(appError('TRANSACTION_UNSPLIT_TAX_LOCKED'));
      }
      // Every part, not only the one asked about: another may be someone's private row.
      assertMayReshape(parts, viewerMemberId);

      before = parts.map(part => ({ ...part }));

      assertUnsplittable(parts);

      const [survivor, ...rest] = parts;
      await assertFilesKeepTheirReaders(manager, workspaceId, survivor, rest);
      // Falls back the same way assertSplittable reads an amount. Unreachable while
      // split() always writes `amount`, but the two sides should not disagree about
      // where a part's money lives.
      const total = this.round2(
        parts.reduce((sum, part) => sum + Number(part.amount ?? part.debit ?? part.credit ?? 0), 0),
      );
      // Null only when no part carries a foreign amount at all. A group whose
      // foreign amounts genuinely total 0 keeps the 0, mirroring split(), which
      // passes a present-but-zero amountForeign through as a number rather than
      // treating it as absent.
      const hasForeign = parts.some(part => (part.amountForeign ?? null) !== null);
      const foreignTotal = hasForeign
        ? this.round2(parts.reduce((sum, part) => sum + Number(part.amountForeign ?? 0), 0))
        : null;
      const isExpense = survivor.transactionType === TransactionType.EXPENSE;

      survivor.amount = total;
      survivor.debit = isExpense ? total : null;
      survivor.credit = isExpense ? null : total;
      survivor.amountForeign = foreignTotal;
      survivor.splitGroupId = null;
      survivor.splitIndex = null;
      // The survivor takes the bank row's fingerprint, kept on part 0 or handed
      // on when that part went: its total is that row's amount again.
      await gatherSplitFingerprint(repo, workspaceId, survivor, splitGroupId);

      const saved = await repo.save(survivor);

      if (rest.length > 0) {
        // Repoint FIRST: after the delete the foreign keys have already cut the links.
        const removedIds = rest.map(part => part.id);
        repointed = await repointSplitParts(manager, workspaceId, removedIds, survivor.id);
        await repo.remove(rest);
      }

      return saved;
    });

    await this.invalidateReports(workspaceId);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: merged.id,
      action: AuditAction.UPDATE,
      diff: { before, after: merged },
      meta: {
        operation: 'unsplit',
        splitGroupId,
        partCount: before.length,
        duplicatesRepointed: repointed.duplicates,
        receiptsRepointed: repointed.receipts,
        payablesRepointed: repointed.payables,
        attachmentsRepointed: repointed.attachments,
      },
      isUndoable: false,
    });

    return merged;
  }
}
