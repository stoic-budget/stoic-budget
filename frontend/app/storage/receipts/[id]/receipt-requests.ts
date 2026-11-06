import apiClient, { apiBaseUrl, type ReceiptRecord } from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';
import type { buildReceiptExportData } from './receipt-form';

type PreviewFetchResult = {
  url: string | null;
  mimeType: string | null;
  error?: string;
};

export async function fetchReceiptPreview(receiptId: string): Promise<PreviewFetchResult> {
  try {
    const response = await fetch(`${apiBaseUrl}/receipts/${receiptId}/file`, {
      method: 'GET',
      headers: getWorkspaceHeaders(),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Preview request failed: ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const mimeType = response.headers.get('content-type') || blob.type || null;
    return { url, mimeType };
  } catch (err) {
    console.error('Failed to load receipt preview:', err);
    return { url: null, mimeType: null, error: 'Preview unavailable' };
  }
}

/** Saves the receipt's file under its attachment name. */
export async function downloadReceiptFile(receipt: ReceiptRecord): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/receipts/${receipt.id}/file`, {
    method: 'GET',
    headers: getWorkspaceHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Download request failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    receipt.metadata?.attachments?.[0]?.filename || receipt.subject || `${receipt.id}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates a custom table holding the export: the table, its columns, then the
 * rows. Answers its id, or null when the server gave none.
 */
export async function createTableFromExport(
  table: ContractInput<'CreateCustomTableBody'>,
  exportData: ReturnType<typeof buildReceiptExportData>,
): Promise<string | null> {
  const createTableResponse = await apiClient.post(
    '/custom-tables',
    table satisfies ContractInput<'CreateCustomTableBody'>,
  );

  const createdTable = await checkContract(
    'CreatedCustomTable',
    createTableResponse.data,
    '/custom-tables',
  );
  const tableId = createdTable.id;

  if (!tableId) {
    return null;
  }

  const createdColumns = await Promise.all(
    exportData.columns.map(async column => {
      const response = await apiClient.post(`/custom-tables/${tableId}/columns`, {
        title: column.title,
        type: column.type,
      } satisfies ContractInput<'CreateCustomTableColumnBody'>);
      return checkContract('CustomTableColumnItem', response.data, '/custom-tables/:id/columns');
    }),
  );

  const columnKeyByField = exportData.columns.reduce<Record<string, string>>(
    (acc, column, index) => {
      const key = createdColumns[index]?.key;
      if (key) {
        acc[column.field] = key;
      }
      return acc;
    },
    {},
  );

  const rows = exportData.rows.map(row => {
    const data = Object.entries(row).reduce<Record<string, string | number>>(
      (acc, [field, value]) => {
        const key = columnKeyByField[field];
        if (key && value !== undefined && value !== '') {
          acc[key] = value;
        }
        return acc;
      },
      {},
    );

    return { data };
  });

  await apiClient.post(`/custom-tables/${tableId}/rows/batch`, {
    rows,
  } satisfies ContractInput<'BatchCreateCustomTableRowsBody'>);
  return tableId;
}
