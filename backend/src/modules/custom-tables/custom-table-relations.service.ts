import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { isUuid } from './helpers/row-data';

@Injectable()
export class CustomTableRelationsService {
  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    private readonly support: CustomTableSupportService,
  ) {}

  /**
   * Подписи связанных строк. Как и формулы, считаются при выдаче и не
   * хранятся: иначе переименование строки-цели оставило бы всюду устаревший
   * текст. В data[key] лежит идентификатор строки, подпись едет отдельно.
   */
  async applyRelationLabels(rows: CustomTableRow[], columns: CustomTableColumn[]): Promise<void> {
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
  async validateRelationConfig(
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
    await this.support.requireTable(workspaceId, targetTableId);

    const displayColumnKey = config?.displayColumnKey;
    if (displayColumnKey !== undefined && displayColumnKey !== null) {
      if (typeof displayColumnKey !== 'string') {
        throw new BadRequestException(appError('COLUMN_DISPLAY_INVALID'));
      }
      const targetColumns = await this.support.loadColumnTypeMap(targetTableId);
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
    await this.support.requireTable(workspaceId, tableId);
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
    await this.support.requireTable(workspaceId, targetTableId);

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
}
