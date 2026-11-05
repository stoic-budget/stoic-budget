import apiClient from '@/app/lib/api';
import type { CustomTableColumnItem } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import type { PasteMessages } from './pasteImportTypes';
import type { PastePreviewData, PasteRowStyles, PasteTotals } from './pasteUtils';
import { TabularFileError } from './tabularFileReader';
import type { CustomTableCellValue, CustomTableGridRow, CustomTableRowPatch } from './types';

type NewColumn = NonNullable<PastePreviewData['columns'][number]>;

/**
 * Formula columns go last, and a formula that mentions another new column's
 * title waits for it: the server resolves titles to keys only for columns that
 * already exist.
 */
function orderNewColumns(columns: NewColumn[]): NewColumn[] {
  const plain = columns.filter(col => col.newType !== 'formula');
  const formulas = columns.filter(col => col.newType === 'formula');
  const titles = new Set(formulas.map(col => col.newTitle?.trim()));
  const refsOf = (col: NewColumn): string[] =>
    [...String(col.newConfig?.expression ?? '').matchAll(/\[([^\]]+)\]/g)]
      .map(match => match[1].trim())
      .filter(title => titles.has(title) && title !== col.newTitle?.trim());
  const ordered: NewColumn[] = [];
  const done = new Set<NewColumn>();
  const visit = (col: NewColumn, trail: Set<NewColumn>): void => {
    if (done.has(col) || trail.has(col)) {
      return;
    }
    trail.add(col);
    for (const ref of refsOf(col)) {
      const dep = formulas.find(item => item.newTitle?.trim() === ref);
      if (dep) {
        visit(dep, trail);
      }
    }
    done.add(col);
    ordered.push(col);
  };
  for (const col of formulas) {
    visit(col, new Set());
  }
  return [...plain, ...ordered];
}

export function isTabularText(text: string): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.includes('\t') || normalized.split('\n').length > 1;
}

export const countIssues = (rowStyles: Array<PasteRowStyles | null>): number =>
  rowStyles.reduce((total, styles) => total + (styles ? Object.keys(styles).length : 0), 0);

/**
 * TabularFileError already carries a `reason` discriminator, so localise by that
 * and let its English message stand in for any kind we have no copy for.
 */
export function describeFileError(error: unknown, messages: PasteMessages): string {
  if (!(error instanceof TabularFileError)) {
    return messages.fileReadFailed;
  }

  switch (error.reason) {
    case 'unsupported':
      return messages.fileUnsupported;
    case 'too-large':
      return messages.fileTooLarge;
    case 'empty':
      return messages.fileEmpty;
    case 'unreadable':
      return messages.fileReadFailed;
    default:
      return error.message;
  }
}

/** Rows on screen plus the new ones: each id once, in row order. */
export function mergeCreatedRows(
  current: CustomTableGridRow[],
  createdRows: CustomTableGridRow[],
): CustomTableGridRow[] {
  const merged = [...current, ...createdRows];
  const seen = new Set<string>();
  const deduped: CustomTableGridRow[] = [];
  for (const row of merged) {
    const id = row.id || String(row.rowNumber);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    deduped.push(row);
  }
  deduped.sort((a, b) => (a.rowNumber ?? 0) - (b.rowNumber ?? 0));
  return deduped;
}

export async function createNewColumns(
  tableId: string,
  newColumns: NewColumn[],
  loadTable: () => Promise<void>,
): Promise<{ keyMap: Map<string, string>; columnIds: string[] }> {
  const keyMap = new Map<string, string>();
  const columnIds: string[] = [];
  if (!newColumns.length) {
    return { keyMap, columnIds };
  }
  // One by one: the server numbers positions by creation order, and the
  // table should read in the same order as the file.
  const created: CustomTableColumnItem[] = [];
  const ordered = orderNewColumns(newColumns);
  for (const col of ordered) {
    const response = await apiClient.post(`/custom-tables/${tableId}/columns`, {
      title: (col.newTitle ?? '').trim(),
      type: col.newType ?? 'text',
      ...(col.newConfig ? { config: col.newConfig } : {}),
    } satisfies ContractInput<'CreateCustomTableColumnBody'>);
    created.push(
      await checkContract('CustomTableColumnItem', response.data, '/custom-tables/:id/columns'),
    );
  }
  for (let i = 0; i < created.length; i++) {
    const column = created[i];
    const placeholderKey = ordered[i]?.columnKey || '';
    if (placeholderKey) {
      keyMap.set(placeholderKey, column.key);
    }
    columnIds.push(column.id);
  }
  await loadTable();
  return { keyMap, columnIds };
}

export const buildPayloadRows = (
  dataRows: Record<string, unknown>[],
  rowStyles: Array<PasteRowStyles | null>,
  keyMap: Map<string, string>,
): Array<{ data: CustomTableRowPatch; styles?: PasteRowStyles }> =>
  dataRows.map((row, index) => {
    const data: CustomTableRowPatch = {};
    for (const [key, value] of Object.entries(row)) {
      data[keyMap.get(key) || key] = value as CustomTableCellValue;
    }
    const styles = rowStyles[index];
    if (!styles) {
      return { data };
    }
    const remapped: PasteRowStyles = {};
    for (const [key, style] of Object.entries(styles)) {
      remapped[keyMap.get(key) || key] = style;
    }
    return { data, styles: remapped };
  });

/** Formulas of the file's totals row become summaries, next to the ones the table already has. */
export async function applySummaries(
  tableId: string,
  summaries: PastePreviewData['summaries'],
): Promise<void> {
  if (!summaries.length) {
    return;
  }
  const { items } = await apiQueryDecoded({
    url: `/custom-tables/${tableId}/summaries`,
    contract: 'CustomTableSummaries',
  });
  const existing = items.map(({ id, title, expression }) => ({
    id,
    title,
    expression,
  }));
  await apiClient.patch(`/custom-tables/${tableId}/view-settings/summaries`, {
    summaries: [...existing, ...summaries].slice(0, 20),
  } satisfies ContractInput<'UpdateCustomTableSummariesBody'>);
}

export async function applyTotals(
  tableId: string,
  totals: PasteTotals,
  keyMap: Map<string, string>,
  loadTable: () => Promise<void>,
): Promise<void> {
  const entries = Object.entries(totals.aggregates);
  if (!entries.length) {
    return;
  }
  for (const [key, aggregate] of entries) {
    await apiClient.patch(`/custom-tables/${tableId}/view-settings/columns`, {
      columnKey: keyMap.get(key) || key,
      aggregate,
    } satisfies ContractInput<'UpdateCustomTableViewSettingsColumnBody'>);
  }
  await loadTable();
}
