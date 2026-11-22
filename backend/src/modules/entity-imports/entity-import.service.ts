import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { DataSource, type Repository } from 'typeorm';
import { assertApiKeyScopes, type PermissionSubject } from '../../common/authz/request-permissions';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import type { RunEntityImportBody } from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import {
  ImportBatch,
  type ImportCreatedRef,
  type ImportUpdatedRef,
} from '../../entities/import-batch.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { ClassificationService } from '../classification/services/classification.service';
import { InvestmentTradesService } from '../investments/investment-trades.service';
import { MetalsService } from '../investments/metals.service';
import { ensureAppImportPermission } from './apps/app-import-permission';
import { importCategoryResolver } from './helpers/import-category';
import {
  announceImported,
  categorizeImported,
  invalidateCategoryCache,
} from './helpers/import-follow-up';
import { APP_IMPORT_TARGET, removeImportBatch } from './helpers/import-undo';
import { importPeriod } from './helpers/import-values';
import { type ImportTargetKind, TARGET_FIELDS } from './target-aliases';
import { BudgetsTarget } from './targets/budgets.target';
import { InvoicesTarget } from './targets/invoices.target';
import { MetalsTarget } from './targets/metals.target';
import { PayablesTarget } from './targets/payables.target';
import { SubscriptionsTarget } from './targets/subscriptions.target';
import type { ImportContext, ImportTarget, RowResult } from './targets/target.types';
import { AUDIT_ENTITY, CREATED_KIND, IMPORT_SCOPES } from './targets/target-registry';
import { TradesTarget } from './targets/trades.target';
import { TransactionsTarget } from './targets/transactions.target';

export interface EntityImportResult {
  batchId: string | null;
  target: ImportTargetKind;
  dryRun: boolean;
  counts: { created: number; updated: number; skipped: number; errors: number };
  rows: RowResult[];
  /** Ids to open the imported records as a custom table (statement ids for transactions). */
  createdIds: string[];
}

@Injectable()
export class EntityImportService {
  private readonly logger = new Logger(EntityImportService.name);
  private readonly targets: Record<ImportTargetKind, ImportTarget> = {
    transactions: new TransactionsTarget(),
    payables: new PayablesTarget(),
    subscriptions: new SubscriptionsTarget(),
    invoices: new InvoicesTarget(),
    budgets: new BudgetsTarget(),
    metals: new MetalsTarget(),
    trades: new TradesTarget(),
  };

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ImportBatch) private readonly batchRepository: Repository<ImportBatch>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly auditService: AuditService,
    @Optional() private readonly classificationService?: ClassificationService,
    @Optional() private readonly metalsService?: MetalsService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly tradesService?: InvestmentTradesService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache,
  ) {}

  /** Importing into `target` (and remembering a mapping for it) needs these rights. */
  async ensurePermission(
    userId: string,
    workspaceId: string,
    target: ImportTargetKind,
    apiKey: PermissionSubject['apiKey'],
  ) {
    assertApiKeyScopes([IMPORT_SCOPES[target]], apiKey);
    // Transactions land in statements; everything else is plain data entry.
    if (target === 'transactions') {
      await ensureCanEdit(
        this.workspaceMemberRepository,
        workspaceId,
        userId,
        'canEditStatements',
        'STATEMENTS_EDIT_FORBIDDEN',
      );
      return;
    }
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditDataEntry',
      'DATA_ENTRY_EDIT_FORBIDDEN',
    );
  }

  private assertMapping(target: ImportTargetKind, mapping: Record<string, number>, width: number) {
    const missing = TARGET_FIELDS[target]
      .filter(field => field.required)
      .filter(
        field =>
          !Number.isInteger(mapping[field.key]) ||
          mapping[field.key] < 0 ||
          mapping[field.key] >= width,
      )
      .map(field => field.key);
    if (missing.length) {
      throw new BadRequestException(
        appError('IMPORT_MAPPING_INCOMPLETE', { fields: missing.join(', ') }),
      );
    }
  }

  async run(
    userId: string,
    workspaceId: string,
    dto: RunEntityImportBody,
    apiKey?: PermissionSubject['apiKey'],
  ): Promise<EntityImportResult> {
    const target = this.targets[dto.target];
    if (!target) {
      throw new BadRequestException(appError('IMPORT_TARGET_UNKNOWN'));
    }
    await this.ensurePermission(userId, workspaceId, dto.target, apiKey);
    const rows = dto.rows.map(row =>
      Array.isArray(row) ? row.map(cell => String(cell ?? '')) : [],
    );
    const width = Math.max(0, ...rows.map(row => row.length));
    this.assertMapping(dto.target, dto.mapping, width);
    const dryRun = dto.dryRun === true;
    const currency = (dto.options?.currency ?? 'USD').toUpperCase();

    const execute = async (manager: ImportContext['manager']) => {
      const created: ImportCreatedRef[] = [];
      const ctx: ImportContext = {
        workspaceId,
        userId,
        manager,
        currency,
        fileName: dto.fileName ?? null,
        categorize: dto.options?.categorize !== false,
        walletId: dto.options?.walletId ?? null,
        investmentAccountId: dto.options?.investmentAccountId ?? null,
        createMissingHoldings: dto.options?.createMissingHoldings === true,
        period: importPeriod(dto.options),
        headers: [...(dto.headers ?? [])],
        cell: (row, field) => {
          const index = dto.mapping[field];
          return Number.isInteger(index) && index >= 0 ? String(row[index] ?? '') : '';
        },
        category: importCategoryResolver(manager, workspaceId, userId, dryRun, created),
        created,
        updated: [],
      };
      const results = await target.run(rows, ctx, dryRun);
      return { ctx, results };
    };

    // Metal lots need an account to sit on. It is created before the
    // transaction rather than inside it: the metals service writes through its
    // own repositories, and an empty account left behind by a rolled-back
    // import is harmless — the next run reuses it.
    if (!dryRun && dto.target === 'metals' && this.metalsService) {
      await this.metalsService.ensureMetalsAccount(workspaceId, userId);
    }

    const { ctx, results } = dryRun
      ? await execute(this.dataSource.manager)
      : await this.dataSource.transaction(manager => execute(manager));

    const counts = {
      created: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    };
    // Nothing written at all. A transactions import of a quiet period writes
    // only its (empty) statement; other targets write a record per created row.
    if (!dryRun && counts.created + counts.updated === 0 && !ctx.created.length) {
      throw new BadRequestException(appError('IMPORT_NO_VALID_ROWS'));
    }
    let batchId: string | null = null;
    if (!dryRun) {
      const batch = await this.batchRepository.save(
        this.batchRepository.create({
          workspaceId,
          userId,
          target: dto.target,
          fileName: dto.fileName ?? null,
          createdRefs: ctx.created,
          updatedRefs: ctx.updated,
          summary: counts,
        }),
      );
      batchId = batch.id;
      await this.audit(userId, workspaceId, batch.id, dto.target, AuditAction.IMPORT, {
        target: dto.target,
        ...counts,
      });
      const statementIds = ctx.created.filter(ref => ref.kind === 'statement').map(ref => ref.id);
      if (dto.target === 'transactions' && ctx.categorize) {
        const deps = { dataSource: this.dataSource, logger: this.logger };
        await categorizeImported(
          { ...deps, classification: this.classificationService },
          userId,
          workspaceId,
          statementIds,
        );
      }
      if (dto.target === 'transactions') {
        await announceImported(this.dataSource, this.eventEmitter, workspaceId, statementIds);
      }
      // Imported lots land without a price; one pass quotes them all.
      if (dto.target === 'metals' && this.metalsService) {
        await this.metalsService.refreshPrices(userId, workspaceId);
      }
      // Trades move quantities: the accounts' values follow, new holdings get a price.
      await this.tradesService?.syncHoldings(userId, workspaceId, holdingRefs(ctx));
    }
    const createdIds = ctx.created
      .filter(ref => ref.kind === CREATED_KIND[dto.target])
      .map(ref => ref.id);
    return { batchId, target: dto.target, dryRun, counts, rows: results, createdIds };
  }

  async undo(
    userId: string,
    workspaceId: string,
    batchId: string,
    apiKey?: PermissionSubject['apiKey'],
  ): Promise<{ undone: true; removed: number; restored: number }> {
    const batch = await this.batchRepository.findOne({ where: { id: batchId, workspaceId } });
    if (!batch) {
      throw new NotFoundException(appError('IMPORT_BATCH_NOT_FOUND'));
    }
    if (batch.undoneAt) {
      throw new BadRequestException(appError('IMPORT_BATCH_ALREADY_UNDONE'));
    }
    if (batch.target === APP_IMPORT_TARGET) {
      const withBudgets = [...batch.createdRefs, ...batch.updatedRefs].some(
        ref => ref.kind === 'budget',
      );
      await ensureAppImportPermission(
        this.workspaceMemberRepository,
        userId,
        workspaceId,
        apiKey,
        withBudgets,
      );
    } else {
      await this.ensurePermission(userId, workspaceId, batch.target as ImportTargetKind, apiKey);
    }
    const tradeIds = batch.createdRefs.filter(r => r.kind === 'investment_trade').map(r => r.id);
    const { removed, holdings } = await this.dataSource.transaction(async manager => {
      // Under the holdings' locks, so a sale entered meanwhile either waits
      // for the undo or is counted in this check.
      await this.tradesService?.assertRemovable(workspaceId, tradeIds, manager);
      const { removed: count, holdings } = await removeImportBatch(manager, batch);
      await manager.getRepository(ImportBatch).update(batch.id, { undoneAt: new Date() });
      return { removed: count, holdings };
    });
    if (batch.target === APP_IMPORT_TARGET && this.cache) {
      await invalidateCategoryCache(this.cache, workspaceId);
    }
    await this.audit(
      userId,
      workspaceId,
      batch.id,
      batch.target as ImportTargetKind | typeof APP_IMPORT_TARGET,
      AuditAction.DELETE,
      { target: batch.target, removed },
    );
    await this.tradesService?.syncHoldings(
      userId,
      workspaceId,
      [...holdingRefs(batch.updatedRefs), ...holdings.kept],
      holdings.accountIds,
    );
    return { undone: true, removed, restored: batch.updatedRefs.length };
  }

  private async audit(
    userId: string,
    workspaceId: string,
    batchId: string,
    target: ImportTargetKind | typeof APP_IMPORT_TARGET,
    action: AuditAction,
    meta: Record<string, unknown>,
  ) {
    // An app import's batch books statements.
    const entityType = target === APP_IMPORT_TARGET ? EntityType.STATEMENT : AUDIT_ENTITY[target];
    if (!entityType) {
      return;
    }
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType,
        entityId: batchId,
        action,
        diff: null,
        meta,
      });
    } catch (error) {
      this.logger.warn(
        `Audit write failed for import ${batchId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** Holdings an import touched: the ones it created and the ones whose trades it added to. */
function holdingRefs(
  refs: Pick<ImportContext, 'created' | 'updated'> | ImportUpdatedRef[],
): string[] {
  const all = Array.isArray(refs) ? refs : [...refs.created, ...refs.updated];
  return all.filter(ref => ref.kind === 'investment_holding').map(ref => ref.id);
}
