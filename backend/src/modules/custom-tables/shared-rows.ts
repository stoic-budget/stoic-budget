import { In, type Repository } from 'typeorm';
import type { CustomTable } from '../../entities/custom-table.entity';
import {
  type CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import type { CustomTableRow } from '../../entities/custom-table-row.entity';

/** The largest page of rows a shared link answers. */
export const SHARED_PAGE_MAX = 1000;

/**
 * A row as the link shows it: the table's current columns only (a deleted
 * column's values stay in the stored data), and a relation by its label,
 * never the related row's id — '—' when there is no label to show.
 */
export function sharedValues(
  row: CustomTableRow,
  columns: CustomTableColumn[],
): Record<string, unknown> {
  const values = (row.data ?? {}) as Record<string, unknown>;
  const labels =
    (row as CustomTableRow & { relationLabels?: Record<string, string> }).relationLabels ?? {};
  return Object.fromEntries(
    columns
      .filter(col => col.key in values)
      .map(col => [
        col.key,
        col.type === CustomTableColumnType.RELATION && values[col.key] !== null
          ? (labels[col.key] ?? '—')
          : values[col.key],
      ]),
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
