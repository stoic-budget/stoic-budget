import { In, type Repository } from 'typeorm';
import type { CustomTable } from '../../entities/custom-table.entity';
import {
  type CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';

/** A row's values for the table's current columns only. */
export function onlyColumns(data: unknown, columns: CustomTableColumn[]): Record<string, unknown> {
  const values = (data ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    columns.filter(col => col.key in values).map(col => [col.key, values[col.key]]),
  );
}

/**
 * The columns whose relation labels a shared table may show: other columns,
 * and relations to a table of the shared table's own workspace. A relation
 * that names any other table shows its stored value, never that table's data.
 */
export async function sameWorkspaceRelations(
  tables: Repository<CustomTable>,
  columns: CustomTableColumn[],
  workspaceId: string,
): Promise<CustomTableColumn[]> {
  const targets = [
    ...new Set(
      columns
        .filter(col => col.type === CustomTableColumnType.RELATION)
        .map(col => col.config?.targetTableId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];
  const own = targets.length
    ? new Set(
        (await tables.find({ where: { id: In(targets), workspaceId }, select: { id: true } })).map(
          table => table.id,
        ),
      )
    : new Set<string>();
  return columns.filter(
    col =>
      col.type !== CustomTableColumnType.RELATION || own.has(col.config?.targetTableId as string),
  );
}
