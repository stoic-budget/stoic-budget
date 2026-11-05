import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { isBlankCellValue } from './helpers/row-data';
import { columnSourceConfig } from './helpers/source-columns';
import { SourceWriteBackService } from './write-back/source-write-back.service';

@Injectable()
export class CustomTableRowValidationService {
  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    // Optional: cells of tables filled from app data write back through it.
    @Optional() private readonly sourceWriteBack?: SourceWriteBackService,
  ) {}

  /**
   * Проверка флагов колонки на границе записи. До этого isRequired и isUnique
   * только хранились: обязательную колонку можно было оставить пустой, а в
   * уникальную положить дубль.
   *
   * @param rows строки одной операции — в пакетной вставке дубли внутри
   *   самого пакета иначе прошли бы мимо проверки по базе.
   */
  async validateRowsAgainstColumns(
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

  /**
   * Sends the patch's cells that show an app record (source columns of a table
   * filled from app data, on a row that came from a record) to that record.
   * Returns the record's values for every source column of the row, keyed by
   * column, and the app's refusal if there was one; null when nothing applies.
   */
  async writeBackAppFields(
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
}
