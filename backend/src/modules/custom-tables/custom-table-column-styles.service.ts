import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { UpdateCustomTableColumnStyleBody } from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableColumnStyle } from '../../entities/custom-table-column-style.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { mergeColumnStyle } from './helpers/column-config';
import { isUuid, type JsonObject } from './helpers/row-data';
import { throwHelpfulSchemaError } from './helpers/schema-error';

@Injectable()
export class CustomTableColumnStylesService {
  constructor(
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableColumnStyle)
    private readonly customTableColumnStyleRepository: Repository<CustomTableColumnStyle>,
    private readonly support: CustomTableSupportService,
  ) {}

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
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    await this.support.requireTable(workspaceId, tableId);
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

    await this.support.logEvent({
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
}
