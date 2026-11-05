import { Injectable } from '@nestjs/common';
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
  UpdateCustomTableBody,
  UpdateCustomTableColumnBody,
  UpdateCustomTableColumnStyleBody,
  UpdateCustomTableRowBody,
  UpdateCustomTableSummariesBody,
  UpdateCustomTableViewSettingsColumnBody,
  UpdateCustomTableViewsBody,
} from '../../contracts';
import { CustomTableCatalogService } from './custom-table-catalog.service';
import { CustomTableColumnStylesService } from './custom-table-column-styles.service';
import { CustomTableColumnsService } from './custom-table-columns.service';
import { CustomTableDataEntrySyncService } from './custom-table-data-entry-sync.service';
import { CustomTableExportService } from './custom-table-export.service';
import { CustomTableFormulaColumnsService } from './custom-table-formula-columns.service';
import { CustomTableFromDataEntryService } from './custom-table-from-data-entry.service';
import { CustomTableFromDataEntryTabService } from './custom-table-from-data-entry-tab.service';
import { CustomTableFromSourceService } from './custom-table-from-source.service';
import { CustomTablePaidStatusService } from './custom-table-paid-status.service';
import { CustomTableRelationsService } from './custom-table-relations.service';
import { CustomTableRowQueryService } from './custom-table-row-query.service';
import { CustomTableRowsService } from './custom-table-rows.service';
import { CustomTableSourceSyncService } from './custom-table-source-sync.service';
import { CustomTableStatementConversionService } from './custom-table-statement-conversion.service';
import { CustomTableSupportService } from './custom-table-support.service';
import { CustomTableViewSettingsService } from './custom-table-view-settings.service';
import {
  type CustomTableAggregateDto,
  type CustomTableRowFilterDto,
  type CustomTableRowSortDto,
} from './dto/list-custom-table-rows.dto';

/** The module's entry point: every call goes to the service that owns that concern. */
@Injectable()
export class CustomTablesService {
  constructor(
    private readonly catalog: CustomTableCatalogService,
    private readonly support: CustomTableSupportService,
    private readonly fromDataEntry: CustomTableFromDataEntryService,
    private readonly fromDataEntryTab: CustomTableFromDataEntryTabService,
    private readonly dataEntrySync: CustomTableDataEntrySyncService,
    private readonly fromSource: CustomTableFromSourceService,
    private readonly sourceSync: CustomTableSourceSyncService,
    private readonly conversion: CustomTableStatementConversionService,
    private readonly formulas: CustomTableFormulaColumnsService,
    private readonly columns: CustomTableColumnsService,
    private readonly columnStyles: CustomTableColumnStylesService,
    private readonly views: CustomTableViewSettingsService,
    private readonly relations: CustomTableRelationsService,
    private readonly rowQuery: CustomTableRowQueryService,
    private readonly exporter: CustomTableExportService,
    private readonly paidStatus: CustomTablePaidStatusService,
    private readonly rows: CustomTableRowsService,
  ) {}

  createTable(userId: string, workspaceId: string, dto: CreateCustomTableBody) {
    return this.catalog.createTable(userId, workspaceId, dto);
  }

  listTables(workspaceId: string) {
    return this.catalog.listTables(workspaceId);
  }

  getTable(workspaceId: string, tableId: string) {
    return this.support.getTable(workspaceId, tableId);
  }

  updateTable(userId: string, workspaceId: string, tableId: string, dto: UpdateCustomTableBody) {
    return this.catalog.updateTable(userId, workspaceId, tableId, dto);
  }

  createFromDataEntry(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromDataEntryBody,
  ) {
    return this.fromDataEntry.createFromDataEntry(userId, workspaceId, dto);
  }

  createFromDataEntryCustomTab(
    userId: string,
    workspaceId: string,
    dto: CreateCustomTableFromDataEntryCustomTabBody,
  ) {
    return this.fromDataEntryTab.createFromDataEntryCustomTab(userId, workspaceId, dto);
  }

  syncFromDataEntry(userId: string, workspaceId: string, tableId: string) {
    return this.dataEntrySync.syncFromDataEntry(userId, workspaceId, tableId);
  }

  restoreDefault(userId: string, workspaceId: string, tableId: string) {
    return this.fromSource.restoreDefault(userId, workspaceId, tableId);
  }

  previewSource(userId: string, workspaceId: string, dto: PreviewCustomTableSourceBody) {
    return this.fromSource.previewSource(userId, workspaceId, dto);
  }

  createFromSource(userId: string, workspaceId: string, dto: CreateCustomTableFromSourceBody) {
    return this.fromSource.createFromSource(userId, workspaceId, dto);
  }

  refreshFromSource(userId: string, workspaceId: string, tableId: string) {
    return this.sourceSync.refreshFromSource(userId, workspaceId, tableId);
  }

  addSourceStatements(
    userId: string,
    workspaceId: string,
    tableId: string,
    statementIds: readonly string[],
  ) {
    return this.sourceSync.addSourceStatements(userId, workspaceId, tableId, statementIds);
  }

  convertToStatement(userId: string, workspaceId: string, tableId: string) {
    return this.conversion.convertToStatement(userId, workspaceId, tableId);
  }

  removeTable(userId: string, workspaceId: string, tableId: string) {
    return this.catalog.removeTable(userId, workspaceId, tableId);
  }

  previewFormula(userId: string, workspaceId: string, tableId: string, dto: PreviewFormulaBody) {
    return this.formulas.previewFormula(userId, workspaceId, tableId, dto);
  }

  addColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: CreateCustomTableColumnBody,
  ) {
    return this.columns.addColumn(userId, workspaceId, tableId, dto);
  }

  updateColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    columnId: string,
    dto: UpdateCustomTableColumnBody,
  ) {
    return this.columns.updateColumn(userId, workspaceId, tableId, columnId, dto);
  }

  updateColumnStyle(
    userId: string,
    workspaceId: string,
    tableId: string,
    columnId: string,
    dto: UpdateCustomTableColumnStyleBody,
  ) {
    return this.columnStyles.updateColumnStyle(userId, workspaceId, tableId, columnId, dto);
  }

  reorderColumns(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: ReorderCustomTableColumnsBody,
  ) {
    return this.columns.reorderColumns(userId, workspaceId, tableId, dto);
  }

  removeColumn(userId: string, workspaceId: string, tableId: string, columnId: string) {
    return this.columns.removeColumn(userId, workspaceId, tableId, columnId);
  }

  updateViewSettingsSummaries(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableSummariesBody,
  ) {
    return this.views.updateViewSettingsSummaries(userId, workspaceId, tableId, dto);
  }

  getSummaries(workspaceId: string, tableId: string) {
    return this.views.getSummaries(workspaceId, tableId);
  }

  listRelationOptions(workspaceId: string, tableId: string, columnKey: string, search?: string) {
    return this.relations.listRelationOptions(workspaceId, tableId, columnKey, search);
  }

  findDuplicateRows(
    workspaceId: string,
    tableId: string,
    params: { keys: string[]; limit?: number },
  ) {
    return this.rowQuery.findDuplicateRows(workspaceId, tableId, params);
  }

  aggregateRows(
    workspaceId: string,
    tableId: string,
    params: { filters?: CustomTableRowFilterDto[]; aggs: CustomTableAggregateDto[] },
  ) {
    return this.rowQuery.aggregateRows(workspaceId, tableId, params);
  }

  groupRows(
    workspaceId: string,
    tableId: string,
    params: {
      groupBy: string;
      filters?: CustomTableRowFilterDto[];
      aggs?: CustomTableAggregateDto[];
      limit?: number;
    },
  ) {
    return this.rowQuery.groupRows(workspaceId, tableId, params);
  }

  exportRows(
    workspaceId: string,
    tableId: string,
    params: {
      format: 'csv' | 'xlsx';
      filters?: CustomTableRowFilterDto[];
      sort?: CustomTableRowSortDto;
      columnKeys?: string[];
    },
  ) {
    return this.exporter.exportRows(workspaceId, tableId, params);
  }

  listRows(
    workspaceId: string,
    tableId: string,
    params: {
      cursor?: number;
      offset?: number;
      limit: number;
      filters?: CustomTableRowFilterDto[];
      sort?: CustomTableRowSortDto;
    },
  ) {
    return this.rowQuery.listRows(workspaceId, tableId, params);
  }

  classifyPaidStatus(workspaceId: string, tableId: string, dto: ClassifyPaidStatusBody) {
    return this.paidStatus.classifyPaidStatus(workspaceId, tableId, dto);
  }

  createRow(userId: string, workspaceId: string, tableId: string, dto: CreateCustomTableRowBody) {
    return this.rows.createRow(userId, workspaceId, tableId, dto);
  }

  updateRow(
    userId: string,
    workspaceId: string,
    tableId: string,
    rowId: string,
    dto: UpdateCustomTableRowBody,
  ) {
    return this.rows.updateRow(userId, workspaceId, tableId, rowId, dto);
  }

  removeRow(userId: string, workspaceId: string, tableId: string, rowId: string) {
    return this.rows.removeRow(userId, workspaceId, tableId, rowId);
  }

  batchCreateRows(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: BatchCreateCustomTableRowsBody,
  ) {
    return this.rows.batchCreateRows(userId, workspaceId, tableId, dto);
  }

  updateViewSettingsColumn(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableViewSettingsColumnBody,
  ) {
    return this.views.updateViewSettingsColumn(userId, workspaceId, tableId, dto);
  }

  updateViewSettingsRules(
    userId: string,
    workspaceId: string,
    tableId: string,
    rules: Record<string, unknown>[],
  ) {
    return this.views.updateViewSettingsRules(userId, workspaceId, tableId, rules);
  }

  updateViewSettingsViews(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: UpdateCustomTableViewsBody,
  ) {
    return this.views.updateViewSettingsViews(userId, workspaceId, tableId, dto);
  }
}
