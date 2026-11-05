import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type {
  UpdateCustomTableSummariesBody,
  UpdateCustomTableViewSettingsColumnBody,
  UpdateCustomTableViewsBody,
} from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { CUSTOM_TABLE_AGGREGATE_FNS } from './dto/list-custom-table-rows.dto';
import { FormulaRecalcService } from './formula-recalc.service';
import { formulaTypeOfColumn, resolveFormulaTitles } from './helpers/column-config';
import {
  assertValidFormula,
  evaluateFormulaDetailed,
  FormulaError,
  type FormulaResultType,
  type FormulaValue,
  inferFormulaResultType,
} from './helpers/formula-evaluator';
import {
  getViewSettingsColumns,
  getViewSettingsObject,
  type JsonObject,
  readSummaries,
} from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';

@Injectable()
export class CustomTableViewSettingsService {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    private readonly support: CustomTableSupportService,
    // Optional too: unit specs build the service by hand and never recalc.
    @Optional() private readonly formulaRecalc?: FormulaRecalcService,
  ) {}

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
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
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
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { viewSettings: true, summaries: summaries.length },
    });
    return this.support.getTable(workspaceId, tableId);
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
    const table = await this.support.requireTable(workspaceId, tableId);
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

  async updateViewSettingsColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableViewSettingsColumnBody,
  ): Promise<CustomTable> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
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
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { viewSettings: true },
    });
    return this.support.getTable(workspaceId, tableId);
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
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
    const before = { ...table };

    const columnKeys = new Set((await this.support.loadColumnTypeMap(tableId)).keys());
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
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { conditionalRules: true },
    });
    return this.support.getTable(workspaceId, tableId);
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
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
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
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      diff: { before, after: saved },
      meta: { savedViews: true },
    });
    return this.support.getTable(workspaceId, tableId);
  }
}
