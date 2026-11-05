'use client';

import { useEffect } from 'react';
import type { UsePasteImportParams, UsePasteImportReturn } from '../utils/pasteImportTypes';
import { isTabularText } from '../utils/pasteInsert';
import { isEditableTarget } from '../utils/pasteUtils';
import { usePasteInsert } from './usePasteInsert';
import { usePastePreview } from './usePastePreview';

/** Import from the clipboard or a file: the preview, the insert, and the global paste listener. */
export function usePasteImport({
  tableId,
  orderedColumns,
  pasteDefaults,
  loadTable,
  onRowsChanged,
  setRows,
  onInsertSuccess,
  messages,
}: UsePasteImportParams): UsePasteImportReturn {
  const { pasteSummaries, resetPreview, ...preview } = usePastePreview({
    orderedColumns,
    pasteDefaults,
    messages,
  });
  const insert = usePasteInsert({
    tableId,
    pastePreview: preview.pastePreview,
    pasteSummaries,
    resetPreview,
    loadTable,
    onRowsChanged,
    setRows,
    onInsertSuccess,
    messages,
  });
  const { pastePreviewOpen, startPastePreview } = preview;
  const { pasteApplying } = insert;

  // Global paste event listener
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (pastePreviewOpen || pasteApplying) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      const clipboardText = event.clipboardData?.getData('text/plain') || '';
      if (!isTabularText(clipboardText)) {
        return;
      }
      event.preventDefault();
      startPastePreview(clipboardText);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [pastePreviewOpen, pasteApplying, startPastePreview]);

  return { ...preview, ...insert };
}
