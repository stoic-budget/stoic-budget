import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  Not,
  type QueryDeepPartialEntity,
  type Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import * as xlsx from 'xlsx';
import { toEnum } from '../../common/effect/to-enum';
import { withoutNulls } from '../../common/effect/without-nulls';
import { appError } from '../../common/errors/app-error';
import { appDefaultCurrency, currencyCodeOrDefault } from '../../common/utils/currency.util';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { normalizeFilename } from '../../common/utils/filename.util';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import { assertNoTaxLockedTransactions } from '../../common/utils/tax-lock.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import type {
  BatchCreateCustomTableRowsBody,
  ClassifyPaidStatusBody,
  CreateCustomTableBody,
  CreateCustomTableColumnBody,
  CreateCustomTableFromDataEntryBody,
  CreateCustomTableFromDataEntryCustomTabBody,
  CreateCustomTableFromSourceBody,
  CreateCustomTableRowBody,
  PreviewCustomTableSourceBody,
  PreviewFormulaBody,
  ReorderCustomTableColumnsBody,
  RestoredTableDefault,
  UpdateCustomTableBody,
  UpdateCustomTableColumnBody,
  UpdateCustomTableColumnStyleBody,
  UpdateCustomTableRowBody,
  UpdateCustomTableSummariesBody,
  UpdateCustomTableViewSettingsColumnBody,
  UpdateCustomTableViewsBody,
} from '../../contracts';
import { MAX_SOURCE_STATEMENTS } from '../../contracts';
import {
  ActorType,
  AuditAction,
  type AuditEventDiff,
  EntityType,
  Severity,
} from '../../entities/audit-event.entity';
import { Category } from '../../entities/category.entity';
import { CustomTable, CustomTableSource } from '../../entities/custom-table.entity';
import { CustomTableCellStyle } from '../../entities/custom-table-cell-style.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableColumnStyle } from '../../entities/custom-table-column-style.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { DataEntry, DataEntryType } from '../../entities/data-entry.entity';
import { DataEntryCustomField } from '../../entities/data-entry-custom-field.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { ClassificationService } from '../classification/services/classification.service';
import type { TransactionsImportedEvent } from '../notifications/events/notification-events';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { CustomTableSourcesService } from './custom-table-sources.service';
import { DataEntryToCustomTableScope } from './dto/create-custom-table-from-data-entry.dto';
import {
  CUSTOM_TABLE_AGGREGATE_FNS,
  type CustomTableAggregateDto,
  type CustomTableAggregateResult,
  type CustomTableRowFilterDto,
  type CustomTableRowSortDto,
} from './dto/list-custom-table-rows.dto';
import { FormulaRecalcService } from './formula-recalc.service';
import {
  describeValidationError,
  formulaHasCycle,
  formulaTypeOfColumn,
  mergeColumnStyle,
  resolveFormulaTitles,
  storageTypeOf,
  validateNumberConfig,
  validateSelectConfig,
} from './helpers/column-config';
import { convertedRowFingerprint, flagRepeatedRows } from './helpers/converted-repeats';
import { type DataEntryFieldKey, getDataEntryColumnMapping } from './helpers/data-entry-columns';
import {
  assertValidFormula,
  collectFieldRefs,
  evaluateFormula,
  evaluateFormulaDetailed,
  FormulaError,
  type FormulaResultType,
  type FormulaValue,
  inferFormulaResultType,
} from './helpers/formula-evaluator';
import { detectPaidStatus, type PaidStatusInput } from './helpers/paid-status.helper';
import {
  applyFormulaColumns,
  attachColumnStyles,
  collectRowText,
  getPaidStatusFieldKeys,
  getRowDataValue,
  getViewSettingsColumns,
  getViewSettingsObject,
  isBlankCellValue,
  isUuid,
  type JsonObject,
  mergeRowStyles,
  readSummaries,
  sameCellValue,
  sanitizeRowData,
  toRowDataRecord,
} from './helpers/row-data';
import { applyRowFilters } from './helpers/row-filters';
import {
  applyRowSort,
  buildAggregateSelections,
  buildTypedValueExprs,
  exportCellValue,
  exportHeader,
  normalizeAggregateValue,
} from './helpers/row-query';
import { throwHelpfulSchemaError } from './helpers/schema-error';
import {
  columnSourceConfig,
  generateColumnKey,
  newSourceColumns,
  sourceBindingOf,
  sourceColumnConfig,
  sourceFields,
} from './helpers/source-columns';
import { fetchSourceRows, normalizeSourceFilters } from './helpers/source-rows';
import {
  buildConversionMapping,
  buildConvertedCsv,
  type ConvertedTransactionInput,
  parseConversionDate,
  parsePositiveAmount,
  readScalarString,
  toDateOnly,
} from './helpers/statement-conversion';
import type { SourceAdapter, SourceFilters, SourceRow, SourceValue } from './sources/source.types';
import { SourceWriteBackService } from './write-back/source-write-back.service';

type CustomTableWithViewSettings = CustomTable & { viewSettings?: JsonObject };

type ColumnDefinitionConfig = JsonObject | null;
type RowInsertData = Record<string, string | number | null>;

@Injectable()
export class CustomTablesService {
  private readonly logger = new Logger(CustomTablesService.name);

  /** Потолок выгрузки: воркбук собирается в памяти, безлимит означал бы OOM. */
  private static readonly MAX_EXPORT_ROWS = 100_000;

  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(CustomTableColumnStyle)
    private readonly customTableColumnStyleRepository: Repository<CustomTableColumnStyle>,
    @InjectRepository(CustomTableCellStyle)
    private readonly customTableCellStyleRepository: Repository<CustomTableCellStyle>,
    @InjectRepository(DataEntry)
    private readonly dataEntryRepository: Repository<DataEntry>,
    @InjectRepository(DataEntryCustomField)
    private readonly dataEntryCustomFieldRepository: Repository<DataEntryCustomField>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly auditService: AuditService,
    // Optional: unit tests build the service without the classifier.
    @Optional() private readonly classificationService?: ClassificationService,
    // Optional for the same reason: most unit specs never touch app data sources.
    @Optional() private readonly customTableSources?: CustomTableSourcesService,
    // Optional too: unit specs build the service by hand and never recalc.
    @Optional() private readonly formulaRecalc?: FormulaRecalcService,
    // Optional for the same reason: only converting rows to a statement needs it.
    @Optional() private readonly workspaceCurrency?: WorkspaceCurrencyService,
    // Optional: converted rows are assessed when the tax module is wired in.
    @Optional() private readonly taxAssignmentService?: TaxAssignmentService,
    // Optional: cells of tables filled from app data write back through it.
    @Optional() private readonly sourceWriteBack?: SourceWriteBackService,
    // Optional: announces converted rows to webhooks; unit specs build the service without it.
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  private async ensureCanEditCustomTables(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditCustomTables',
      'TABLES_EDIT_FORBIDDEN',
    );
  }

  private async ensureCanEditStatements(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
  }

  /**
   * Runs the workspace classifier over freshly converted rows so the statement
   * lands on the dashboard already categorised. Enrichment is best effort:
   * a classifier failure must not undo the conversion itself.
   */
  private async categorizeConvertedTransactions(
    userId: string,
    transactions: Transaction[],
  ): Promise<void> {
    const pending = transactions.filter(transaction => !transaction.categoryId);
    if (!(this.classificationService && pending.length)) {
      return;
    }
    try {
      for (const transaction of pending) {
        // Same order as a statement import: rules, keywords and what the user taught.
        const classification = await this.classificationService.classifyTransaction(
          transaction,
          userId,
        );
        const { categoryId, categorySource, categoryReason } = classification;
        if (categoryId) {
          await this.transactionRepository.update(
            { id: transaction.id },
            {
              categoryId,
              categorySource: categorySource ?? null,
              categoryReason: categoryReason ?? null,
            },
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Categorization after table conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async findConvertedStatement(
    workspaceId: string,
    tableId: string,
  ): Promise<Statement | null> {
    try {
      return await this.statementRepository
        .createQueryBuilder('statement')
        .where('statement.workspaceId = :workspaceId', { workspaceId })
        .andWhere('statement.deletedAt IS NULL')
        .andWhere("statement.parsingDetails -> 'importPreview' ->> 'source' = :source", {
          source: 'custom-table-conversion',
        })
        .andWhere("statement.parsingDetails -> 'importPreview' ->> 'customTableId' = :tableId", {
          tableId,
        })
        .getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
  }

  private async resolveCategoryId(workspaceId: string, categoryId: string): Promise<string> {
    let category: Category | null = null;
    try {
      const qb = this.categoryRepository
        .createQueryBuilder('category')
        .where('category.id = :categoryId', { categoryId })
        .andWhere('category.workspaceId = :workspaceId', { workspaceId });

      category = await qb.getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!category) {
      throw new BadRequestException(appError('CATEGORY_NOT_FOUND'));
    }
    return category.id;
  }

  private async requireTable(workspaceId: string, tableId: string): Promise<CustomTable> {
    if (!isUuid(tableId)) {
      throw new BadRequestException(appError('TABLE_ID_INVALID'));
    }
    try {
      const qb = this.customTableRepository
        .createQueryBuilder('table')
        .leftJoinAndSelect('table.user', 'owner')
        .where('table.id = :tableId', { tableId })
        .andWhere('table.workspaceId = :workspaceId', { workspaceId });

      const table = await qb.getOne();
      if (!table) {
        throw new NotFoundException(appError('TABLE_NOT_FOUND'));
      }
      return table;
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    throw new NotFoundException(appError('TABLE_NOT_FOUND'));
  }

  private async getAllowedColumnKeys(tableId: string): Promise<Set<string>> {
    const columns = await this.customTableColumnRepository.find({
      where: { tableId },
      select: {
        key: true,
      },
    });
    return new Set(columns.map(c => c.key));
  }

  private async getNextColumnPosition(tableId: string): Promise<number> {
    const raw = await this.customTableColumnRepository
      .createQueryBuilder('c')
      .select('MAX(c.position)', 'max')
      .where('c.tableId = :tableId', { tableId })
      .getRawOne<{ max: string | null }>();

    const max = raw?.max ? Number(raw.max) : 0;
    return Number.isFinite(max) ? max + 1 : 1;
  }

  private async getNextRowNumber(tableId: string): Promise<number> {
    const raw = await this.customTableRowRepository
      .createQueryBuilder('r')
      .select('MAX(r.rowNumber)', 'max')
      .where('r.tableId = :tableId', { tableId })
      .getRawOne<{ max: string | null }>();

    const max = raw?.max ? Number(raw.max) : 0;
    return Number.isFinite(max) ? max + 1 : 1;
  }

  private async logEvent(params: {
    userId: string;
    workspaceId: string | null;
    entityType: EntityType;
    entityId: string;
    action: AuditAction;
    diff?: AuditEventDiff | null;
    meta?: JsonObject | null;
    batchId?: string | null;
    severity?: Severity;
    isUndoable?: boolean;
  }) {
    try {
      // Audit: capture custom table mutations (tables, columns, rows, cells).
      await this.auditService.createEvent({
        workspaceId: params.workspaceId,
        actorType: ActorType.USER,
        actorId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        diff: params.diff ?? null,
        meta: params.meta ?? null,
        batchId: params.batchId ?? null,
        severity: params.severity ?? Severity.INFO,
        isUndoable: params.isUndoable,
      });
    } catch (error) {
      this.logger.warn(
        `Audit event write failed for action=${params.action}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async logRowBatchCreate(params: {
    userId: string;
    workspaceId: string | null;
    tableId: string;
    rows: CustomTableRow[];
    meta?: JsonObject;
  }) {
    if (!params.rows.length) {
      return;
    }
    try {
      await this.auditService.createBatchEvents(
        params.rows.map(row => ({
          workspaceId: params.workspaceId,
          actorType: ActorType.USER,
          actorId: params.userId,
          entityType: EntityType.TABLE_ROW,
          entityId: row.id,
          action: AuditAction.CREATE,
          diff: { before: null, after: row },
          meta: { tableId: params.tableId, rowNumber: row.rowNumber, ...(params.meta || {}) },
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Audit event batch write failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createTable(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableBody,
  ): Promise<CustomTable> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const categoryId =
      dto.categoryId === null || dto.categoryId === undefined
        ? null
        : await this.resolveCategoryId(workspaceId, dto.categoryId);

    const table = this.customTableRepository.create({
      userId,
      workspaceId,
      name: dto.name,
      description: dto.description ?? null,
      source: CustomTableSource.MANUAL,
      categoryId,
    });

    let saved: CustomTable;
    try {
      saved = await this.customTableRepository.save(table);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: saved },
      meta: { name: saved.name },
    });
    return saved;
  }

  async listTables(workspaceId: string): Promise<CustomTable[]> {
    try {
      const qb = this.customTableRepository
        .createQueryBuilder('table')
        .leftJoinAndSelect('table.category', 'category')
        .where('table.workspaceId = :workspaceId', { workspaceId })
        .orderBy('table.createdAt', 'DESC');

      return await qb.getMany();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
  }

  async getTable(workspaceId: string, tableId: string): Promise<CustomTable> {
    await this.requireTable(workspaceId, tableId);
    let table: CustomTable | null = null;
    try {
      table = await this.customTableRepository.findOne({
        where: { id: tableId },
        relations: { columns: true, category: true },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }

    table.columns = (table.columns || []).sort((a, b) => a.position - b.position);

    try {
      const styles = await this.customTableColumnStyleRepository.find({
        where: { tableId },
        select: {
          columnKey: true,
          style: true,
        },
      });
      const byKey = new Map(styles.map(s => [s.columnKey, s.style]));
      table.columns = attachColumnStyles(table.columns, byKey);
    } catch (_error) {
      this.logger.warn(`Failed to load column styles for tableId=${tableId}`);
    }

    return table;
  }

  async updateTable(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableBody,
  ): Promise<CustomTable> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    const before = { ...table };
    if (dto.name != null) {
      table.name = dto.name;
    }
    if (dto.description !== undefined) {
      table.description = dto.description ?? null;
    }
    if (dto.categoryId !== undefined) {
      table.categoryId =
        dto.categoryId === null ? null : await this.resolveCategoryId(workspaceId, dto.categoryId);
    }
    let saved: CustomTable;
    try {
      saved = await this.customTableRepository.save(table);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
    });
    return saved;
  }

  async createFromDataEntry(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromDataEntryBody,
  ): Promise<{ tableId: string; columnsCreated: number; rowsCreated: number }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const selectedType =
      dto.scope === DataEntryToCustomTableScope.TYPE ? toEnum(DataEntryType, dto.type) : undefined;

    let entries: DataEntry[];
    try {
      const qb = this.dataEntryRepository
        .createQueryBuilder('entry')
        .where('entry.workspaceId = :workspaceId', { workspaceId })
        .orderBy('entry.date', 'ASC')
        .addOrderBy('entry.createdAt', 'ASC');

      if (selectedType) {
        qb.andWhere('entry.type = :type', { type: selectedType });
      }

      entries = await qb.getMany();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    if (!entries.length) {
      throw new BadRequestException(appError('DATA_ENTRY_EMPTY'));
    }

    const typeLabels: Record<DataEntryType, string> = {
      [DataEntryType.CASH]: 'Наличные',
      [DataEntryType.RAW]: 'Сырьё',
      [DataEntryType.DEBIT]: 'Дебет',
      [DataEntryType.CREDIT]: 'Кредит',
    };

    const defaultName = selectedType
      ? `Ввод данных — ${typeLabels[selectedType] || selectedType}`
      : 'Ввод данных — все';
    const tableName = dto.name?.trim() || defaultName;
    const description = dto.description === undefined ? null : dto.description;

    const customFieldMetaByName = new Map<string, { icon: string | null }>();
    for (const entry of entries) {
      const name = entry.customFieldName?.trim();
      if (!name) {
        continue;
      }
      const icon = entry.customFieldIcon?.trim() || null;
      const existing = customFieldMetaByName.get(name);
      if (!existing) {
        customFieldMetaByName.set(name, { icon });
      } else if (!existing.icon && icon) {
        existing.icon = icon;
      }
    }

    const maxCustomColumns = 50;
    if (customFieldMetaByName.size > maxCustomColumns) {
      throw new BadRequestException(
        appError('TOO_MANY_CUSTOM_COLUMNS', {
          count: customFieldMetaByName.size,
          limit: maxCustomColumns,
        }),
      );
    }

    const columnDefs: Array<{
      id: string;
      title: string;
      type: CustomTableColumnType;
      config?: ColumnDefinitionConfig;
    }> = [
      {
        id: 'date',
        title: 'Дата',
        type: CustomTableColumnType.DATE,
        config: { source: { kind: 'data_entry_field', field: 'date' } },
      },
      ...(dto.scope === DataEntryToCustomTableScope.ALL
        ? [
            {
              id: 'type',
              title: 'Тип',
              type: CustomTableColumnType.TEXT,
              config: { source: { kind: 'data_entry_field', field: 'type' } },
            },
          ]
        : []),
      {
        id: 'amount',
        title: 'Сумма',
        type: CustomTableColumnType.NUMBER,
        config: { source: { kind: 'data_entry_field', field: 'amount' } },
      },
      {
        id: 'currency',
        title: 'Валюта',
        type: CustomTableColumnType.TEXT,
        config: { source: { kind: 'data_entry_field', field: 'currency' } },
      },
      {
        id: 'note',
        title: 'Комментарий',
        type: CustomTableColumnType.TEXT,
        config: { source: { kind: 'data_entry_field', field: 'note' } },
      },
    ];

    const customNames = Array.from(customFieldMetaByName.keys()).sort((a, b) =>
      a.localeCompare(b, 'ru'),
    );
    for (const name of customNames) {
      const meta = customFieldMetaByName.get(name);
      columnDefs.push({
        id: `custom:${name}`,
        title: name,
        type: CustomTableColumnType.TEXT,
        config: {
          ...(meta?.icon ? { icon: meta.icon } : {}),
          source: { kind: 'data_entry_custom_field', name },
        },
      });
    }

    let table: CustomTable;
    try {
      table = await this.customTableRepository.save(
        this.customTableRepository.create({
          userId,
          workspaceId,
          name: tableName,
          description,
          source: CustomTableSource.MANUAL,
          categoryId: null,
          dataEntryScope: dto.scope,
          dataEntryType: selectedType || null,
          dataEntryCustomTabId: null,
          dataEntrySyncedAt: new Date(),
        }),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: table },
      meta: {
        source: 'data_entry_export',
        scope: dto.scope,
        type: selectedType || null,
        rowsPlanned: entries.length,
        customColumns: customNames.length,
      },
    });

    let createdColumns: CustomTableColumn[];
    try {
      createdColumns = await this.customTableColumnRepository.save(
        columnDefs.map((def, position) =>
          this.customTableColumnRepository.create({
            tableId: table.id,
            key: generateColumnKey(),
            title: def.title,
            type: def.type,
            isRequired: false,
            isUnique: false,
            position,
            config: def.config ?? null,
          }),
        ),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const keyByDefId = new Map<string, string>();
    for (let i = 0; i < createdColumns.length; i += 1) {
      const def = columnDefs[i];
      const col = createdColumns[i];
      if (def && col) {
        keyByDefId.set(def.id, col.key);
      }
    }

    const customKeyByName = new Map<string, string>();
    for (const name of customNames) {
      const key = keyByDefId.get(`custom:${name}`);
      if (key) {
        customKeyByName.set(name, key);
      }
    }

    const dateKey = keyByDefId.get('date');
    const typeKey = keyByDefId.get('type');
    const amountKey = keyByDefId.get('amount');
    const currencyKey = keyByDefId.get('currency');
    const noteKey = keyByDefId.get('note');

    if (!(dateKey && amountKey && currencyKey && noteKey)) {
      throw new BadRequestException(appError('TABLE_COLUMNS_BUILD_FAILED'));
    }

    const rowsToInsert = entries.map((entry, idx) => {
      const data: RowInsertData = {};
      data[dateKey] = entry.date;
      data[amountKey] = entry.amount;
      data[currencyKey] = currencyCodeOrDefault(entry.currency);
      data[noteKey] = entry.note || null;

      if (dto.scope === DataEntryToCustomTableScope.ALL && typeKey) {
        data[typeKey] = typeLabels[entry.type] || entry.type;
      }

      const customName = entry.customFieldName?.trim();
      const customValue = entry.customFieldValue ?? null;
      if (customName && customValue !== null) {
        const key = customKeyByName.get(customName);
        if (key) {
          data[key] = customValue;
        }
      }

      return this.customTableRowRepository.create({
        tableId: table.id,
        rowNumber: idx + 1,
        data,
      });
    });

    const chunkSize = 500;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      try {
        await this.customTableRowRepository.save(chunk);
      } catch (error) {
        throwHelpfulSchemaError(error);
      }
    }

    await this.logRowBatchCreate({
      userId,
      workspaceId,
      tableId: table.id,
      rows: rowsToInsert,
      meta: {
        rowsCreated: rowsToInsert.length,
        scope: dto.scope,
        type: selectedType || null,
      },
    });

    return {
      tableId: table.id,
      columnsCreated: createdColumns.length,
      rowsCreated: rowsToInsert.length,
    };
  }

  async createFromDataEntryCustomTab(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromDataEntryCustomTabBody,
  ): Promise<{ tableId: string; columnsCreated: number; rowsCreated: number }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    let customTab: DataEntryCustomField | null = null;
    try {
      const qb = this.dataEntryCustomFieldRepository
        .createQueryBuilder('customField')
        .where('customField.id = :id', { id: dto.customTabId })
        .andWhere('customField.workspaceId = :workspaceId', { workspaceId });

      customTab = await qb.getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!customTab) {
      throw new BadRequestException(appError('VIEW_NOT_FOUND'));
    }

    let entries: DataEntry[];
    try {
      const qb = this.dataEntryRepository
        .createQueryBuilder('entry')
        .where('entry.customTabId = :customTabId', { customTabId: customTab.id })
        .andWhere('entry.workspaceId = :workspaceId', { workspaceId })
        .orderBy('entry.date', 'ASC')
        .addOrderBy('entry.createdAt', 'ASC');

      entries = await qb.getMany();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    if (!entries.length) {
      throw new BadRequestException(appError('VIEW_EMPTY'));
    }

    const tableName = (dto.name?.trim() || customTab.name).slice(0, 120);
    const description = dto.description === undefined ? null : dto.description;

    let table: CustomTable;
    try {
      table = await this.customTableRepository.save(
        this.customTableRepository.create({
          userId,
          workspaceId,
          name: tableName,
          description,
          source: CustomTableSource.MANUAL,
          categoryId: null,
          dataEntryScope: null,
          dataEntryType: null,
          dataEntryCustomTabId: customTab.id,
          dataEntrySyncedAt: new Date(),
        }),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: table },
      meta: {
        source: 'data_entry_custom_tab_export',
        customTabId: customTab.id,
        rowsPlanned: entries.length,
      },
    });

    const columnDefs: Array<{
      id: string;
      title: string;
      type: CustomTableColumnType;
      config?: ColumnDefinitionConfig;
    }> = [
      {
        id: 'date',
        title: 'Дата',
        type: CustomTableColumnType.DATE,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'date',
          },
        },
      },
      {
        id: 'amount',
        title: 'Сумма',
        type: CustomTableColumnType.NUMBER,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'amount',
          },
        },
      },
      {
        id: 'currency',
        title: 'Валюта',
        type: CustomTableColumnType.TEXT,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'currency',
          },
        },
      },
      {
        id: 'note',
        title: 'Комментарий',
        type: CustomTableColumnType.TEXT,
        config: {
          source: {
            kind: 'data_entry_custom_tab',
            customTabId: customTab.id,
            field: 'note',
          },
        },
      },
    ];

    let createdColumns: CustomTableColumn[];
    try {
      createdColumns = await this.customTableColumnRepository.save(
        columnDefs.map((def, position) =>
          this.customTableColumnRepository.create({
            tableId: table.id,
            key: generateColumnKey(),
            title: def.title,
            type: def.type,
            isRequired: false,
            isUnique: false,
            position,
            config: def.config ?? null,
          }),
        ),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const keyByDefId = new Map<string, string>();
    for (let i = 0; i < createdColumns.length; i += 1) {
      const def = columnDefs[i];
      const col = createdColumns[i];
      if (def && col) {
        keyByDefId.set(def.id, col.key);
      }
    }

    const dateKey = keyByDefId.get('date');
    const amountKey = keyByDefId.get('amount');
    const currencyKey = keyByDefId.get('currency');
    const noteKey = keyByDefId.get('note');

    if (!(dateKey && amountKey && currencyKey && noteKey)) {
      throw new BadRequestException(appError('TABLE_COLUMNS_BUILD_FAILED'));
    }

    const rowsToInsert = entries.map((entry, idx) => {
      const data: RowInsertData = {};
      data[dateKey] = entry.date;
      data[amountKey] = entry.amount;
      data[currencyKey] = currencyCodeOrDefault(entry.currency);
      data[noteKey] = entry.note || null;
      return this.customTableRowRepository.create({
        tableId: table.id,
        rowNumber: idx + 1,
        data,
      });
    });

    const chunkSize = 500;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      try {
        await this.customTableRowRepository.save(chunk);
      } catch (error) {
        throwHelpfulSchemaError(error);
      }
    }

    await this.logRowBatchCreate({
      userId,
      workspaceId,
      tableId: table.id,
      rows: rowsToInsert,
      meta: {
        rowsCreated: rowsToInsert.length,
        source: 'data_entry_custom_tab_export',
        customTabId: customTab.id,
      },
    });

    return {
      tableId: table.id,
      columnsCreated: createdColumns.length,
      rowsCreated: rowsToInsert.length,
    };
  }

  async syncFromDataEntry(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<{ tableId: string; rowsCreated: number; syncedAt: Date }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    let table: CustomTable | null = null;
    try {
      const qb = this.customTableRepository
        .createQueryBuilder('table')
        .leftJoinAndSelect('table.columns', 'columns')
        .where('table.id = :tableId', { tableId })
        .andWhere('table.workspaceId = :workspaceId', { workspaceId });

      table = await qb.getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }

    const isCustomTab = Boolean(table.dataEntryCustomTabId);
    if (!(isCustomTab || table.dataEntryScope)) {
      throw new BadRequestException(appError('TABLE_NOT_LINKED_TO_DATA_ENTRY'));
    }

    let entries: DataEntry[];
    try {
      const qb = this.dataEntryRepository
        .createQueryBuilder('entry')
        .where('entry.workspaceId = :workspaceId', { workspaceId })
        .orderBy('entry.date', 'ASC')
        .addOrderBy('entry.createdAt', 'ASC');

      if (isCustomTab) {
        qb.andWhere('entry.customTabId = :customTabId', {
          customTabId: table.dataEntryCustomTabId,
        });
      } else if (table.dataEntryScope === DataEntryToCustomTableScope.TYPE) {
        if (!table.dataEntryType) {
          throw new BadRequestException(appError('SYNC_TYPE_REQUIRED'));
        }
        qb.andWhere('entry.type = :type', { type: table.dataEntryType });
      }

      entries = await qb.getMany();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const columns = (table.columns || []).sort((a, b) => a.position - b.position);
    const { fieldKeyByName, customFieldKeyByName } = getDataEntryColumnMapping(columns);

    const requiredFields: DataEntryFieldKey[] = ['date', 'amount', 'currency', 'note'];
    if (!isCustomTab && table.dataEntryScope === DataEntryToCustomTableScope.ALL) {
      requiredFields.push('type');
    }

    const missing = requiredFields.filter(field => !fieldKeyByName[field]);
    if (missing.length) {
      const labelByField: Record<DataEntryFieldKey, string> = {
        date: 'Дата',
        type: 'Тип',
        amount: 'Сумма',
        currency: 'Валюта',
        note: 'Комментарий',
      };
      const missingLabels = missing.map(field => labelByField[field]).join(', ');
      throw new BadRequestException(appError('SYNC_COLUMNS_NOT_FOUND', { columns: missingLabels }));
    }

    const typeLabels: Record<DataEntryType, string> = {
      [DataEntryType.CASH]: 'Наличные',
      [DataEntryType.RAW]: 'Сырьё',
      [DataEntryType.DEBIT]: 'Дебет',
      [DataEntryType.CREDIT]: 'Кредит',
    };

    const rowsToInsert = entries.map((entry, idx) => {
      const data: RowInsertData = {};
      const dateKey = fieldKeyByName.date;
      const amountKey = fieldKeyByName.amount;
      const currencyKey = fieldKeyByName.currency;
      const noteKey = fieldKeyByName.note;
      const typeKey = fieldKeyByName.type;

      if (dateKey) {
        data[dateKey] = entry.date;
      }
      if (amountKey) {
        data[amountKey] = entry.amount;
      }
      if (currencyKey) {
        data[currencyKey] = currencyCodeOrDefault(entry.currency);
      }
      if (noteKey) {
        data[noteKey] = entry.note || null;
      }

      if (!isCustomTab && table.dataEntryScope === DataEntryToCustomTableScope.ALL && typeKey) {
        data[typeKey] = typeLabels[entry.type] || entry.type;
      }

      const customName = entry.customFieldName?.trim();
      if (customName) {
        const customKey = customFieldKeyByName.get(customName);
        if (customKey) {
          data[customKey] = entry.customFieldValue ?? null;
        }
      }

      return {
        tableId: table.id,
        rowNumber: idx + 1,
        data,
      };
    });

    const syncedAt = new Date();
    const createdRows: CustomTableRow[] = [];
    await this.customTableRepository.manager.transaction(async manager => {
      await manager.delete(CustomTableRow, { tableId: table.id });
      const chunkSize = 500;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        if (chunk.length) {
          const savedChunk = await manager.save(CustomTableRow, chunk);
          createdRows.push(...savedChunk);
        }
      }
      await manager.update(CustomTable, { id: table.id }, { dataEntrySyncedAt: syncedAt });
    });

    await this.logRowBatchCreate({
      userId,
      workspaceId,
      tableId: table.id,
      rows: createdRows,
      meta: {
        rowsCreated: rowsToInsert.length,
        source: 'data_entry_sync',
      },
    });

    await this.recalcAfterWrite(table.id, workspaceId);
    return { tableId: table.id, rowsCreated: rowsToInsert.length, syncedAt };
  }

  // ── Fill from app data ───────────────────────────────────────────────────

  private requireSources(): CustomTableSourcesService {
    if (!this.customTableSources) {
      throw new BadRequestException(appError('SOURCE_KIND_UNKNOWN'));
    }
    return this.customTableSources;
  }

  /**
   * "Restore to default" of a table filled from app data. First every app
   * record change made from the table is undone (fields changed in the app since
   * are left alone), then the table becomes a fresh copy of its source: columns
   * and rows added by hand, styles, formulas, summaries and view settings go;
   * the source columns get their original type, options and order back (their
   * titles stay); rows of records that no longer exist go too.
   *
   * Idempotent: a second run finds nothing journaled and a table already at default.
   */
  async restoreDefault(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<RestoredTableDefault> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    const binding = table.sourceBinding;
    if (!(binding?.kind && this.sourceWriteBack)) {
      throw new BadRequestException(appError('TABLE_NOT_LINKED_TO_SOURCE'));
    }
    const adapter = this.requireSources().get(binding.kind);

    const report = await this.sourceWriteBack.revertTable({ userId, workspaceId, table });
    const sourceRows = await fetchSourceRows(
      adapter,
      workspaceId,
      binding.filters as SourceFilters,
    );
    const liveKeys = sourceRows.map(row => row.sourceKey);

    const columns = await this.customTableRepository.manager.transaction(async manager => {
      const columnRepo = manager.getRepository(CustomTableColumn);
      const rowRepo = manager.getRepository(CustomTableRow);
      const existing = await columnRepo.find({ where: { tableId } });
      const byField = new Map<string, CustomTableColumn>();
      const extra: CustomTableColumn[] = [];
      for (const column of existing) {
        const field = columnSourceConfig(column.config);
        const known =
          field?.kind === 'app_field' &&
          field.field &&
          adapter.columns.some(def => def.field === field.field) &&
          !byField.has(field.field);
        if (known && field?.field) {
          byField.set(field.field, column);
        } else {
          extra.push(column);
        }
      }
      const currency = existing
        .map(column => (column.config as { currency?: unknown } | null)?.currency)
        .find((value): value is string => typeof value === 'string' && value.length === 3);

      if (extra.length) {
        await columnRepo.delete(extra.map(column => column.id));
      }
      const kept = adapter.columns.map((def, position) => {
        const column =
          byField.get(def.field) ??
          columnRepo.create({ tableId, key: generateColumnKey(), title: def.title });
        column.type = def.type;
        column.isRequired = false;
        column.isUnique = false;
        column.position = position;
        column.config = sourceColumnConfig(def, currency);
        return column;
      });
      const saved = await columnRepo.save(kept);

      // Rows typed by hand, and rows whose record is gone (all of them when the
      // source has no records left).
      const rowDelete = rowRepo
        .createQueryBuilder()
        .delete()
        .where('table_id = :tableId', { tableId });
      if (liveKeys.length) {
        rowDelete.andWhere('(source_key IS NULL OR source_key NOT IN (:...liveKeys))', {
          liveKeys,
        });
      }
      await rowDelete.execute();
      // What the remaining rows hold beyond the record goes with them: the
      // source values are written back in full below.
      await rowRepo
        .createQueryBuilder()
        .update()
        .set({ data: {}, styles: {}, computed: {} })
        .where('table_id = :tableId', { tableId })
        .execute();
      await manager.getRepository(CustomTableColumnStyle).delete({ tableId });
      await manager
        .createQueryBuilder()
        .delete()
        .from(CustomTableCellStyle)
        .where('row_id IN (SELECT id FROM custom_table_rows WHERE table_id = :tableId)', {
          tableId,
        })
        .execute();
      await manager.getRepository(CustomTable).update({ id: tableId }, { viewSettings: {} });
      return saved;
    });

    table.sourceBinding = { ...binding, fields: sourceFields(adapter) };
    const applied = await this.applySourceRows({
      userId,
      workspaceId,
      table,
      columns,
      sourceRows,
    });
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: tableId,
      action: AuditAction.ROLLBACK,
      meta: {
        restoredDefault: true,
        reverted: report.reverted,
        skippedChanged: report.skippedChanged,
        failed: report.failed.length,
        rows: applied.total,
      },
      isUndoable: false,
    });
    return { tableId, ...report, rows: applied.total };
  }

  async previewSource(
    userId: string,
    workspaceId: string,
    dto: PreviewCustomTableSourceBody,
  ): Promise<{
    count: number;
    columns: Array<{ field: string; title: string; type: CustomTableColumnType }>;
    rows: Array<Record<string, SourceValue>>;
    currencies: string[];
  }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const adapter = this.requireSources().get(dto.kind);
    const rows = await fetchSourceRows(
      adapter,
      workspaceId,
      normalizeSourceFilters(dto.filters ? withoutNulls(dto.filters) : undefined) as SourceFilters,
    );
    return {
      count: rows.length,
      columns: adapter.columns.map(def => ({
        field: def.field,
        title: dto.columnTitles?.[def.field] || def.title,
        type: def.type,
      })),
      rows: rows.slice(0, 20).map(row => row.values),
      currencies: [
        ...new Set(
          rows
            .map(row => row.values.currency)
            .filter((value): value is string => typeof value === 'string' && value !== ''),
        ),
      ].sort(),
    };
  }

  async createFromSource(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromSourceBody,
  ): Promise<{ tableId: string; columnsCreated: number; rowsCreated: number }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const adapter = this.requireSources().get(dto.kind);
    const filters = normalizeSourceFilters(dto.filters ? withoutNulls(dto.filters) : undefined);
    const sourceRows = await fetchSourceRows(adapter, workspaceId, filters as SourceFilters);
    if (!sourceRows.length) {
      throw new BadRequestException(appError('SOURCE_EMPTY'));
    }
    const categoryId = dto.categoryId
      ? await this.resolveCategoryId(workspaceId, dto.categoryId)
      : null;
    const firstCurrency = sourceRows
      .map(row => row.values.currency)
      .find((value): value is string => typeof value === 'string' && /^[A-Za-z]{3}$/.test(value));
    const currency = (dto.currency ?? firstCurrency)?.toUpperCase();
    const defaultName = `${adapter.kind.charAt(0).toUpperCase()}${adapter.kind.slice(1)}`;
    const name = (dto.name?.trim() || defaultName).slice(0, 120);

    let table: CustomTable;
    try {
      table = await this.customTableRepository.save(
        this.customTableRepository.create({
          userId,
          workspaceId,
          name,
          description: dto.description?.trim() || null,
          source: CustomTableSource.MANUAL,
          categoryId,
          sourceBinding: sourceBindingOf(adapter, filters),
        }),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    let columns: CustomTableColumn[];
    try {
      columns = await this.customTableColumnRepository.save(
        adapter.columns.map((def, position) =>
          this.customTableColumnRepository.create({
            tableId: table.id,
            key: generateColumnKey(),
            title: (dto.columnTitles?.[def.field] || def.title).slice(0, 120),
            type: def.type,
            isRequired: false,
            isUnique: false,
            position,
            config: sourceColumnConfig(def, currency),
          }),
        ),
      );
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: table },
      meta: { source: 'app_source', kind: adapter.kind, filters, rowsPlanned: sourceRows.length },
    });

    const result = await this.applySourceRows({ userId, workspaceId, table, columns, sourceRows });
    return { tableId: table.id, columnsCreated: columns.length, rowsCreated: result.inserted };
  }

  async refreshFromSource(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<{
    tableId: string;
    inserted: number;
    updated: number;
    unchanged: number;
    total: number;
    syncedAt: string;
  }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    let table: CustomTable | null = null;
    try {
      table = await this.customTableRepository
        .createQueryBuilder('table')
        .leftJoinAndSelect('table.columns', 'columns')
        .where('table.id = :tableId', { tableId })
        .andWhere('table.workspaceId = :workspaceId', { workspaceId })
        .getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }
    const binding = table.sourceBinding;
    if (!binding?.kind) {
      throw new BadRequestException(appError('TABLE_NOT_LINKED_TO_SOURCE'));
    }
    const adapter = this.requireSources().get(binding.kind);
    const sourceRows = await fetchSourceRows(
      adapter,
      workspaceId,
      (binding.filters ?? {}) as SourceFilters,
    );
    const columns = await this.addNewSourceColumns(table, adapter);
    table.sourceBinding = { ...binding, fields: sourceFields(adapter) };
    const result = await this.applySourceRows({ userId, workspaceId, table, columns, sourceRows });
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.UPDATE,
      meta: {
        source: 'app_source_refresh',
        kind: binding.kind,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
      },
    });
    return { tableId: table.id, ...result };
  }

  /**
   * Adds documents to a table built from documents' transactions, then
   * refreshes it. Only such a table qualifies: on one bound to a date range or
   * to picked records, a document filter would narrow the table instead of
   * growing it. Ids already in the binding are kept once, so a repeat is a no-op.
   */
  async addSourceStatements(
    userId: string,
    workspaceId: string,
    tableId: string,
    statementIds: readonly string[],
  ): ReturnType<CustomTablesService['refreshFromSource']> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.customTableRepository.findOne({ where: { id: tableId, workspaceId } });
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }
    const binding = table.sourceBinding;
    const current = binding?.filters?.statementIds;
    if (binding?.kind !== 'transactions' || !Array.isArray(current) || binding.filters?.ids) {
      throw new BadRequestException(appError('SOURCE_NOT_DOCUMENTS'));
    }
    const requested = [...new Set(statementIds)];
    const found = await this.statementRepository.count({
      where: { id: In(requested), workspaceId, deletedAt: IsNull() },
    });
    if (found !== requested.length) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }
    const merged = [...new Set([...current.map(String), ...requested])];
    if (merged.length > MAX_SOURCE_STATEMENTS) {
      throw new BadRequestException(
        appError('SOURCE_TOO_MANY_DOCUMENTS', { limit: MAX_SOURCE_STATEMENTS }),
      );
    }
    await this.customTableRepository.update(
      { id: table.id, workspaceId },
      { sourceBinding: { ...binding, filters: { ...binding.filters, statementIds: merged } } },
    );
    return this.refreshFromSource(userId, workspaceId, table.id);
  }

  /** Adds a column for each field the source gained since the table was made. */
  private async addNewSourceColumns(
    table: CustomTable,
    adapter: SourceAdapter,
  ): Promise<CustomTableColumn[]> {
    const existing = table.columns ?? [];
    const drafts = newSourceColumns(table, adapter);
    if (!drafts.length) {
      return existing;
    }
    try {
      const created = await this.customTableColumnRepository.save(
        drafts.map(draft => this.customTableColumnRepository.create(draft)),
      );
      return [...existing, ...created];
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
  }

  /**
   * Upsert by sourceKey. Only columns bound to a source field are written
   * (jsonb `||` patch), so user columns, styles, comments and row ids survive
   * a refresh. Rows whose source record disappeared are left in place.
   */
  private async applySourceRows(params: {
    userId: string;
    workspaceId: string;
    table: CustomTable;
    columns: CustomTableColumn[];
    sourceRows: SourceRow[];
  }): Promise<{
    inserted: number;
    updated: number;
    unchanged: number;
    total: number;
    syncedAt: string;
  }> {
    const { table, sourceRows } = params;
    const keyByField = new Map<string, string>();
    for (const column of params.columns) {
      const source = columnSourceConfig(column.config);
      if (source?.kind === 'app_field' && source.field) {
        keyByField.set(source.field, column.key);
      }
    }
    if (!keyByField.size) {
      throw new BadRequestException(appError('SOURCE_COLUMNS_NOT_FOUND'));
    }

    let existing: CustomTableRow[] = [];
    try {
      existing = await this.customTableRowRepository.find({
        where: { tableId: table.id, sourceKey: Not(IsNull()) },
        select: {
          id: true,
          sourceKey: true,
          data: true,
        },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    const existingByKey = new Map<string, CustomTableRow>();
    for (const row of existing) {
      if (row.sourceKey) {
        existingByKey.set(row.sourceKey, row);
      }
    }

    const toInsert: CustomTableRow[] = [];
    const toUpdate: Array<{ id: string; patch: Record<string, SourceValue> }> = [];
    let unchanged = 0;
    let nextRowNumber = await this.getNextRowNumber(table.id);
    for (const sourceRow of sourceRows) {
      const patch: Record<string, SourceValue> = {};
      for (const [field, key] of keyByField) {
        if (field in sourceRow.values) {
          patch[key] = sourceRow.values[field] ?? null;
        }
      }
      const current = existingByKey.get(sourceRow.sourceKey);
      if (!current) {
        toInsert.push(
          this.customTableRowRepository.create({
            tableId: table.id,
            rowNumber: nextRowNumber,
            data: patch,
            sourceKey: sourceRow.sourceKey,
          }),
        );
        nextRowNumber += 1;
        continue;
      }
      const data = toRowDataRecord(current.data);
      const changed = Object.entries(patch).some(
        ([key, value]) => !sameCellValue(data[key], value),
      );
      if (changed) {
        toUpdate.push({ id: current.id, patch });
      } else {
        unchanged += 1;
      }
    }

    const syncedAt = new Date().toISOString();
    const binding = table.sourceBinding ?? { kind: '', filters: {}, syncedAt: null };
    try {
      await this.customTableRepository.manager.transaction(async manager => {
        const chunkSize = 500;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          await manager.save(CustomTableRow, toInsert.slice(i, i + chunkSize));
        }
        for (const item of toUpdate) {
          await manager
            .createQueryBuilder()
            .update(CustomTableRow)
            .set({ data: () => 'data || CAST(:patch AS jsonb)' })
            .setParameter('patch', JSON.stringify(item.patch))
            .where('id = :id AND table_id = :tableId', { id: item.id, tableId: table.id })
            .execute();
        }
        await manager.update(
          CustomTable,
          { id: table.id },
          {
            // jsonb: TypeORM's deep-partial type cannot express `unknown` values.
            sourceBinding: {
              ...binding,
              syncedAt,
            } as QueryDeepPartialEntity<CustomTable>['sourceBinding'],
          },
        );
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    await this.logRowBatchCreate({
      userId: params.userId,
      workspaceId: params.workspaceId,
      tableId: table.id,
      rows: toInsert,
      meta: { rowsCreated: toInsert.length, source: 'app_source', kind: binding.kind },
    });

    await this.recalcAfterWrite(table.id, params.workspaceId);
    return {
      inserted: toInsert.length,
      updated: toUpdate.length,
      unchanged,
      total: sourceRows.length,
      syncedAt,
    };
  }

  /** The workspace's currency, for rows whose money column does not name one. */
  private async resolveWorkspaceCurrency(workspaceId: string): Promise<string> {
    return (await this.workspaceCurrency?.resolve(workspaceId)) ?? appDefaultCurrency();
  }

  async convertToStatement(
    userId: string,
    workspaceId: string,
    tableId: string,
  ): Promise<{
    statementId: string;
    importedRows: number;
    skippedRows: number;
    warnings: string[];
  }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.ensureCanEditStatements(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);

    let columns: CustomTableColumn[];
    let rows: CustomTableRow[];
    try {
      [columns, rows] = await Promise.all([
        this.customTableColumnRepository.find({
          where: { tableId },
          order: { position: 'ASC' },
        }),
        this.customTableRowRepository.find({
          where: { tableId },
          order: { rowNumber: 'ASC' },
        }),
      ]);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    if (!columns.length) {
      throw new BadRequestException(appError('TABLE_NO_COLUMNS_TO_CONVERT'));
    }
    if (!rows.length) {
      throw new BadRequestException(appError('TABLE_NO_ROWS_TO_CONVERT'));
    }

    const mapping = buildConversionMapping(columns);
    const missingRequired = [
      !mapping.date ? 'date' : null,
      !mapping.amount ? 'amount' : null,
    ].filter((value): value is string => Boolean(value));

    if (missingRequired.length) {
      throw new BadRequestException(
        appError('REQUIRED_COLUMNS_UNRESOLVED', { columns: missingRequired.join(', ') }),
      );
    }

    // A money column already knows its currency; rows without an explicit one inherit it.
    const amountColumn = columns.find(column => column.key === mapping.amount);
    const amountCurrency = amountColumn?.config?.currency;
    const defaultCurrency = currencyCodeOrDefault(
      typeof amountCurrency === 'string' ? amountCurrency : null,
      await this.resolveWorkspaceCurrency(workspaceId),
    );

    const converted: ConvertedTransactionInput[] = [];
    const warnings: string[] = [];

    for (const row of rows) {
      const data = toRowDataRecord(row.data);
      const transactionDate = parseConversionDate(
        mapping.date ? getRowDataValue(data, mapping.date) : null,
      );
      const amount = parsePositiveAmount(
        mapping.amount ? getRowDataValue(data, mapping.amount) : null,
      );

      if (!transactionDate) {
        warnings.push(`row ${row.rowNumber} skipped: invalid date`);
        continue;
      }
      if (!amount) {
        warnings.push(`row ${row.rowNumber} skipped: invalid amount`);
        continue;
      }

      const merchant = readScalarString(data, mapping.merchant) || table.name;
      const purpose = readScalarString(data, mapping.purpose) || merchant;
      const currency = (readScalarString(data, mapping.currency) || defaultCurrency)
        .trim()
        .toUpperCase();
      const article = readScalarString(data, mapping.article) || null;

      converted.push({
        rowNumber: row.rowNumber,
        transactionDate,
        merchant,
        purpose,
        amount,
        currency,
        article,
      });
    }

    if (!converted.length) {
      throw new BadRequestException(appError('TABLE_NO_VALID_ROWS_TO_CONVERT'));
    }

    const existingStatement = await this.findConvertedStatement(workspaceId, tableId);
    const csv = buildConvertedCsv(converted);
    const fileName = normalizeFilename(`${table.name}-expenses.csv`);
    const filePath =
      existingStatement?.filePath || path.join(resolveUploadsDir(), `${randomUUID()}.csv`);
    await fs.promises.writeFile(filePath, csv);

    const statementDateFrom = new Date(
      Math.min(...converted.map(row => row.transactionDate.getTime())),
    );
    const statementDateTo = new Date(
      Math.max(...converted.map(row => row.transactionDate.getTime())),
    );
    const totalDebit = converted.reduce((sum, row) => sum + row.amount, 0);
    const currency = currencyCodeOrDefault(converted[0]?.currency);
    const fileHash = createHash('sha256').update(csv).digest('hex');

    const statementPayload: Partial<Statement> = {
      userId,
      workspaceId,
      fileName,
      filePath,
      fileType: FileType.CSV,
      fileSize: csv.length,
      fileHash,
      bankName: BankName.OTHER,
      status: StatementStatus.COMPLETED,
      processedAt: new Date(),
      statementDateFrom,
      statementDateTo,
      totalTransactions: converted.length,
      totalDebit,
      totalCredit: 0,
      currency,
      categoryId: table.categoryId ?? null,
      deletedAt: null,
      parsingDetails: {
        detectedBy: 'custom-table-conversion',
        parserUsed: 'custom-table-conversion',
        parserVersion: '1',
        transactionsFound: rows.length,
        transactionsCreated: converted.length,
        warnings,
        metadataExtracted: {
          dateFrom: toDateOnly(statementDateFrom),
          dateTo: toDateOnly(statementDateTo),
          currency,
        },
        importPreview: {
          source: 'custom-table-conversion',
          customTableId: table.id,
          tableName: table.name,
          rowsImported: converted.length,
          rowsSkipped: rows.length - converted.length,
        },
      },
    };

    // Re-converting replaces the statement's rows, and rows on a filed return may not go.
    if (existingStatement) {
      await assertNoTaxLockedTransactions(this.transactionRepository, {
        statementId: existingStatement.id,
        workspaceId,
      });
    }

    const beforeStatement = existingStatement ? { ...existingStatement } : null;
    const statement = existingStatement
      ? Object.assign(existingStatement, statementPayload)
      : this.statementRepository.create(statementPayload);
    const savedStatement = await this.statementRepository.save(statement);

    try {
      await this.statementRepository.update(savedStatement.id, { fileData: csv });
    } catch (error) {
      this.logger.warn(
        `Failed to persist converted table file in DB: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (existingStatement) {
      await this.transactionRepository.delete({ statementId: savedStatement.id });
    }

    const transactions = converted.map(row =>
      this.transactionRepository.create({
        workspaceId,
        statementId: savedStatement.id,
        transactionDate: new Date(toDateOnly(row.transactionDate)),
        counterpartyName: row.merchant,
        paymentPurpose: row.purpose,
        debit: row.amount,
        credit: null,
        amount: row.amount,
        currency: row.currency,
        article: row.article,
        transactionType: TransactionType.EXPENSE,
        categoryId: table.categoryId ?? null,
        // Converted in bulk from a table: each row is confirmed in Review.
        isVerified: false,
        fingerprint: convertedRowFingerprint(workspaceId, row),
      }),
    );
    // Identical rows import as identical statement lines do: kept, the repeat flagged.
    warnings.push(
      ...(await flagRepeatedRows(this.transactionRepository, workspaceId, transactions, converted)),
    );

    const savedTransactions = await this.transactionRepository.save(transactions);
    await this.categorizeConvertedTransactions(userId, savedTransactions);
    // Converted rows are created without tax and categorised with update(),
    // which the tax subscriber never sees: assess them once they have a category.
    await this.taxAssignmentService?.reassess(workspaceId, {
      ids: savedTransactions.map(transaction => transaction.id),
    });

    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.STATEMENT,
      entityId: savedStatement.id,
      action: AuditAction.IMPORT,
      diff: { before: beforeStatement, after: savedStatement },
      meta: {
        source: 'custom-table-conversion',
        customTableId: table.id,
        rowsImported: converted.length,
        rowsSkipped: rows.length - converted.length,
      },
      isUndoable: false,
    });
    if (savedTransactions.length > 0) {
      this.eventEmitter?.emit('transactions.imported', {
        workspaceId,
        source: 'custom_table',
        statementId: savedStatement.id,
        transactionIds: savedTransactions.map(transaction => transaction.id),
      } satisfies TransactionsImportedEvent);
    }

    return {
      statementId: savedStatement.id,
      importedRows: converted.length,
      skippedRows: rows.length - converted.length,
      warnings,
    };
  }

  async removeTable(userId: string, workspaceId: string, tableId: string): Promise<void> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    try {
      await this.customTableRepository.delete({ id: table.id });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.DELETE,
      diff: { before: table, after: null },
      isUndoable: true,
    });
  }

  /**
   * Проверяет формулу при сохранении и нормализует её: ссылки по названию
   * становятся ссылками по ключу, а в config появляется тип результата.
   * Формула может ссылаться на другие формулы, но не по кругу.
   */
  private async validateFormulaConfig(
    tableId: string,
    type: CustomTableColumnType | undefined,
    config: Record<string, unknown> | null | undefined,
    selfColumnKey: string | null,
    selfTitle?: string,
  ): Promise<void> {
    if (type !== CustomTableColumnType.FORMULA) {
      return;
    }
    const raw = config?.expression;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException(appError('COLUMN_FORMULA_REQUIRED'));
    }
    const columns = await this.customTableColumnRepository.find({
      where: { tableId },
      select: {
        key: true,
        title: true,
        type: true,
        config: true,
      },
    });
    const others = columns.filter(col => col.key !== selfColumnKey);
    // Все колонки, включая свою: «остаток = PREV([Остаток]) + …» должен резолвиться в ключ.
    const expression = resolveFormulaTitles(raw, columns);
    // У новой колонки ключа ещё нет — до сохранения она известна только по названию.
    const selfKey = selfColumnKey ?? selfTitle?.trim() ?? null;
    try {
      assertValidFormula(
        expression,
        others.map(col => col.key),
        { selfKey },
      );
    } catch (error) {
      throw new BadRequestException(appError(...FormulaError.argsOf(error)));
    }

    const refsByKey = new Map<string, string[]>();
    for (const col of others) {
      if (
        col.type === CustomTableColumnType.FORMULA &&
        typeof col.config?.expression === 'string'
      ) {
        try {
          refsByKey.set(col.key, collectFieldRefs(col.config.expression, { excludePrev: true }));
        } catch {
          refsByKey.set(col.key, []);
        }
      }
    }
    const graphKey = selfKey ?? '__self__';
    refsByKey.set(graphKey, collectFieldRefs(expression, { excludePrev: true }));
    if (formulaHasCycle(graphKey, refsByKey)) {
      throw new BadRequestException(appError('COLUMN_FORMULA_CYCLE'));
    }

    const fieldTypes = Object.fromEntries(
      others.map(col => [col.key, formulaTypeOfColumn(col)]),
    ) as Record<string, FormulaResultType>;
    if (selfKey) {
      // PREV([своя колонка]) — почти всегда остаток или счётчик, то есть число.
      fieldTypes[selfKey] = 'number';
    }
    if (config) {
      config.expression = expression;
      config.resultType = inferFormulaResultType(expression, fieldTypes);
    }
  }

  /** Живой пример для редактора: ошибка, тип результата и значение на первой строке. */
  async previewFormula(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: PreviewFormulaBody,
  ): Promise<{
    valid: boolean;
    error: string | null;
    expression: string;
    resultType: FormulaResultType | null;
    sample: FormulaValue;
  }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    const config: Record<string, unknown> = { expression: dto.expression };
    try {
      await this.validateFormulaConfig(
        tableId,
        CustomTableColumnType.FORMULA,
        config,
        dto.columnKey ?? null,
      );
    } catch (error) {
      return {
        valid: false,
        error: describeValidationError(error),
        expression: dto.expression,
        resultType: null,
        sample: null,
      };
    }
    const expression = config.expression as string;
    let sample: FormulaValue = null;
    if (this.formulaRecalc) {
      // Вся таблица: пример видит итоги по колонкам и предыдущие строки, как настоящий пересчёт.
      const columns = await this.customTableColumnRepository.find({ where: { tableId } });
      const { evaluator } = await this.formulaRecalc.buildEvaluator(
        tableId,
        columns.filter(col => col.key !== dto.columnKey),
      );
      if (dto.scope === 'table') {
        sample = evaluateFormula(expression, {}, evaluator.summaryContext());
      } else if (evaluator.rows.length) {
        sample = evaluateFormula(expression, evaluator.rows[0], evaluator.contextFor(0));
      }
    } else {
      const row = await this.customTableRowRepository.findOne({
        where: { tableId },
        order: { rowNumber: 'ASC' },
      });
      if (row) {
        const columns = await this.customTableColumnRepository.find({ where: { tableId } });
        applyFormulaColumns(
          [row],
          columns.filter(col => col.key !== dto.columnKey),
        );
        sample = evaluateFormula(expression, toRowDataRecord(row.data));
      }
    }
    return {
      valid: true,
      error: null,
      expression,
      resultType: config.resultType as FormulaResultType,
      sample,
    };
  }

  async addColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: CreateCustomTableColumnBody,
  ): Promise<CustomTableColumn> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);

    const type = toEnum(CustomTableColumnType, dto.type);
    validateNumberConfig(type ?? undefined, dto.config);
    validateSelectConfig(type ?? undefined, dto.config);
    await this.validateFormulaConfig(tableId, type ?? undefined, dto.config, null, dto.title);
    await this.validateRelationConfig(workspaceId, type ?? undefined, dto.config);

    const position = dto.position ?? (await this.getNextColumnPosition(tableId));
    const column = this.customTableColumnRepository.create({
      tableId,
      key: generateColumnKey(),
      title: dto.title,
      type: type ?? CustomTableColumnType.TEXT,
      isRequired: dto.isRequired ?? false,
      isUnique: dto.isUnique ?? false,
      position,
      config: dto.config ?? null,
    });

    let saved: CustomTableColumn;
    try {
      saved = await this.customTableColumnRepository.save(column);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: saved },
      meta: {
        tableId,
        key: saved.key,
      },
    });
    const selfRef = `[${dto.title.trim()}]`;
    if (
      saved.type === CustomTableColumnType.FORMULA &&
      typeof saved.config?.expression === 'string' &&
      saved.config.expression.includes(selfRef)
    ) {
      // Теперь ключ известен: ссылка по названию становится ссылкой по ключу.
      saved.config = {
        ...saved.config,
        expression: saved.config.expression.split(selfRef).join(`[${saved.key}]`),
      };
      try {
        saved = await this.customTableColumnRepository.save(saved);
      } catch (error) {
        throwHelpfulSchemaError(error);
      }
    }
    if (saved.type === CustomTableColumnType.FORMULA) {
      await this.recalcAfterWrite(tableId, workspaceId);
    }
    return saved;
  }

  async updateColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    columnId: string,
    dto: UpdateCustomTableColumnBody,
  ): Promise<CustomTableColumn> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    if (!isUuid(columnId)) {
      throw new BadRequestException(appError('COLUMN_ID_INVALID'));
    }
    let column: CustomTableColumn | null = null;
    try {
      column = await this.customTableColumnRepository.findOne({
        where: { id: columnId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!column) {
      throw new NotFoundException(appError('COLUMN_NOT_FOUND'));
    }

    const before = { ...column };
    if (dto.title != null) {
      column.title = dto.title;
    }
    if (dto.type != null) {
      column.type = toEnum(CustomTableColumnType, dto.type);
    }
    if (dto.isRequired != null) {
      column.isRequired = dto.isRequired;
    }
    if (dto.isUnique != null) {
      column.isUnique = dto.isUnique;
    }
    if (dto.position != null) {
      column.position = dto.position;
    }
    if (dto.config !== undefined) {
      const previousSource = columnSourceConfig(column.config);
      column.config = dto.config ?? null;
      // Clients rebuild config from their draft and know nothing about the
      // source link; dropping it would silently stop refreshes for this column.
      if (previousSource && !columnSourceConfig(column.config)) {
        column.config = { ...(column.config ?? {}), source: previousSource };
      }
    }

    validateNumberConfig(column.type, column.config);
    validateSelectConfig(column.type, column.config);
    await this.validateFormulaConfig(tableId, column.type, column.config, column.key);
    await this.validateRelationConfig(workspaceId, column.type, column.config);

    let saved: CustomTableColumn;
    try {
      saved = await this.customTableColumnRepository.save(column);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      entityId: columnId,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { tableId },
    });
    await this.recalcAfterWrite(tableId, workspaceId);
    return saved;
  }

  /**
   * Оформление колонки (заголовок/ячейки) живёт отдельной строкой в
   * custom_table_column_styles. Часть, которой нет в dto, не трогаем; null
   * сбрасывает её; пустой результат удаляет строку целиком.
   */
  async updateColumnStyle(
    userId: string,
    workspaceId: string,
    tableId: string,
    columnId: string,
    dto: UpdateCustomTableColumnStyleBody,
  ): Promise<{ columnKey: string; style: JsonObject }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    if (!isUuid(columnId)) {
      throw new BadRequestException(appError('COLUMN_ID_INVALID'));
    }
    let column: CustomTableColumn | null = null;
    try {
      column = await this.customTableColumnRepository.findOne({
        where: { id: columnId, tableId },
        select: {
          id: true,
          key: true,
        },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!column) {
      throw new NotFoundException(appError('COLUMN_NOT_FOUND'));
    }
    const columnKey = column.key;

    let existing: CustomTableColumnStyle | null = null;
    try {
      existing = await this.customTableColumnStyleRepository.findOne({
        where: { tableId, columnKey },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const before = existing?.style ?? null;
    const next = mergeColumnStyle(before, dto);
    const hasStyle = Object.keys(next).length > 0;

    try {
      if (!hasStyle) {
        if (existing) {
          await this.customTableColumnStyleRepository.delete({ id: existing.id });
        }
      } else if (existing) {
        existing.style = next;
        await this.customTableColumnStyleRepository.save(existing);
      } else {
        await this.customTableColumnStyleRepository.save(
          this.customTableColumnStyleRepository.create({ tableId, columnKey, style: next }),
        );
      }
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      entityId: columnId,
      action: AuditAction.UPDATE,
      diff: { before, after: hasStyle ? next : null },
      meta: { tableId, columnKey, columnStyle: true },
    });
    return { columnKey, style: hasStyle ? next : {} };
  }

  async reorderColumns(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: ReorderCustomTableColumnsBody,
  ): Promise<void> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    const invalidId = dto.columnIds.find(id => !isUuid(id));
    if (invalidId) {
      throw new BadRequestException(appError('COLUMN_ID_INVALID'));
    }
    let columns: CustomTableColumn[] = [];
    try {
      columns = await this.customTableColumnRepository.find({
        where: { tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    const beforePositions = new Map(columns.map(col => [col.id, col.position ?? 0]));
    const existingIds = new Set(columns.map(c => c.id));
    for (const id of dto.columnIds) {
      if (!existingIds.has(id)) {
        throw new NotFoundException(appError('COLUMN_SOME_NOT_FOUND'));
      }
    }

    const updates = dto.columnIds.map((id, idx) => ({
      id,
      tableId,
      position: idx,
    }));
    try {
      await this.customTableColumnRepository.save(updates);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    try {
      await this.auditService.createBatchEvents(
        dto.columnIds.map((id, idx) => ({
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.CUSTOM_TABLE_COLUMN,
          entityId: id,
          action: AuditAction.UPDATE,
          diff: {
            before: { position: beforePositions.get(id) ?? null },
            after: { position: idx },
          },
          meta: { tableId, reorder: true },
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Audit event write failed for column reorder: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async removeColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    columnId: string,
  ): Promise<void> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    if (!isUuid(columnId)) {
      throw new BadRequestException(appError('COLUMN_ID_INVALID'));
    }
    let column: CustomTableColumn | null = null;
    try {
      column = await this.customTableColumnRepository.findOne({
        where: { id: columnId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!column) {
      throw new NotFoundException(appError('COLUMN_NOT_FOUND'));
    }
    try {
      await this.customTableColumnRepository.delete({ id: columnId, tableId });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      entityId: columnId,
      action: AuditAction.DELETE,
      diff: { before: column, after: null },
      meta: { tableId, key: column.key },
      isUndoable: true,
    });
    await this.recalcAfterWrite(tableId, workspaceId);
  }

  /**
   * Сводки под таблицей: формулы над итогами колонок, например
   * SUM([income]) - SUM([expense]). Хранятся в viewSettings, считаются при чтении.
   */
  async updateViewSettingsSummaries(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableSummariesBody,
  ): Promise<CustomTable> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    const columns = await this.customTableColumnRepository.find({
      where: { tableId },
      select: {
        key: true,
        title: true,
        type: true,
        config: true,
      },
    });
    const keys = columns.map(col => col.key);
    const summaries = dto.summaries.map(item => {
      const expression = resolveFormulaTitles(item.expression.trim(), columns);
      try {
        assertValidFormula(expression, keys);
      } catch (error) {
        throw new BadRequestException(appError(...FormulaError.argsOf(error)));
      }
      return { id: item.id?.trim() || randomUUID(), title: item.title.trim(), expression };
    });
    const before = { ...table };
    table.viewSettings = { ...getViewSettingsObject(table), summaries };
    let saved: CustomTable;
    try {
      saved = await this.customTableRepository.save(table);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { viewSettings: true, summaries: summaries.length },
    });
    return this.getTable(workspaceId, tableId);
  }

  async getSummaries(
    workspaceId: string,
    tableId: string,
  ): Promise<{
    items: Array<{
      id: string;
      title: string;
      expression: string;
      resultType: FormulaResultType;
      value: FormulaValue;
      error: string | null;
    }>;
  }> {
    const table = await this.requireTable(workspaceId, tableId);
    const summaries = readSummaries(table);
    if (!summaries.length) {
      return { items: [] };
    }
    const columns = await this.customTableColumnRepository.find({ where: { tableId } });
    const fieldTypes = Object.fromEntries(
      columns.map(col => [col.key, formulaTypeOfColumn(col)]),
    ) as Record<string, FormulaResultType>;
    const context = this.formulaRecalc
      ? (await this.formulaRecalc.buildEvaluator(tableId, columns)).evaluator.summaryContext()
      : undefined;
    return {
      items: summaries.map(summary => {
        const { value, error } = context
          ? evaluateFormulaDetailed(summary.expression, {}, context)
          : { value: null, error: null };
        let resultType: FormulaResultType = 'number';
        try {
          resultType = inferFormulaResultType(summary.expression, fieldTypes);
        } catch {
          resultType = 'number';
        }
        return { ...summary, resultType, value, error };
      }),
    };
  }

  /** После записи: пересчитать формулы и отдать строкам свежие значения из computed. */
  private async recalcAfterWrite(
    tableId: string,
    workspaceId: string,
    rows: CustomTableRow[] = [],
  ): Promise<void> {
    if (!this.formulaRecalc) {
      return;
    }
    const mode = await this.formulaRecalc.scheduleRecalc(tableId, workspaceId);
    if (mode !== 'sync' || !rows.length) {
      return;
    }
    const fresh = await this.customTableRowRepository.find({
      where: { id: In(rows.map(row => row.id)) },
      select: {
        id: true,
        computed: true,
      },
    });
    const byId = new Map(fresh.map(row => [row.id, row.computed]));
    for (const row of rows) {
      row.computed = byId.get(row.id) ?? row.computed;
    }
  }

  /**
   * Подписи связанных строк. Как и формулы, считаются при выдаче и не
   * хранятся: иначе переименование строки-цели оставило бы всюду устаревший
   * текст. В data[key] лежит идентификатор строки, подпись едет отдельно.
   */
  private async applyRelationLabels(
    rows: CustomTableRow[],
    columns: CustomTableColumn[],
  ): Promise<void> {
    const relationColumns = columns.filter(
      col =>
        col.type === CustomTableColumnType.RELATION &&
        typeof col.config?.targetTableId === 'string',
    );
    if (!(relationColumns.length && rows.length)) {
      return;
    }

    for (const col of relationColumns) {
      const targetTableId = col.config?.targetTableId as string;
      const displayKey = col.config?.displayColumnKey as string | undefined;

      const ids = Array.from(
        new Set(
          rows
            .map(row => (row.data as Record<string, unknown>)?.[col.key])
            .filter((v): v is string => typeof v === 'string' && isUuid(v)),
        ),
      );
      if (!ids.length) {
        continue;
      }

      const targetRows = await this.customTableRowRepository.find({
        where: { id: In(ids), tableId: targetTableId },
        select: {
          id: true,
          rowNumber: true,
          data: true,
        },
      });
      const labelById = new Map(
        targetRows.map(target => {
          const raw = displayKey
            ? (target.data as Record<string, unknown>)?.[displayKey]
            : undefined;
          const label =
            raw === null || raw === undefined || String(raw).trim() === ''
              ? `#${target.rowNumber}`
              : String(raw);
          return [target.id, label];
        }),
      );

      for (const row of rows) {
        const value = (row.data as Record<string, unknown>)?.[col.key];
        if (typeof value !== 'string') {
          continue;
        }
        const labels =
          (row as CustomTableRow & { relationLabels?: Record<string, string> }).relationLabels ??
          {};
        // Ссылка на удалённую строку остаётся видимой как «висячая».
        labels[col.key] = labelById.get(value) ?? '—';
        (row as CustomTableRow & { relationLabels?: Record<string, string> }).relationLabels =
          labels;
      }
    }
  }

  /** Проверка настроек связи: цель обязана быть в том же воркспейсе. */
  private async validateRelationConfig(
    workspaceId: string,
    type: CustomTableColumnType | undefined,
    config: Record<string, unknown> | null | undefined,
  ): Promise<void> {
    if (type !== CustomTableColumnType.RELATION) {
      return;
    }
    const targetTableId = config?.targetTableId;
    if (typeof targetTableId !== 'string' || !isUuid(targetTableId)) {
      throw new BadRequestException(appError('COLUMN_RELATION_TARGET_REQUIRED'));
    }
    // requireTable проверяет принадлежность воркспейсу — это и есть защита
    // от ссылки на чужие данные.
    await this.requireTable(workspaceId, targetTableId);

    const displayColumnKey = config?.displayColumnKey;
    if (displayColumnKey !== undefined && displayColumnKey !== null) {
      if (typeof displayColumnKey !== 'string') {
        throw new BadRequestException(appError('COLUMN_DISPLAY_INVALID'));
      }
      const targetColumns = await this.loadColumnTypeMap(targetTableId);
      if (!targetColumns.has(displayColumnKey)) {
        throw new BadRequestException(
          appError('COLUMN_DISPLAY_NOT_FOUND', { column: displayColumnKey }),
        );
      }
    }
  }

  /** Варианты для выбора связанной строки. */
  async listRelationOptions(
    workspaceId: string,
    tableId: string,
    columnKey: string,
    search?: string,
  ): Promise<{ items: Array<{ id: string; label: string }> }> {
    await this.requireTable(workspaceId, tableId);
    const column = await this.customTableColumnRepository.findOne({
      where: { tableId, key: columnKey },
    });
    if (!column || column.type !== CustomTableColumnType.RELATION) {
      throw new BadRequestException(appError('COLUMN_NOT_RELATION'));
    }
    const targetTableId = column.config?.targetTableId as string | undefined;
    if (!targetTableId) {
      throw new BadRequestException(appError('COLUMN_RELATION_TARGET_MISSING'));
    }
    await this.requireTable(workspaceId, targetTableId);

    const displayKey = column.config?.displayColumnKey as string | undefined;
    const query = this.customTableRowRepository
      .createQueryBuilder('r')
      .where('r.tableId = :targetTableId', { targetTableId })
      .orderBy('r.rowNumber', 'ASC')
      .take(200);
    if (search?.trim()) {
      query.andWhere('r.data::text ILIKE :search', { search: `%${search.trim()}%` });
    }
    const rows = await query.getMany();

    return {
      items: rows.map(row => {
        const raw = displayKey ? (row.data as Record<string, unknown>)?.[displayKey] : undefined;
        const label =
          raw === null || raw === undefined || String(raw).trim() === ''
            ? `#${row.rowNumber}`
            : String(raw);
        return { id: row.id, label };
      }),
    };
  }

  private async loadColumnsWithConfig(tableId: string): Promise<CustomTableColumn[]> {
    return this.customTableColumnRepository.find({
      where: { tableId },
      order: { position: 'ASC' },
    });
  }

  private async loadColumnTypeMap(tableId: string): Promise<Map<string, CustomTableColumnType>> {
    const columns = await this.customTableColumnRepository.find({
      where: { tableId },
      select: {
        key: true,
        type: true,
        config: true,
      },
    });
    return new Map<string, CustomTableColumnType>(columns.map(c => [c.key, storageTypeOf(c)]));
  }

  /**
   * Базовый запрос строк с фильтрами и сортировкой, но без пагинации.
   * Общий для выдачи строк и экспорта, чтобы выгрузка совпадала с тем,
   * что пользователь видит на экране.
   */
  private async buildRowsQuery(
    tableId: string,
    params: { filters?: CustomTableRowFilterDto[]; sort?: CustomTableRowSortDto },
  ): Promise<SelectQueryBuilder<CustomTableRow>> {
    const query = this.customTableRowRepository
      .createQueryBuilder('r')
      .where('r.tableId = :tableId', { tableId })
      .orderBy('r.rowNumber', 'ASC')
      .addOrderBy('r.id', 'ASC');

    const rawFilters = params.filters?.filter(Boolean) || [];
    const typeByKey =
      rawFilters.length || params.sort
        ? await this.loadColumnTypeMap(tableId)
        : new Map<string, CustomTableColumnType>();

    applyRowFilters(query, rawFilters, typeByKey);
    if (params.sort) {
      applyRowSort(query, params.sort, typeByKey);
    }
    return query;
  }

  /**
   * Значение ячейки для выгрузки. Числа и булевы отдаём нативными типами,
   * чтобы в Excel они оставались числом и флагом, а не текстом.
   */
  /**
   * Итоги футера уходят в файл живыми формулами (SUM/AVERAGE… по колонке), а
   * сводки — строками «название · значение»: выгрузка остаётся таблицей, а не снимком.
   */
  private async appendExportTotals(
    worksheet: xlsx.WorkSheet,
    table: CustomTable,
    columns: CustomTableColumn[],
    rowCount: number,
  ): Promise<void> {
    const viewColumns = getViewSettingsColumns(getViewSettingsObject(table));
    const summaries = readSummaries(table);
    const FN: Record<string, string> = {
      sum: 'SUM',
      avg: 'AVERAGE',
      min: 'MIN',
      max: 'MAX',
      count: 'COUNTA',
    };
    let lastRow = rowCount + 1; // 1-based: header is row 1, data rows 2..rowCount+1
    let wroteTotals = false;
    if (rowCount) {
      const evaluator = this.formulaRecalc
        ? (await this.formulaRecalc.buildEvaluator(table.id, columns)).evaluator
        : null;
      columns.forEach((col, index) => {
        const aggregate = viewColumns[col.key]?.aggregate;
        const fn = aggregate ? FN[aggregate] : undefined;
        if (!(aggregate && fn)) {
          return;
        }
        const letter = xlsx.utils.encode_col(index);
        const value = evaluator
          ? evaluator.aggregate(aggregate === 'count' ? 'counta' : aggregate, col.key)
          : null;
        worksheet[`${letter}${rowCount + 2}`] = {
          t: 'n',
          f: `${fn}(${letter}2:${letter}${rowCount + 1})`,
          ...(typeof value === 'number' ? { v: value } : {}),
        };
        wroteTotals = true;
      });
      if (wroteTotals) {
        lastRow = rowCount + 2;
      }
    }
    if (summaries.length) {
      const computed = await this.getSummaries(table.workspaceId, table.id);
      for (const item of computed.items) {
        lastRow += 1;
        // Summary titles are editor input, like column titles.
        worksheet[`A${lastRow}`] = { t: 's', v: neutralizeSpreadsheetFormulaCell(item.title) };
        worksheet[`B${lastRow}`] =
          typeof item.value === 'number'
            ? { t: 'n', v: item.value }
            : {
                t: 's',
                v: neutralizeSpreadsheetFormulaCell(item.value === null ? '' : String(item.value)),
              };
      }
    }
    if (lastRow > rowCount + 1) {
      worksheet['!ref'] = xlsx.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: lastRow - 1, c: Math.max(columns.length - 1, 1) },
      });
    }
  }

  /**
   * Поиск дублей по составному ключу. Строки в таблицы попадают из разных
   * выписок, поэтому повторы неизбежны и ищутся не по точному совпадению
   * строки целиком, а по выбранным колонкам с нормализацией.
   */
  async findDuplicateRows(
    workspaceId: string,
    tableId: string,
    params: { keys: string[]; limit?: number },
  ): Promise<{
    items: Array<{ key: string; count: number; rowIds: string[]; rowNumbers: number[] }>;
    groupCount: number;
  }> {
    await this.requireTable(workspaceId, tableId);

    const keys = Array.from(new Set((params.keys ?? []).map(k => k.trim()).filter(Boolean)));
    if (!keys.length) {
      throw new BadRequestException(appError('DUPLICATE_KEY_COLUMNS_REQUIRED'));
    }
    if (keys.length > 10) {
      throw new BadRequestException(appError('DUPLICATE_KEY_TOO_MANY_COLUMNS'));
    }

    const typeByKey = await this.loadColumnTypeMap(tableId);
    for (const key of keys) {
      if (!typeByKey.has(key)) {
        throw new BadRequestException(appError('COLUMN_NOT_FOUND_NAMED', { column: String(key) }));
      }
    }

    const query = this.customTableRowRepository
      .createQueryBuilder('r')
      .where('r.tableId = :tableId', { tableId });

    // Регистр и лишние пробелы не должны мешать: «Магнум » и «магнум» — одно.
    const parts = keys.map((key, index) => {
      const param = `d_col_${index}`;
      query.setParameter(param, key);
      return `lower(trim(COALESCE(r.data ->> :${param}, '')))`;
    });
    // Разделитель — управляющий символ: в данных его не бывает, поэтому
    // склейка «аб|в» и «а|бв» не даст ложного совпадения.
    const keyExpr = parts.join(' || chr(31) || ');

    const safeLimit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    const rows = await query
      .select([
        `${keyExpr} AS "dup_key"`,
        'COUNT(*) AS "dup_count"',
        'array_agg(r.id::text) AS "row_ids"',
        'array_agg(r.rowNumber) AS "row_numbers"',
      ])
      .groupBy(keyExpr)
      // Полностью пустой ключ — не дубль, а просто незаполненные строки.
      .having(`COUNT(*) > 1 AND ${keyExpr} <> ${keys.map(() => "''").join(' || chr(31) || ')}`)
      .orderBy('COUNT(*)', 'DESC')
      .limit(safeLimit)
      .getRawMany<Record<string, unknown>>();

    const items = rows.map(row => ({
      key: String(row.dup_key ?? '')
        .split('')
        .join(' · '),
      count: Number(row.dup_count) || 0,
      rowIds: Array.isArray(row.row_ids) ? (row.row_ids as string[]) : [],
      rowNumbers: Array.isArray(row.row_numbers)
        ? (row.row_numbers as unknown[]).map(n => Number(n))
        : [],
    }));

    return { items, groupCount: items.length };
  }

  /**
   * Итоги по колонкам. Считает база по всем строкам выборки — грид держит
   * в памяти лишь окно из 50 строк, и складывать надо не его.
   */
  async aggregateRows(
    workspaceId: string,
    tableId: string,
    params: { filters?: CustomTableRowFilterDto[]; aggs: CustomTableAggregateDto[] },
  ): Promise<{ items: CustomTableAggregateResult[]; total: number }> {
    await this.requireTable(workspaceId, tableId);

    const aggs = params.aggs?.filter(Boolean) ?? [];
    if (!aggs.length) {
      return { items: [], total: 0 };
    }
    if (aggs.length > 50) {
      throw new BadRequestException(appError('AGG_TOO_MANY'));
    }

    const typeByKey = await this.loadColumnTypeMap(tableId);
    const query = await this.buildRowsQuery(tableId, { filters: params.filters });
    const total = await query.getCount();

    // ORDER BY из базового запроса несовместим с агрегацией без GROUP BY.
    query.orderBy();

    const selections = buildAggregateSelections(query, aggs, typeByKey);

    const raw = await query.select(selections).getRawOne<Record<string, unknown>>();

    const items = aggs.map((agg, index) => ({
      col: agg.col,
      fn: agg.fn,
      value: normalizeAggregateValue(raw?.[`agg_${index}`]),
    }));

    return { items, total };
  }

  /**
   * Группировка с итогами по каждой группе. Считает база: собрать группы
   * из подгруженного окна строк нельзя — они охватывают всю выборку.
   */
  async groupRows(
    workspaceId: string,
    tableId: string,
    params: {
      groupBy: string;
      filters?: CustomTableRowFilterDto[];
      aggs?: CustomTableAggregateDto[];
      limit?: number;
    },
  ): Promise<{
    items: Array<{
      key: string | null;
      count: number;
      aggregates: CustomTableAggregateResult[];
    }>;
    groupCount: number;
  }> {
    await this.requireTable(workspaceId, tableId);

    const groupBy = params.groupBy?.trim();
    if (!groupBy) {
      throw new BadRequestException(appError('GROUP_COLUMN_REQUIRED'));
    }

    const typeByKey = await this.loadColumnTypeMap(tableId);
    if (!typeByKey.has(groupBy)) {
      throw new BadRequestException(
        appError('GROUP_COLUMN_NOT_FOUND', { column: String(groupBy) }),
      );
    }

    const aggs = params.aggs?.filter(Boolean) ?? [];
    if (aggs.length > 50) {
      throw new BadRequestException(appError('AGG_TOO_MANY'));
    }

    const query = await this.buildRowsQuery(tableId, { filters: params.filters });
    // Порядок строк из базового запроса к группам отношения не имеет.
    query.orderBy();

    const groupExpr = buildTypedValueExprs('g_col').textExpr;
    query.setParameter('g_col', groupBy);

    const selections = [
      `${groupExpr} AS "group_key"`,
      'COUNT(*) AS "group_count"',
      ...buildAggregateSelections(query, aggs, typeByKey),
    ];

    const safeLimit = Math.min(Math.max(params.limit ?? 200, 1), 1000);
    const rows = await query
      .select(selections)
      .groupBy(groupExpr)
      // Крупные группы первыми: с них обычно и начинают разбираться.
      .orderBy('COUNT(*)', 'DESC')
      .limit(safeLimit)
      .getRawMany<Record<string, unknown>>();

    const items = rows.map(row => ({
      key: row.group_key === null || row.group_key === undefined ? null : String(row.group_key),
      count: Number(row.group_count) || 0,
      aggregates: aggs.map((agg, index) => ({
        col: agg.col,
        fn: agg.fn,
        value: normalizeAggregateValue(row[`agg_${index}`]),
      })),
    }));

    return { items, groupCount: items.length };
  }

  async exportRows(
    workspaceId: string,
    tableId: string,
    params: {
      format: 'csv' | 'xlsx';
      filters?: CustomTableRowFilterDto[];
      sort?: CustomTableRowSortDto;
      columnKeys?: string[];
    },
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const table = await this.requireTable(workspaceId, tableId);

    const allColumns = await this.customTableColumnRepository.find({
      where: { tableId },
      order: { position: 'ASC' },
    });
    // Порядок и состав колонок задаёт текущий вид: выгружаем то, что видно.
    const columns = params.columnKeys?.length
      ? params.columnKeys
          .map(key => allColumns.find(c => c.key === key))
          .filter((c): c is CustomTableColumn => Boolean(c))
      : allColumns;

    if (!columns.length) {
      throw new BadRequestException(appError('EXPORT_NO_COLUMNS'));
    }

    const query = await this.buildRowsQuery(tableId, params);
    const total = await query.getCount();
    if (total > CustomTablesService.MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        appError('EXPORT_TOO_MANY_ROWS', {
          total,
          max: CustomTablesService.MAX_EXPORT_ROWS,
        }),
      );
    }

    // Тянем страницами, чтобы не поднимать всю таблицу в память одним запросом.
    const records: Record<string, unknown>[] = [];
    const batchSize = 500;
    for (let offset = 0; offset < total; offset += batchSize) {
      const batch = await query.clone().skip(offset).take(batchSize).getMany();
      if (!batch.length) {
        break;
      }
      // Формулы и подписи связей считаем и для выгрузки: иначе колонки
      // уехали бы в файл пустыми или с идентификаторами вместо названий.
      applyFormulaColumns(batch, allColumns);
      await this.applyRelationLabels(batch, allColumns);
      for (const row of batch) {
        const record: Record<string, unknown> = {};
        const labels = (row as CustomTableRow & { relationLabels?: Record<string, string> })
          .relationLabels;
        for (const col of columns) {
          const header = exportHeader(col);
          // В выгрузку идёт подпись связанной строки: идентификатор в отчёте
          // человеку ничего не говорит.
          record[header] =
            col.type === CustomTableColumnType.RELATION
              ? (labels?.[col.key] ?? '')
              : exportCellValue(row.data?.[col.key], col.type);
        }
        records.push(record);
      }
    }

    const headers = columns.map(col => exportHeader(col));
    const worksheet = xlsx.utils.json_to_sheet(records, { header: headers });
    await this.appendExportTotals(worksheet, table, columns, records.length);

    if (params.format === 'csv') {
      const csv = xlsx.utils.sheet_to_csv(worksheet);
      return {
        // BOM — иначе Excel открывает кириллицу в CSV как мусор.
        buffer: Buffer.from(`﻿${csv}`, 'utf-8'),
        fileName: normalizeFilename(`${table.name}.csv`),
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Export');
    return {
      buffer: xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
      fileName: normalizeFilename(`${table.name}.xlsx`),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async listRows(
    workspaceId: string,
    tableId: string,
    params: {
      cursor?: number;
      offset?: number;
      limit: number;
      filters?: CustomTableRowFilterDto[];
      sort?: CustomTableRowSortDto;
    },
  ): Promise<{ items: CustomTableRow[]; total: number }> {
    await this.requireTable(workspaceId, tableId);

    const query = await this.buildRowsQuery(tableId, params);
    query.take(params.limit);

    const total = await query.getCount();

    if (params.sort) {
      // Keyset-курсор по rowNumber верен только при сортировке по rowNumber.
      // При произвольной сортировке страницы нарезаются смещением.
      query.skip(params.offset ?? 0);
    } else if (params.cursor !== undefined) {
      query.andWhere('r.rowNumber > :cursor', { cursor: params.cursor });
    }

    try {
      const rows = await query.getMany();
      if (!rows.length) {
        return { items: [], total };
      }

      try {
        const rowIds = rows.map(r => r.id);
        const styles = await this.customTableCellStyleRepository.find({
          where: { rowId: In(rowIds) },
          select: {
            rowId: true,
            columnKey: true,
            style: true,
          },
        });
        mergeRowStyles(rows, styles);
      } catch (_error) {
        this.logger.warn(`Failed to load cell styles for tableId=${tableId}`);
      }

      const tableColumns = await this.loadColumnsWithConfig(tableId);
      applyFormulaColumns(rows, tableColumns);
      await this.applyRelationLabels(rows, tableColumns);

      return { items: rows, total };
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
  }

  async classifyPaidStatus(
    workspaceId: string,
    tableId: string,
    dto: ClassifyPaidStatusBody,
  ): Promise<{ items: Array<{ rowId: string; paid: boolean | null }> }> {
    await this.requireTable(workspaceId, tableId);
    const rowIds = Array.isArray(dto.rowIds) ? dto.rowIds.filter(Boolean) : [];
    const uniqueRowIds = Array.from(new Set(rowIds));
    if (!uniqueRowIds.length) {
      return { items: [] };
    }
    const validRowIds = uniqueRowIds.filter(rowId => isUuid(rowId));
    if (!validRowIds.length) {
      return {
        items: uniqueRowIds.map(rowId => ({ rowId, paid: null })),
      };
    }

    let rows: CustomTableRow[] = [];
    let columns: CustomTableColumn[] = [];
    try {
      rows = await this.customTableRowRepository.find({
        where: { tableId, id: In(validRowIds) },
        select: {
          id: true,
          data: true,
        },
      });
      columns = await this.customTableColumnRepository.find({
        where: { tableId },
        select: {
          key: true,
          title: true,
        },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }

    const { commentKeys, counterpartyKeys } = getPaidStatusFieldKeys(columns);
    const inputs: PaidStatusInput[] = rows.map(row => {
      const data = row.data || {};
      let comment = collectRowText(data, commentKeys);
      const counterparty = collectRowText(data, counterpartyKeys);
      if (!(comment || counterparty)) {
        const fallbackKeys = Object.keys(data);
        comment = collectRowText(data, fallbackKeys);
      }
      return {
        id: row.id,
        comment: comment || null,
        counterparty: counterparty || null,
      };
    });

    const byId = new Map<string, boolean | null>(
      inputs.map(input => [input.id, detectPaidStatus(input)]),
    );
    const items = uniqueRowIds.map(rowId => ({
      rowId,
      paid: byId.has(rowId) ? (byId.get(rowId) as boolean | null) : null,
    }));
    return { items };
  }

  /**
   * Проверка флагов колонки на границе записи. До этого isRequired и isUnique
   * только хранились: обязательную колонку можно было оставить пустой, а в
   * уникальную положить дубль.
   *
   * @param rows строки одной операции — в пакетной вставке дубли внутри
   *   самого пакета иначе прошли бы мимо проверки по базе.
   */
  private async validateRowsAgainstColumns(
    tableId: string,
    rows: Array<Record<string, unknown>>,
    options: { excludeRowId?: string; partial?: boolean } = {},
  ): Promise<void> {
    const columns = await this.customTableColumnRepository.find({
      where: { tableId },
      select: {
        key: true,
        title: true,
        isRequired: true,
        isUnique: true,
        type: true,
      },
    });
    const guarded = columns.filter(col => col.isRequired || col.isUnique);
    if (!guarded.length) {
      return;
    }

    const seenInBatch = new Map<string, Set<string>>();

    for (const data of rows) {
      for (const col of guarded) {
        const present = Object.hasOwn(data, col.key);
        const value = data[col.key];

        // При частичном обновлении отсутствующий ключ означает «не меняем».
        if (col.isRequired && (present || !options.partial) && isBlankCellValue(value)) {
          throw new BadRequestException(
            appError('COLUMN_REQUIRED_VALUE', { column: String(col.title) }),
          );
        }

        if (!(col.isUnique && present) || isBlankCellValue(value)) {
          continue;
        }

        const text = String(value).trim();
        const batchSeen = seenInBatch.get(col.key) ?? new Set<string>();
        if (batchSeen.has(text)) {
          throw new BadRequestException(
            appError('VALUE_DUPLICATE_IN_BATCH', { value: text, column: String(col.title) }),
          );
        }
        batchSeen.add(text);
        seenInBatch.set(col.key, batchSeen);

        const duplicateQuery = this.customTableRowRepository
          .createQueryBuilder('r')
          .where('r.tableId = :tableId', { tableId })
          .andWhere('r.data ->> :col = :value', { col: col.key, value: text });
        if (options.excludeRowId) {
          duplicateQuery.andWhere('r.id <> :rowId', { rowId: options.excludeRowId });
        }
        if (await duplicateQuery.getExists()) {
          throw new BadRequestException(
            appError('VALUE_DUPLICATE_IN_TABLE', { value: text, column: String(col.title) }),
          );
        }
      }
    }
  }

  async createRow(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: CreateCustomTableRowBody,
  ): Promise<CustomTableRow> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    const allowedKeys = await this.getAllowedColumnKeys(tableId);
    const data = sanitizeRowData(dto.data, allowedKeys);
    await this.validateRowsAgainstColumns(tableId, [data]);
    const rowNumber = dto.rowNumber ?? (await this.getNextRowNumber(tableId));

    const row = this.customTableRowRepository.create({
      tableId,
      rowNumber,
      data,
      styles: dto.styles ?? {},
    });
    let saved: CustomTableRow;
    try {
      saved = await this.customTableRowRepository.save(row);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.TABLE_ROW,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: saved },
      meta: { tableId, rowNumber: saved.rowNumber },
    });
    // В ответе — уже посчитанные формулы: грид обновляет строку из ответа,
    // не перечитывая таблицу, и без этого формульные ячейки отставали бы.
    await this.recalcAfterWrite(tableId, workspaceId, [saved]);
    applyFormulaColumns(
      [saved],
      await this.customTableColumnRepository.find({ where: { tableId } }),
    );
    return saved;
  }

  async updateRow(
    userId: string,
    workspaceId: string,
    tableId: string,
    rowId: string,
    dto: UpdateCustomTableRowBody,
  ): Promise<CustomTableRow> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    if (!isUuid(rowId)) {
      throw new BadRequestException(appError('ROW_ID_INVALID'));
    }
    let row: CustomTableRow | null = null;
    try {
      row = await this.customTableRowRepository.findOne({
        where: { id: rowId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!row) {
      throw new NotFoundException(appError('ROW_NOT_FOUND'));
    }

    const allowedKeys = await this.getAllowedColumnKeys(tableId);
    let patch = sanitizeRowData(dto.data, allowedKeys);
    const writeBack = await this.writeBackAppFields(userId, workspaceId, table, row, patch);
    if (writeBack) {
      // The row shows the app record: its app cells take what the app now holds,
      // also when the app refused — then nothing else of this edit is saved.
      patch = writeBack.error ? writeBack.values : { ...patch, ...writeBack.values };
    }
    if (!writeBack?.error) {
      await this.validateRowsAgainstColumns(tableId, [patch], {
        excludeRowId: rowId,
        partial: true,
      });
    }
    const beforeData = { ...(row.data || {}) };
    const beforeStyles = row.styles ? { ...row.styles } : null;
    row.data = { ...(row.data || {}), ...patch };
    if (dto.styles && typeof dto.styles === 'object' && !writeBack?.error) {
      row.styles = { ...(row.styles || {}), ...dto.styles };
    }

    if (writeBack?.error) {
      try {
        await this.customTableRowRepository.save(row);
      } catch (error) {
        throwHelpfulSchemaError(error);
      }
      throw writeBack.error;
    }

    let saved: CustomTableRow;
    try {
      saved = await this.customTableRowRepository.save(row);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    const patchKeys = Object.keys(patch || {}).filter(
      key => !sameCellValue(beforeData?.[key] ?? null, (patch[key] ?? null) as SourceValue),
    );
    const batchId = patchKeys.length > 1 ? randomUUID() : null;

    for (const key of patchKeys) {
      const beforeValue = beforeData?.[key] ?? null;
      const afterValue = toRowDataRecord(saved.data)[key] ?? null;
      await this.logEvent({
        userId,
        workspaceId,
        entityType: EntityType.TABLE_CELL,
        entityId: rowId,
        action: AuditAction.UPDATE,
        diff: {
          before: { value: beforeValue },
          after: { value: afterValue },
        },
        meta: {
          tableId,
          cell: { column: key },
        },
        batchId,
        // Undo of an app cell would rewrite the table and leave the record as it
        // is; the record's own event is the one to undo.
        ...(writeBack && key in writeBack.values ? { isUndoable: false } : {}),
      });
    }

    if (dto.styles && typeof dto.styles === 'object') {
      await this.logEvent({
        userId,
        workspaceId,
        entityType: EntityType.TABLE_ROW,
        entityId: rowId,
        action: AuditAction.UPDATE,
        diff: {
          before: { styles: beforeStyles },
          after: { styles: saved.styles },
        },
        meta: {
          tableId,
          stylesUpdated: true,
        },
      });
    }
    // В ответе — уже посчитанные формулы: грид обновляет строку из ответа,
    // не перечитывая таблицу, и без этого формульные ячейки отставали бы.
    await this.recalcAfterWrite(tableId, workspaceId, [saved]);
    applyFormulaColumns(
      [saved],
      await this.customTableColumnRepository.find({ where: { tableId } }),
    );
    return saved;
  }

  /**
   * Sends the patch's cells that show an app record (source columns of a table
   * filled from app data, on a row that came from a record) to that record.
   * Returns the record's values for every source column of the row, keyed by
   * column, and the app's refusal if there was one; null when nothing applies.
   */
  private async writeBackAppFields(
    userId: string,
    workspaceId: string,
    table: CustomTable,
    row: CustomTableRow,
    patch: Record<string, unknown>,
  ): Promise<{ values: Record<string, unknown>; error: unknown | null } | null> {
    if (!(this.sourceWriteBack && table.sourceBinding?.kind && row.sourceKey)) {
      return null;
    }
    const columns = await this.customTableColumnRepository.find({ where: { tableId: table.id } });
    const keyByField = new Map<string, string>();
    for (const column of columns) {
      const source = columnSourceConfig(column.config);
      if (source?.kind === 'app_field' && source.field) {
        keyByField.set(source.field, column.key);
      }
    }
    const changes: Record<string, unknown> = {};
    for (const [field, key] of keyByField) {
      if (key in patch) {
        changes[field] = patch[key];
      }
    }
    if (!Object.keys(changes).length) {
      return null;
    }
    const result = await this.sourceWriteBack.apply({
      userId,
      workspaceId,
      table,
      sourceKey: row.sourceKey,
      changes,
    });
    const values: Record<string, unknown> = {};
    for (const [field, key] of keyByField) {
      if (field in result.values) {
        values[key] = result.values[field] ?? null;
      }
    }
    return { values, error: result.error };
  }

  async removeRow(
    userId: string,
    workspaceId: string,
    tableId: string,
    rowId: string,
  ): Promise<void> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    if (!isUuid(rowId)) {
      throw new BadRequestException(appError('ROW_ID_INVALID'));
    }
    let row: CustomTableRow | null = null;
    try {
      row = await this.customTableRowRepository.findOne({
        where: { id: rowId, tableId },
      });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    if (!row) {
      throw new NotFoundException(appError('ROW_NOT_FOUND'));
    }
    try {
      await this.customTableRowRepository.delete({ id: rowId, tableId });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.TABLE_ROW,
      entityId: rowId,
      action: AuditAction.DELETE,
      diff: { before: row, after: null },
      meta: { tableId, rowNumber: row.rowNumber },
      isUndoable: true,
    });
    await this.recalcAfterWrite(tableId, workspaceId);
  }

  async batchCreateRows(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: BatchCreateCustomTableRowsBody,
  ): Promise<{ created: number; rows: CustomTableRow[] }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    const allowedKeys = await this.getAllowedColumnKeys(tableId);

    let nextRowNumber = await this.getNextRowNumber(tableId);
    const rows = dto.rows.map(row => {
      const rowNumber = row.rowNumber ?? nextRowNumber++;
      return this.customTableRowRepository.create({
        tableId,
        rowNumber,
        data: sanitizeRowData(row.data, allowedKeys),
        styles: row.styles ?? {},
      });
    });

    // Весь пакет проверяем разом: дубли внутри одной загрузки база не поймает,
    // потому что до вставки их там ещё нет.
    await this.validateRowsAgainstColumns(
      tableId,
      rows.map(row => toRowDataRecord(row.data)),
    );

    let savedRows: CustomTableRow[];
    try {
      savedRows = await this.customTableRowRepository.save(rows);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logRowBatchCreate({
      userId,
      workspaceId,
      tableId,
      rows: savedRows,
      meta: {
        count: rows.length,
      },
    });
    await this.recalcAfterWrite(tableId, workspaceId, savedRows);
    applyFormulaColumns(
      savedRows,
      await this.customTableColumnRepository.find({ where: { tableId } }),
    );
    return { created: savedRows.length, rows: savedRows };
  }

  async updateViewSettingsColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableViewSettingsColumnBody,
  ): Promise<CustomTable> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    const before = { ...table };

    const columnKey = dto.columnKey?.trim();
    if (!columnKey) {
      throw new BadRequestException(appError('COLUMN_KEY_REQUIRED'));
    }

    const column = await this.customTableColumnRepository.findOne({
      where: { tableId, key: columnKey },
      select: {
        id: true,
        key: true,
      },
    });
    if (!column) {
      throw new BadRequestException(appError('COLUMN_NOT_FOUND'));
    }

    const viewSettings = getViewSettingsObject(table) as JsonObject;
    const columns = getViewSettingsColumns(viewSettings);
    const existing =
      columns[columnKey] && typeof columns[columnKey] === 'object' ? columns[columnKey] : {};
    const next = { ...existing };

    if (dto.width != null) {
      next.width = dto.width;
    }

    if (dto.aggregate !== undefined) {
      // null снимает итог с колонки, поэтому поле просто не переносится дальше.
      next.aggregate = dto.aggregate ?? undefined;
    }

    columns[columnKey] = next;
    table.viewSettings = { ...viewSettings, columns };

    let saved: CustomTable;
    try {
      saved = await this.customTableRepository.save(table);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { viewSettings: true },
    });
    return this.getTable(workspaceId, tableId);
  }

  /**
   * Правила условного форматирования. Стиль вычисляется на клиенте при
   * отрисовке, поэтому сервер только хранит и валидирует форму правил.
   */
  async updateViewSettingsRules(
    userId: string,
    workspaceId: string,
    tableId: string,
    rules: Record<string, unknown>[],
  ): Promise<CustomTable> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    const before = { ...table };

    const columnKeys = new Set((await this.loadColumnTypeMap(tableId)).keys());
    for (const rule of rules) {
      const col = rule?.col;
      if (typeof col !== 'string' || !columnKeys.has(col)) {
        throw new BadRequestException(appError('RULE_COLUMN_NOT_FOUND', { column: String(col) }));
      }
      if (rule.target !== 'cell' && rule.target !== 'row') {
        throw new BadRequestException(appError('RULE_TARGET_INVALID'));
      }
    }

    const viewSettings = getViewSettingsObject(table) as JsonObject;
    table.viewSettings = { ...viewSettings, conditionalRules: rules };

    let saved: CustomTable;
    try {
      saved = await this.customTableRepository.save(table);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { conditionalRules: true },
    });
    return this.getTable(workspaceId, tableId);
  }

  /**
   * Именованные пресеты вида: фильтры, сортировка, состав колонок и итоги.
   * Заменяют весь набор целиком — клиент всегда присылает актуальный список.
   */
  async updateViewSettingsViews(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableViewsBody,
  ): Promise<CustomTable> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);
    const before = { ...table };

    const ids = new Set<string>();
    for (const view of dto.views) {
      if (ids.has(view.id)) {
        throw new BadRequestException(appError('VIEW_ID_DUPLICATE', { id: String(view.id) }));
      }
      ids.add(view.id);

      // Схема пропускает любую строку: неизвестная функция получает свой код ошибки.
      for (const [col, fn] of Object.entries(view.aggregates ?? {})) {
        if (!(CUSTOM_TABLE_AGGREGATE_FNS as readonly string[]).includes(fn)) {
          throw new BadRequestException(
            appError('AGG_TOTAL_FUNCTION_UNKNOWN', { column: String(col), fn: String(fn) }),
          );
        }
      }
    }

    const activeViewId = dto.activeViewId ?? null;
    if (activeViewId && !ids.has(activeViewId)) {
      throw new BadRequestException(appError('VIEW_ACTIVE_MISSING'));
    }

    const viewSettings = getViewSettingsObject(table) as JsonObject;
    table.viewSettings = { ...viewSettings, views: dto.views, activeViewId };

    let saved: CustomTable;
    try {
      saved = await this.customTableRepository.save(table);
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { savedViews: true },
    });
    return this.getTable(workspaceId, tableId);
  }
}
