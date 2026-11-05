import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { PreviewFormulaBody } from '../../contracts';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { FormulaRecalcService } from './formula-recalc.service';
import {
  describeValidationError,
  formulaHasCycle,
  formulaTypeOfColumn,
  resolveFormulaTitles,
} from './helpers/column-config';
import {
  assertValidFormula,
  collectFieldRefs,
  evaluateFormula,
  FormulaError,
  type FormulaResultType,
  type FormulaValue,
  inferFormulaResultType,
} from './helpers/formula-evaluator';
import { applyFormulaColumns, toRowDataRecord } from './helpers/row-data';

@Injectable()
export class CustomTableFormulaColumnsService {
  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    private readonly support: CustomTableSupportService,
    // Optional too: unit specs build the service by hand and never recalc.
    @Optional() private readonly formulaRecalc?: FormulaRecalcService,
  ) {}

  /**
   * Проверяет формулу при сохранении и нормализует её: ссылки по названию
   * становятся ссылками по ключу, а в config появляется тип результата.
   * Формула может ссылаться на другие формулы, но не по кругу.
   */
  async validateFormulaConfig(
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
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
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
}
