import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import type { CreateCustomTableBody, UpdateCustomTableBody } from '../../contracts';
import { AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CustomTable, CustomTableSource } from '../../entities/custom-table.entity';
import { CustomTableSupportService } from './custom-table-support.service';
import { throwHelpfulSchemaError } from './helpers/schema-error';

@Injectable()
export class CustomTableCatalogService {
  constructor(
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    private readonly support: CustomTableSupportService,
  ) {}

  async createTable(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableBody,
  ): Promise<CustomTable> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const categoryId =
      dto.categoryId === null || dto.categoryId === undefined
        ? null
        : await this.support.resolveCategoryId(workspaceId, dto.categoryId);

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
    await this.support.logEvent({
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

  async updateTable(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableBody,
  ): Promise<CustomTable> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
    const before = { ...table };
    if (dto.name != null) {
      table.name = dto.name;
    }
    if (dto.description !== undefined) {
      table.description = dto.description ?? null;
    }
    if (dto.categoryId !== undefined) {
      table.categoryId =
        dto.categoryId === null
          ? null
          : await this.support.resolveCategoryId(workspaceId, dto.categoryId);
    }
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
    });
    return saved;
  }

  async removeTable(userId: string, workspaceId: string, tableId: string): Promise<void> {
    await this.support.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.support.requireTable(workspaceId, tableId);
    try {
      await this.customTableRepository.delete({ id: table.id });
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
    await this.support.logEvent({
      userId,
      workspaceId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.DELETE,
      diff: { before: table, after: null },
      isUndoable: true,
    });
  }
}
