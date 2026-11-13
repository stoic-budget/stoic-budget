import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Exit, Schema } from 'effect';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import type { PermissionSubject } from '../../../common/authz/request-permissions';
import { appError } from '../../../common/errors/app-error';
import {
  AppImportAccountChoices,
  type AppImportForm,
  type AppImportResult,
} from '../../../contracts';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { BudgetPeriodType } from '../../../entities/budget.entity';
import { Category } from '../../../entities/category.entity';
import {
  ImportBatch,
  type ImportCreatedRef,
  type ImportUpdatedRef,
} from '../../../entities/import-batch.entity';
import type { WalletType } from '../../../entities/wallet.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { ClassificationService } from '../../classification/services/classification.service';
import { budgetOutcome, budgetsByCategory, upsertBudget } from '../helpers/budget-upsert';
import {
  announceImported,
  categorizeImported,
  invalidateCategoryCache,
} from '../helpers/import-follow-up';
import { APP_IMPORT_TARGET } from '../helpers/import-undo';
import {
  type AppWriteContext,
  createAccounts,
  createCategories,
  newPayeeIds,
  setOpenings,
  writeTransactions,
} from './app-import.writer';
import { bookableTransactions } from './app-import-adopt';
import { knownPayeeKeys, payeeKeys } from './app-import-dedupe';
import { ensureAppImportPermission } from './app-import-permission';
import { type AppImportOutcome, appImportResult, writesAnything } from './app-import-result';
import { existingWallets } from './app-import-wallets';
import type { ParsedAppFile } from './app-model';
import { type AppUpload, parseAppFile } from './app-parse';
import { knownAccountKeys, planAccounts, transferKeyOf } from './app-plan-accounts';
import { planBudgets } from './app-plan-budgets';
import { categoryUses, planCategories } from './app-plan-categories';
import { planTransactions } from './app-plan-transactions';

/**
 * Exports of another budgeting app (YNAB, Actual, Firefly III) in one go:
 * the files are recognised by their header rows, and accounts, categories with
 * their groups, payees, transactions (transfers paired, splits kept) and the
 * plan's budgets are matched against the workspace or created. The dry run and
 * the commit walk the same plan; the commit is one undoable import batch.
 */
@Injectable()
export class AppImportService {
  private readonly logger = new Logger(AppImportService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
    private readonly auditService: AuditService,
    @Optional() private readonly classificationService?: ClassificationService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache,
  ) {}

  async run(
    userId: string,
    workspaceId: string,
    uploads: AppUpload[],
    form: AppImportForm,
    apiKey?: PermissionSubject['apiKey'],
  ): Promise<AppImportResult> {
    if (uploads.length === 0) {
      throw new BadRequestException(appError('IMPORT_NO_VALID_ROWS'));
    }
    const accountTypes = new Map<string, WalletType>();
    const files = uploads.map(upload => parseAppFile(upload, accountTypes));
    const withBudgets = files.some(file => file.budgets.length > 0);
    await ensureAppImportPermission(this.members, userId, workspaceId, apiKey, withBudgets);
    const dryRun = form.dryRun === true;
    const choices = {
      currency: (form.currency ?? 'USD').toUpperCase(),
      accounts: this.accountChoices(form.accounts),
    };
    const walk = (manager: EntityManager) =>
      this.walk(manager, { workspaceId, userId, files, accountTypes, choices, dryRun });
    if (dryRun) {
      return appImportResult((await walk(this.dataSource.manager)).outcome, null, true);
    }
    const { summary, batch } = await this.dataSource.transaction(async manager => {
      // One at a time per workspace: two at once would each create the same accounts and rows.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `app-import:${workspaceId}`,
      ]);
      const { outcome, created, updated } = await walk(manager);
      const summary = appImportResult(outcome, null, false);
      const batches = manager.getRepository(ImportBatch);
      const batch = await batches.save(
        batches.create({
          workspaceId,
          userId,
          target: APP_IMPORT_TARGET,
          fileName: files
            .map(file => file.fileName)
            .join(', ')
            .slice(0, 255),
          createdRefs: created,
          updatedRefs: updated,
          summary: { transactions: summary.transactions, budgets: summary.budgets },
        }),
      );
      return { summary, batch };
    });
    await this.audit(userId, workspaceId, batch.id, summary);
    const statementIds = batch.createdRefs
      .filter(ref => ref.kind === 'statement')
      .map(ref => ref.id);
    if (form.categorize !== false) {
      const deps = { dataSource: this.dataSource, logger: this.logger };
      await categorizeImported(
        { ...deps, classification: this.classificationService },
        userId,
        workspaceId,
        statementIds,
      );
    }
    await announceImported(this.dataSource, this.eventEmitter, workspaceId, statementIds);
    if (this.cache) {
      await invalidateCategoryCache(this.cache, workspaceId);
    }
    return { ...summary, batchId: batch.id };
  }

  /** The JSON of account choices, checked against its contract. */
  private accountChoices(raw: string | null | undefined): Record<string, string | null> {
    if (!raw) {
      return {};
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException({
        ...appError('REQUEST_INVALID'),
        issues: ['accounts: not JSON'],
      });
    }
    const exit = Schema.decodeUnknownExit(AppImportAccountChoices)(parsed);
    if (Exit.isFailure(exit)) {
      throw new BadRequestException({ ...appError('REQUEST_INVALID'), issues: ['accounts'] });
    }
    return { ...exit.value };
  }

  private async walk(
    manager: EntityManager,
    input: {
      workspaceId: string;
      userId: string;
      files: ParsedAppFile[];
      accountTypes: Map<string, WalletType>;
      choices: { currency: string; accounts: Record<string, string | null> };
      dryRun: boolean;
    },
  ): Promise<{
    outcome: AppImportOutcome;
    created: ImportCreatedRef[];
    updated: ImportUpdatedRef[];
  }> {
    const { workspaceId, userId, files, dryRun } = input;
    const txns = files.flatMap(file => file.txns);
    const wallets = await existingWallets(manager, workspaceId);
    const existingCategories = await manager.getRepository(Category).find({
      where: { workspaceId },
      select: { id: true, name: true, parentId: true, type: true },
    });
    const created: ImportCreatedRef[] = [];
    const updated: ImportUpdatedRef[] = [];
    const ctx: AppWriteContext = { manager, workspaceId, userId, created, updated };

    const accounts = planAccounts(txns, wallets, input.accountTypes, input.choices);
    if (!dryRun) {
      await createAccounts(ctx, accounts);
      await setOpenings(ctx, accounts);
    }
    const ref = (key: string) => accounts.get(key)?.walletId ?? `new:${key}`;
    const known = knownAccountKeys(txns, wallets);
    const names = new Map([...accounts.values()].map(account => [account.key, account.name]));
    const plan = planTransactions(txns, known, names, ref);
    const budgetPlan = planBudgets(
      files.flatMap(file => file.budgets),
      new Date().toISOString().slice(0, 10),
    );
    const budgetRows = files
      .flatMap(file => file.budgets)
      .filter(row => row.month === budgetPlan.month && row.assigned > 0);
    const uses = categoryUses(
      txns.filter(txn => !txn.opening && !transferKeyOf(txn, known)),
      budgetRows,
    );
    const { categories, groups } = planCategories(
      uses,
      existingCategories.map(item => ({
        ...item,
        type: item.type === 'income' ? 'income' : 'expense',
      })),
    );
    const { fresh, duplicates } = await bookableTransactions(
      manager,
      workspaceId,
      plan.txns,
      accounts,
      ref,
    );
    const keys = payeeKeys(fresh.filter(txn => !txn.adoptId));
    const matchedKeys = await knownPayeeKeys(manager, workspaceId, keys);
    const byKey = await budgetsByCategory({ manager, workspaceId, userId, created, updated });
    const budgetStatuses: AppImportOutcome['budgetStatuses'] = [];
    if (!dryRun) {
      await createCategories(ctx, groups, categories);
      const before: Array<{ id: string }> = await manager.query(
        'SELECT id FROM payees WHERE workspace_id = $1',
        [workspaceId],
      );
      const app = files.find(file => file.kind === 'register')?.app ?? 'ynab';
      const statementIds = await writeTransactions(ctx, app, fresh, accounts, categories);
      const payees = await newPayeeIds(ctx, statementIds, new Set(before.map(row => row.id)));
      created.push(...payees.map(id => ({ kind: 'payee' as const, id })));
    }
    for (const budget of budgetPlan.budgets) {
      const categoryId = categories.get(budget.categoryKey)?.id ?? null;
      if (dryRun || !categoryId) {
        budgetStatuses.push(
          budgetOutcome(byKey, categoryId, BudgetPeriodType.MONTHLY, budget.limit),
        );
        continue;
      }
      const outcome = await upsertBudget(
        { manager, workspaceId, userId, created, updated },
        byKey,
        {
          categoryId,
          periodType: BudgetPeriodType.MONTHLY,
          limit: budget.limit,
          currency: input.choices.currency,
          name: budget.name,
        },
      );
      budgetStatuses.push(outcome.status);
    }
    const outcome: AppImportOutcome = {
      files,
      rowsPerFile: new Map(
        files.map(file => [file.fileName, file.txns.length + file.budgets.length]),
      ),
      accounts,
      categories,
      groups,
      payees: { created: keys.size - matchedKeys.size, matched: matchedKeys.size },
      fresh,
      duplicates,
      transfers: plan.transfers,
      budgetPlan,
      budgetStatuses,
    };
    if (!dryRun && !writesAnything(outcome)) {
      throw new BadRequestException(appError('IMPORT_NO_VALID_ROWS'));
    }
    return { outcome, created, updated };
  }

  private async audit(
    userId: string,
    workspaceId: string,
    batchId: string,
    summary: AppImportResult,
  ) {
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.STATEMENT,
        entityId: batchId,
        action: AuditAction.IMPORT,
        diff: null,
        meta: {
          target: APP_IMPORT_TARGET,
          transactions: summary.transactions,
          budgets: summary.budgets,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit write failed for import ${batchId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
