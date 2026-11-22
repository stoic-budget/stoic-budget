import { In, type Repository } from 'typeorm';
import type { CustomTableColumn } from '../../../entities/custom-table-column.entity';
import { type ColumnMapping, columnMappingOf } from './custom-table-columns.util';

export interface TableColumns {
  columnsByTableId: Map<string, CustomTableColumn[]>;
  mappingByTableId: Map<string, ColumnMapping>;
}

/** Each table's columns in position order, and the mapping guessed from them. */
export async function loadTableColumns(
  customTableColumnRepository: Repository<CustomTableColumn>,
  tableIds: string[],
): Promise<TableColumns> {
  const columns = await customTableColumnRepository.find({
    where: { tableId: In(tableIds) },
    order: { tableId: 'ASC', position: 'ASC' },
  });

  const columnsByTableId = new Map<string, CustomTableColumn[]>();
  for (const col of columns) {
    const list = columnsByTableId.get(col.tableId) || [];
    list.push(col);
    columnsByTableId.set(col.tableId, list);
  }

  const mappingByTableId = new Map<string, ColumnMapping>();

  for (const tableId of tableIds) {
    const cols = columnsByTableId.get(tableId) || [];
    mappingByTableId.set(tableId, columnMappingOf(cols));
  }

  return { columnsByTableId, mappingByTableId };
}
