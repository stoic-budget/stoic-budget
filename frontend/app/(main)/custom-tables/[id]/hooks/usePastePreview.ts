'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { findHeaderRow } from '../utils/importRows';
import type { PasteDefaults, PasteMessages, PasteSheetOption } from '../utils/pasteImportTypes';
import { describeFileError } from '../utils/pasteInsert';
import {
  buildPastePreview,
  type PasteMappingSelection,
  type PastePreviewData,
  parseClipboardRows,
} from '../utils/pasteUtils';
import type { CustomTablePageColumn } from '../utils/tableTypes';
import {
  pickDefaultSheet,
  readTabularWorkbook,
  type SheetLayout,
  sheetToFormulaRows,
  sheetToLayout,
  sheetToTextRows,
  type TabularWorkbook,
} from '../utils/tabularFileReader';

type Formulas = (string | undefined)[][] | undefined;

/** What the import dialog shows: the source rows, their mapping and the preview built from them. */
export function usePastePreview({
  orderedColumns,
  pasteDefaults,
  messages,
}: {
  orderedColumns: CustomTablePageColumn[];
  pasteDefaults: PasteDefaults;
  messages: PasteMessages;
}) {
  const [pastePreviewOpen, setPastePreviewOpen] = useState(false);
  const [pasteParsing, setPasteParsing] = useState(false);
  const [pasteRawRows, setPasteRawRows] = useState<string[][]>([]);
  const [pasteFormulas, setPasteFormulas] = useState<Formulas>(undefined);
  const [pasteLayout, setPasteLayout] = useState<SheetLayout | undefined>(undefined);
  const [pasteSummaries, setPasteSummaries] = useState<PastePreviewData['summaries']>([]);
  const [pasteUseHeaders, setPasteUseHeaders] = useState(false);
  const [pastePreview, setPastePreview] = useState<PastePreviewData | null>(null);
  const [pasteMapping, setPasteMapping] = useState<Record<number, PasteMappingSelection>>({});
  const [pasteEdits, setPasteEdits] = useState<Record<string, string>>({});
  const [pasteWorkbook, setPasteWorkbook] = useState<TabularWorkbook | null>(null);
  const [pasteSheetIndex, setPasteSheetIndex] = useState(0);
  const pastePreviewTimerRef = useRef<number | null>(null);

  const hasMissingPasteColumnTitles = useMemo(
    () => Boolean(pastePreview?.columns.some(col => col.mode === 'new' && !col.newTitle?.trim())),
    [pastePreview],
  );

  const pasteSheets = useMemo<PasteSheetOption[]>(
    () =>
      pasteWorkbook && pasteWorkbook.sheets.length > 1
        ? pasteWorkbook.sheets.map((sheet, index) => ({
            index,
            name: sheet.name,
            rows: sheet.rows.length,
          }))
        : [],
    [pasteWorkbook],
  );

  const resetPreview = useCallback(() => {
    setPastePreviewOpen(false);
    setPastePreview(null);
    setPasteRawRows([]);
    setPasteFormulas(undefined);
    setPasteLayout(undefined);
    setPasteSummaries([]);
    setPasteUseHeaders(false);
    setPasteParsing(false);
    setPasteMapping({});
    setPasteEdits({});
    setPasteWorkbook(null);
    setPasteSheetIndex(0);
    if (pastePreviewTimerRef.current) {
      window.clearTimeout(pastePreviewTimerRef.current);
      pastePreviewTimerRef.current = null;
    }
  }, []);

  const buildPreviewAsync = useCallback(
    (
      rows: string[][],
      useHeaders: boolean,
      mappingSelection: Record<number, PasteMappingSelection> | null,
      edits: Record<string, string>,
    ) => {
      setPasteParsing(true);
      if (pastePreviewTimerRef.current) {
        window.clearTimeout(pastePreviewTimerRef.current);
      }
      pastePreviewTimerRef.current = window.setTimeout(() => {
        const result = buildPastePreview({
          rawRows: rows,
          formulas: pasteFormulas,
          layout: pasteLayout,
          useHeaders,
          orderedColumns,
          mappingSelection,
          edits,
          defaults: pasteDefaults,
        });
        setPastePreview(result.preview);
        setPasteMapping(result.mapping);
        setPasteParsing(false);
        pastePreviewTimerRef.current = null;
      }, 0);
    },
    [orderedColumns, pasteDefaults, pasteFormulas, pasteLayout],
  );

  /**
   * Общий вход для вставки из буфера и импорта файлом. Шапка ищется по всему
   * началу файла: титульные строки над ней отбрасываются, и дальше первая
   * строка матрицы — либо заголовки, либо сразу данные.
   */
  const startPreviewFromRows = useCallback(
    (rows: string[][], formulas?: Formulas, layout?: SheetLayout) => {
      // An empty table is a fine target: the import creates the columns it needs.
      if (!rows.length) {
        return;
      }
      const headerIndex = findHeaderRow(rows);
      const offset = Math.max(headerIndex, 0);
      const trimmedRows = rows.slice(offset);
      const trimmedFormulas = formulas?.slice(offset);
      const trimmedLayout = layout
        ? { originCol: layout.originCol, sheetRows: layout.sheetRows.slice(offset) }
        : undefined;
      const useHeaders = headerIndex >= 0;
      setPasteRawRows(trimmedRows);
      setPasteFormulas(trimmedFormulas);
      setPasteLayout(trimmedLayout);
      setPasteUseHeaders(useHeaders);
      setPastePreviewOpen(true);
      setPasteParsing(true);
      setPasteEdits({});
      window.setTimeout(() => {
        const result = buildPastePreview({
          rawRows: trimmedRows,
          formulas: trimmedFormulas,
          layout: trimmedLayout,
          useHeaders,
          orderedColumns,
          mappingSelection: null,
          edits: {},
          defaults: pasteDefaults,
        });
        setPastePreview(result.preview);
        setPasteMapping(result.mapping);
        // Summaries are decided once, from the file; later mapping edits keep them.
        setPasteSummaries(result.preview.summaries);
        setPasteParsing(false);
      }, 0);
    },
    [orderedColumns, pasteDefaults],
  );

  const startPastePreview = useCallback(
    (text: string) => {
      const { rows } = parseClipboardRows(text);
      startPreviewFromRows(rows);
    },
    [startPreviewFromRows],
  );

  const loadSheet = useCallback(
    (workbook: TabularWorkbook, index: number) => {
      const sheet = workbook.sheets[index];
      if (!sheet) {
        return;
      }
      setPasteSheetIndex(index);
      startPreviewFromRows(sheetToTextRows(sheet), sheetToFormulaRows(sheet), sheetToLayout(sheet));
    },
    [startPreviewFromRows],
  );

  const startFileImport = useCallback(
    async (file: File) => {
      await (async () => {
        const workbook = await readTabularWorkbook(file);
        setPasteWorkbook(workbook);
        loadSheet(workbook, pickDefaultSheet(workbook));
      })().catch(async error => {
        console.error('Failed to read import file:', error);
        toast.error(describeFileError(error, messages));
      });
    },
    [loadSheet, messages],
  );

  const selectSheet = useCallback(
    (index: number) => {
      if (pasteWorkbook) {
        loadSheet(pasteWorkbook, index);
      }
    },
    [pasteWorkbook, loadSheet],
  );

  const handlePasteHeadersToggle = useCallback(
    (checked: boolean) => {
      setPasteUseHeaders(checked);
      if (!pasteRawRows.length) {
        return;
      }
      setPasteEdits({});
      buildPreviewAsync(pasteRawRows, checked, null, {});
    },
    [pasteRawRows, buildPreviewAsync],
  );

  const rebuildPasteWithState = useCallback(
    (nextMapping: Record<number, PasteMappingSelection>, nextEdits: Record<string, string>) => {
      if (!pasteRawRows.length) {
        return;
      }
      buildPreviewAsync(pasteRawRows, pasteUseHeaders, nextMapping, nextEdits);
    },
    [pasteRawRows, pasteUseHeaders, buildPreviewAsync],
  );

  const handlePasteMappingChange = useCallback(
    (sourceIndex: number, selection: PasteMappingSelection) => {
      const next = { ...pasteMapping, [sourceIndex]: selection };
      setPasteMapping(next);
      rebuildPasteWithState(next, pasteEdits);
    },
    [pasteMapping, pasteEdits, rebuildPasteWithState],
  );

  const handlePasteCellChange = useCallback(
    (rowIndex: number, sourceIndex: number, value: string) => {
      setPasteEdits(prev => {
        const cellKey = `${rowIndex}:${sourceIndex}`;
        const next = { ...prev, [cellKey]: value };
        rebuildPasteWithState(pasteMapping, next);
        return next;
      });
    },
    [pasteMapping, rebuildPasteWithState],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pastePreviewTimerRef.current) {
        window.clearTimeout(pastePreviewTimerRef.current);
      }
    };
  }, []);

  return {
    pastePreviewOpen,
    pasteParsing,
    pasteRawRows,
    pasteSummaries,
    pasteUseHeaders,
    pastePreview,
    pasteMapping,
    pasteEdits,
    hasMissingPasteColumnTitles,
    pasteSheets,
    pasteSheetIndex,
    selectSheet,
    startPastePreview,
    startFileImport,
    resetPreview,
    handlePasteHeadersToggle,
    handlePasteCellChange,
    handlePasteMappingChange,
  };
}
