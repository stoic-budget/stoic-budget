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
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import type { RunEntityImportBody } from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Category, CategorySource, CategoryType } from '../../entities/category.entity';
import { ImportBatch, type ImportCreatedRef } from '../../entities/import-batch.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { ClassificationService } from '../classification/services/classification.service';
import { MetalsService } from '../investments/metals.service';
import { ensureAppImportPermission } from './apps/app-import-permission';
import {
  announceImported,
  categorizeImported,
  invalidateCategoryCache,
} from './helpers/import-follow-up';
import { APP_IMPORT_TARGET, removeImportBatch } from './helpers/import-undo';
import { nameKey } from './helpers/import-values';
import { type ImportTargetKind, TARGET_FIELDS } from './target-aliases';
import { BudgetsTarget } from './targets/budgets.target';
import { InvoicesTarget } from './targets/invoices.target';
import { MetalsTarget } from './targets/metals.target';
import { PayablesTarget } from './targets/payables.target';
import { SubscriptionsTarget } from './targets/subscriptions.target';
import type { ImportContext, ImportTarget, RowResult } from './targets/target.types';
import { TransactionsTarget } from './targets/transactions.target';

/**
 * The scope an API key needs to import (or undo) each target: the permission
 * the matching create route asks for. Roles are checked by the toggles below.
 */
const IMPORT_SCOPES: Record<ImportTargetKind, Permission> = {
  transactions: Permission.STATEMENT_UPLOAD,
  payables: Permission.PAYABLE_CREATE,
  subscriptions: Permission.SUBSCRIPTION_CREATE,
  invoices: Permission.INVOICE_CREATE,
  budgets: Permission.BUDGET_CREATE,
  metals: Permission.WALLET_CREATE,
};

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
      const categoryRepo = manager.getRepository(Category);
      const categoryCache = new Map<string, string>();
      const ctx: ImportContext = {
        workspaceId,
        userId,
        manager,
        currency,
        fileName: dto.fileName ?? null,
        categorize: dto.options?.categorize !== false,
        walletId: dto.options?.walletId ?? null,
        headers: [...(dto.headers ?? [])],
        cell: (row, field) => {
          const index = dto.mapping[field];
          return Number.isInteger(index) && index >= 0 ? String(row[index] ?? '') : '';
        },
        category: async (name, type) => {
          const key = `${type}|${nameKey(name)}`;
          if (!nameKey(name)) {
            return null;
          }
          const cached = categoryCache.get(key);
          if (cached) {
            return cached;
          }
          const all = await categoryRepo.find({
            where: { workspaceId },
            select: { id: true, name: true, type: true },
          });
          const found =
            all.find(item => item.type === type && nameKey(item.name) === nameKey(name)) ??
            all.find(item => nameKey(item.name) === nameKey(name));
          if (found) {
            categoryCache.set(key, found.id);
            return found.id;
          }
          if (dryRun) {
            return null;
          }
          const created = await categoryRepo.save(
            categoryRepo.create({
              workspaceId,
              userId,
              name: name.trim(),
              type: type === 'income' ? CategoryType.INCOME : CategoryType.EXPENSE,
              source: CategorySource.USER,
              isSystem: false,
            }),
          );
          ctx.created.push({ kind: 'category', id: created.id });
          categoryCache.set(key, created.id);
          return created.id;
        },
        created: [],
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
    if (!dryRun && counts.created + counts.updated === 0) {
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
    }
    const createdIds = ctx.created
      .filter(ref =>
        dto.target === 'transactions'
          ? ref.kind === 'statement'
          : ref.kind === this.refKind(dto.target),
      )
      .map(ref => ref.id);
    return { batchId, target: dto.target, dryRun, counts, rows: results, createdIds };
  }

  private refKind(target: ImportTargetKind): ImportCreatedRef['kind'] {
    return target === 'payables'
      ? 'payable'
      : target === 'subscriptions'
        ? 'subscription'
        : target === 'invoices'
          ? 'invoice'
          : target === 'budgets'
            ? 'budget'
            : target === 'metals'
              ? 'metal_lot'
              : 'statement';
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
    const removed = await this.dataSource.transaction(async manager => {
      const count = await removeImportBatch(manager, batch);
      await manager.getRepository(ImportBatch).update(batch.id, { undoneAt: new Date() });
      return count;
    });
    if (batch.target === APP_IMPORT_TARGET && this.cache) {
      await invalidateCategoryCache(this.cache, workspaceId);
    }
    await this.audit(
      userId,
      workspaceId,
      batch.id,
      batch.target as ImportTargetKind,
      AuditAction.DELETE,
      { target: batch.target, removed },
    );
    return { undone: true, removed, restored: batch.updatedRefs.length };
  }

  private entityTypeOf(target: ImportTargetKind): EntityType | null {
    const types: Record<ImportTargetKind, EntityType | null> = {
      transactions: EntityType.STATEMENT,
      payables: EntityType.PAYABLE,
      subscriptions: EntityType.SUBSCRIPTION,
      invoices: EntityType.INVOICE,
      budgets: EntityType.BUDGET,
      // No audit entity type for metal lots yet.
      metals: null,
    };
    // An app import's batch books statements.
    return target in types ? types[target] : EntityType.STATEMENT;
  }

  private async audit(
    userId: string,
    workspaceId: string,
    batchId: string,
    target: ImportTargetKind,
    action: AuditAction,
    meta: Record<string, unknown>,
  ) {
    const entityType = this.entityTypeOf(target);
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
