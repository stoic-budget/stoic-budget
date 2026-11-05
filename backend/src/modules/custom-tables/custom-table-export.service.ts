import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import * as xlsx from 'xlsx';
import { appError } from '../../common/errors/app-error';
import { normalizeFilename } from '../../common/utils/filename.util';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import { CustomTable } from '../../entities/custom-table.entity';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableRelationsService } from './custom-table-relations.service';
import { CustomTableRowQueryService } from './custom-table-row-query.service';
import { CustomTableSupportService } from './custom-table-support.service';
import { CustomTableViewSettingsService } from './custom-table-view-settings.service';
import {
  type CustomTableRowFilterDto,
  type CustomTableRowSortDto,
} from './dto/list-custom-table-rows.dto';
import { FormulaRecalcService } from './formula-recalc.service';
import {
  applyFormulaColumns,
  getViewSettingsColumns,
  getViewSettingsObject,
  readSummaries,
} from './helpers/row-data';
import { exportCellValue, exportHeader } from './helpers/row-query';

@Injectable()
export class CustomTableExportService {
  /** Потолок выгрузки: воркбук собирается в памяти, безлимит означал бы OOM. */
  private static readonly MAX_EXPORT_ROWS = 100_000;

  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    private readonly support: CustomTableSupportService,
    private readonly rowQuery: CustomTableRowQueryService,
    private readonly relations: CustomTableRelationsService,
    private readonly views: CustomTableViewSettingsService,
    // Optional too: unit specs build the service by hand and never recalc.
    @Optional() private readonly formulaRecalc?: FormulaRecalcService,
  ) {}

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
    const table = await this.support.requireTable(workspaceId, tableId);

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

    const query = await this.rowQuery.buildRowsQuery(tableId, params);
    const total = await query.getCount();
    if (total > CustomTableExportService.MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        appError('EXPORT_TOO_MANY_ROWS', {
          total,
          max: CustomTableExportService.MAX_EXPORT_ROWS,
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
      await this.relations.applyRelationLabels(batch, allColumns);
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
      const computed = await this.views.getSummaries(table.workspaceId, table.id);
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
}
