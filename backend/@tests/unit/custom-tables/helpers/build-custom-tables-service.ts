import { CustomTablesService } from '../../../../src/modules/custom-tables/custom-tables.service';
import { CustomTableSupportService } from '../../../../src/modules/custom-tables/custom-table-support.service';
import { CustomTableRelationsService } from '../../../../src/modules/custom-tables/custom-table-relations.service';
import { CustomTableRowQueryService } from '../../../../src/modules/custom-tables/custom-table-row-query.service';
import { CustomTableViewSettingsService } from '../../../../src/modules/custom-tables/custom-table-view-settings.service';
import { CustomTableExportService } from '../../../../src/modules/custom-tables/custom-table-export.service';
import { CustomTableFormulaColumnsService } from '../../../../src/modules/custom-tables/custom-table-formula-columns.service';
import { CustomTableColumnsService } from '../../../../src/modules/custom-tables/custom-table-columns.service';
import { CustomTableRowValidationService } from '../../../../src/modules/custom-tables/custom-table-row-validation.service';
import { CustomTableRowsService } from '../../../../src/modules/custom-tables/custom-table-rows.service';
import { CustomTablePaidStatusService } from '../../../../src/modules/custom-tables/custom-table-paid-status.service';
import { CustomTableSourceSyncService } from '../../../../src/modules/custom-tables/custom-table-source-sync.service';
import { CustomTableFromSourceService } from '../../../../src/modules/custom-tables/custom-table-from-source.service';
import { CustomTableFromDataEntryService } from '../../../../src/modules/custom-tables/custom-table-from-data-entry.service';
import { CustomTableFromDataEntryTabService } from '../../../../src/modules/custom-tables/custom-table-from-data-entry-tab.service';
import { CustomTableDataEntrySyncService } from '../../../../src/modules/custom-tables/custom-table-data-entry-sync.service';
import { CustomTableConvertedStatementsService } from '../../../../src/modules/custom-tables/custom-table-converted-statements.service';
import { CustomTableStatementConversionService } from '../../../../src/modules/custom-tables/custom-table-statement-conversion.service';
import { CustomTableColumnStylesService } from '../../../../src/modules/custom-tables/custom-table-column-styles.service';
import { CustomTableCatalogService } from '../../../../src/modules/custom-tables/custom-table-catalog.service';

/** Builds the facade with its services by hand, from the dependencies listed once here. */
export function buildCustomTablesService(
  customTableRepository?: unknown,
  categoryRepository?: unknown,
  customTableColumnRepository?: unknown,
  customTableRowRepository?: unknown,
  customTableColumnStyleRepository?: unknown,
  customTableCellStyleRepository?: unknown,
  dataEntryRepository?: unknown,
  dataEntryCustomFieldRepository?: unknown,
  statementRepository?: unknown,
  transactionRepository?: unknown,
  userRepository?: unknown,
  workspaceMemberRepository?: unknown,
  auditService?: unknown,
  classificationService?: unknown,
  customTableSources?: unknown,
  formulaRecalc?: unknown,
  workspaceCurrency?: unknown,
  taxAssignmentService?: unknown,
  sourceWriteBack?: unknown,
  eventEmitter?: unknown,
): CustomTablesService {
  const deps = { customTableRepository, categoryRepository, customTableColumnRepository, customTableRowRepository, customTableColumnStyleRepository, customTableCellStyleRepository, dataEntryRepository, dataEntryCustomFieldRepository, statementRepository, transactionRepository, userRepository, workspaceMemberRepository, auditService, classificationService, customTableSources, formulaRecalc, workspaceCurrency, taxAssignmentService, sourceWriteBack, eventEmitter };
  const support = new CustomTableSupportService(
    deps.customTableRepository as never,
    deps.categoryRepository as never,
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    deps.customTableColumnStyleRepository as never,
    deps.workspaceMemberRepository as never,
    deps.auditService as never,
    deps.customTableSources as never,
    deps.formulaRecalc as never,
  );
  const relations = new CustomTableRelationsService(
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    support as never,
  );
  const rowQuery = new CustomTableRowQueryService(
    deps.customTableRowRepository as never,
    deps.customTableCellStyleRepository as never,
    support as never,
    relations as never,
  );
  const views = new CustomTableViewSettingsService(
    deps.customTableRepository as never,
    deps.customTableColumnRepository as never,
    support as never,
    deps.formulaRecalc as never,
  );
  const exporter = new CustomTableExportService(
    deps.customTableColumnRepository as never,
    support as never,
    rowQuery as never,
    relations as never,
    views as never,
    deps.formulaRecalc as never,
  );
  const formulas = new CustomTableFormulaColumnsService(
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    support as never,
    deps.formulaRecalc as never,
  );
  const columns = new CustomTableColumnsService(
    deps.customTableColumnRepository as never,
    deps.auditService as never,
    support as never,
    formulas as never,
    relations as never,
  );
  const rowValidation = new CustomTableRowValidationService(
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    deps.sourceWriteBack as never,
  );
  const rows = new CustomTableRowsService(
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    support as never,
    rowValidation as never,
  );
  const paidStatus = new CustomTablePaidStatusService(
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    support as never,
  );
  const sourceSync = new CustomTableSourceSyncService(
    deps.customTableRepository as never,
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    deps.statementRepository as never,
    support as never,
  );
  const fromSource = new CustomTableFromSourceService(
    deps.customTableRepository as never,
    deps.customTableColumnRepository as never,
    support as never,
    sourceSync as never,
    deps.sourceWriteBack as never,
  );
  const fromDataEntry = new CustomTableFromDataEntryService(
    deps.customTableRepository as never,
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    deps.dataEntryRepository as never,
    support as never,
  );
  const fromDataEntryTab = new CustomTableFromDataEntryTabService(
    deps.customTableRepository as never,
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    deps.dataEntryRepository as never,
    deps.dataEntryCustomFieldRepository as never,
    support as never,
  );
  const dataEntrySync = new CustomTableDataEntrySyncService(
    deps.customTableRepository as never,
    deps.dataEntryRepository as never,
    support as never,
  );
  const convertedStatements = new CustomTableConvertedStatementsService(
    deps.statementRepository as never,
    deps.transactionRepository as never,
    deps.classificationService as never,
  );
  const conversion = new CustomTableStatementConversionService(
    deps.customTableColumnRepository as never,
    deps.customTableRowRepository as never,
    deps.statementRepository as never,
    deps.transactionRepository as never,
    support as never,
    convertedStatements as never,
    deps.workspaceCurrency as never,
    deps.taxAssignmentService as never,
    deps.eventEmitter as never,
  );
  const columnStyles = new CustomTableColumnStylesService(
    deps.customTableColumnRepository as never,
    deps.customTableColumnStyleRepository as never,
    support as never,
  );
  const catalog = new CustomTableCatalogService(
    deps.customTableRepository as never,
    support as never,
  );
  return new CustomTablesService(
    catalog as never,
    support as never,
    fromDataEntry as never,
    fromDataEntryTab as never,
    dataEntrySync as never,
    fromSource as never,
    sourceSync as never,
    conversion as never,
    formulas as never,
    columns as never,
    columnStyles as never,
    views as never,
    relations as never,
    rowQuery as never,
    exporter as never,
    paidStatus as never,
    rows as never,
  );
}
