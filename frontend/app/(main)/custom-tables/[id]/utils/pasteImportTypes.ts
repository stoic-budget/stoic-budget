import type { PasteMappingSelection, PastePreviewData } from './pasteUtils';
import type { CustomTablePageColumn } from './tableTypes';
import type { CustomTableGridRow } from './types';

export interface PasteDefaults {
  date: string;
  type: string;
  amount: string;
  currency: string;
  comment: string;
  paid: string;
  columnPrefix: string;
}

export interface PasteMessages {
  noRows: string;
  missingColumnTitle: string;
  insertFailed: string;
  undoFailed: string;
  fileReadFailed: string;
  fileUnsupported: string;
  fileTooLarge: string;
  fileEmpty: string;
}

export interface PasteSheetOption {
  index: number;
  name: string;
  rows: number;
}

export interface PasteProgress {
  done: number;
  total: number;
}

export interface PasteInsertResult {
  createdCount: number;
  /** Ячейки, которые вошли текстом и подсвечены. */
  issueCount: number;
}

export interface UsePasteImportReturn {
  pastePreviewOpen: boolean;
  pasteParsing: boolean;
  pasteApplying: boolean;
  pasteRawRows: string[][];
  pasteUseHeaders: boolean;
  pastePreview: PastePreviewData | null;
  pasteMapping: Record<number, PasteMappingSelection>;
  pasteEdits: Record<string, string>;
  hasMissingPasteColumnTitles: boolean;
  /** Вкладки файла; пусто для вставки из буфера и одностраничных файлов. */
  pasteSheets: PasteSheetOption[];
  pasteSheetIndex: number;
  selectSheet: (index: number) => void;
  /** Итоговую строку файла показать как итоги футера. */
  pasteApplyTotals: boolean;
  setPasteApplyTotals: (value: boolean) => void;
  pasteProgress: PasteProgress | null;
  startPastePreview: (text: string) => void;
  startFileImport: (file: File) => Promise<void>;
  resetPastePreview: () => void;
  handlePasteHeadersToggle: (checked: boolean) => void;
  handlePasteCellChange: (rowIndex: number, sourceIndex: number, value: string) => void;
  handlePasteMappingChange: (sourceIndex: number, selection: PasteMappingSelection) => void;
  handlePasteAdd: () => Promise<void>;
}

export interface UsePasteImportParams {
  tableId: string | null;
  orderedColumns: CustomTablePageColumn[];
  pasteDefaults: PasteDefaults;
  loadTable: () => Promise<void>;
  /** Fired after rows were inserted or rolled back so totals can refresh. */
  onRowsChanged: () => void;
  setRows: React.Dispatch<React.SetStateAction<CustomTableGridRow[]>>;
  /** Called after successful paste — component renders the undo toast */
  onInsertSuccess: (result: PasteInsertResult, onUndo: () => void) => void;
  messages: PasteMessages;
}
