'use client';

import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { fill, findRequiredProblems } from '../utils/importPreviewHelpers';
import type { UsePasteImportReturn } from '../utils/pasteImportTypes';
import type { CustomTableColumn } from '../utils/types';
import { ImportMappingRow } from './ImportMappingRow';

export interface ImportPreviewLabels {
  title: string;
  useHeaders: string;
  ignore: string;
  newColumn: string;
  newColumnTitle: string;
  newColumnType: string;
  sheet: string;
  rowsSummary: string;
  extraRows: string;
  errors: string;
  issuesKept: string;
  requiredUnmapped: string;
  requiredBlank: string;
  totalsExcluded: string;
  applyTotals: string;
  optionsCount: string;
  formulasSummary: string;
  formulaCarried: string;
  formulaSkipped: string;
  progress: string;
  add: string;
  cancel: string;
  source: string;
  target: string;
}

interface ImportPreviewDialogProps {
  paste: UsePasteImportReturn;
  columns: CustomTableColumn[];
  labels: ImportPreviewLabels;
  /** Названия типов колонок из диалога колонки, чтобы не переводить дважды. */
  typeLabels: Record<string, string>;
  /** Подсказка «похоже на подписки — разнести по приложению?» от страницы. */
  banner?: React.ReactNode;
}

/** Maps the columns of a pasted/imported sheet onto the table before insert. */
export function ImportPreviewDialog({
  paste,
  columns,
  labels,
  typeLabels,
  banner,
}: ImportPreviewDialogProps) {
  const { pastePreview: preview, pasteParsing, pasteApplying, pasteProgress } = paste;
  const issueCount = preview ? Object.values(preview.errors).reduce((a, b) => a + b, 0) : 0;
  const requiredProblems = preview ? findRequiredProblems(columns, preview) : [];
  const canAdd = Boolean(
    preview?.dataRows.length && !paste.hasMissingPasteColumnTitles && !requiredProblems.length,
  );
  const visibleColumns = preview?.columns.filter(c => c.sourceIndex !== null) ?? [];
  const confirmText = pasteProgress
    ? fill(labels.progress, { done: pasteProgress.done, total: pasteProgress.total })
    : fill(labels.add, { count: preview?.dataRows.length ?? 0 });

  return (
    <ModalShell
      isOpen={paste.pastePreviewOpen}
      onClose={paste.resetPastePreview}
      size="lg"
      title={labels.title}
      footer={
        <ModalFooter
          onCancel={paste.resetPastePreview}
          onConfirm={() => void paste.handlePasteAdd()}
          cancelText={labels.cancel}
          confirmText={confirmText}
          isConfirmLoading={pasteApplying}
          isConfirmDisabled={!canAdd || pasteParsing}
        />
      }
    >
      {pasteParsing || !preview ? (
        <SnapshotSkeleton id="custom-table-import" loading fallback="panel" />
      ) : (
        <SnapshotSkeleton id="custom-table-import" loading={false}>
          <div className="seneca-ct__import">
            <div className="seneca-ct__import-controls">
              {paste.pasteSheets.length ? (
                <Select
                  size="small"
                  inputProps={{ 'aria-label': labels.sheet }}
                  value={String(paste.pasteSheetIndex)}
                  onChange={next => paste.selectSheet(Number(next))}
                  options={paste.pasteSheets.map(sheet => ({
                    value: String(sheet.index),
                    label: `${sheet.name} · ${sheet.rows}`,
                  }))}
                />
              ) : null}
              {preview.hasHeadersToggle ? (
                <Checkbox
                  label={labels.useHeaders}
                  checked={paste.pasteUseHeaders}
                  onCheckedChange={paste.handlePasteHeadersToggle}
                />
              ) : null}
              {preview.totals.excludedRows ? (
                <Checkbox
                  label={`${fill(labels.totalsExcluded, { count: preview.totals.excludedRows })} · ${labels.applyTotals}`}
                  checked={paste.pasteApplyTotals}
                  onCheckedChange={paste.setPasteApplyTotals}
                />
              ) : null}
            </div>
            <div className="seneca-ct__map-head">
              <span>{labels.source}</span>
              <span>{labels.target}</span>
              <span>{labels.newColumnTitle}</span>
              <span>{labels.newColumnType}</span>
            </div>
            <ul className="seneca-ct__map">
              {preview.columns.map(mapping => (
                <ImportMappingRow
                  key={mapping.sourceIndex ?? mapping.columnKey ?? mapping.label}
                  mapping={mapping}
                  columns={columns}
                  onChange={selection => {
                    if (mapping.sourceIndex !== null) {
                      paste.handlePasteMappingChange(mapping.sourceIndex, selection);
                    }
                  }}
                  labels={labels}
                  typeLabels={typeLabels}
                />
              ))}
            </ul>
            <p className="seneca-ct__hint">
              {fill(labels.rowsSummary, {
                shown: preview.previewRows.length,
                total: preview.totalRows,
              })}
              {preview.extraRowsCount
                ? ` ${fill(labels.extraRows, { count: preview.extraRowsCount })}`
                : ''}
            </p>
            {banner}
            {requiredProblems.map(item => (
              <p key={item.title} className="seneca-ct__hint seneca-ct__hint--warning">
                {item.unmapped
                  ? fill(labels.requiredUnmapped, { column: item.title })
                  : fill(labels.requiredBlank, { column: item.title, count: item.blank })}
              </p>
            ))}
            {issueCount ? (
              <p className="seneca-ct__hint seneca-ct__hint--warning">
                {fill(labels.issuesKept, { count: issueCount })}
              </p>
            ) : null}
            {preview.formulas.total ? (
              <p className="seneca-ct__hint">
                {fill(labels.formulasSummary, {
                  done: preview.formulas.carried,
                  total: preview.formulas.total,
                })}
              </p>
            ) : null}
            <div className="seneca-ct__preview-scroll">
              <table className="seneca-ct__preview">
                <thead>
                  <tr>
                    {visibleColumns.map(column => (
                      <th key={column.sourceIndex}>
                        {column.mode === 'new' ? column.newTitle || column.label : column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map(row => (
                    <tr key={row.id}>
                      {row.cells.map((cell, index) => (
                        <td
                          key={`${row.id}:${cell.sourceIndex ?? index}`}
                          className={cell.error ? 'seneca-ct__preview-warning' : undefined}
                        >
                          {cell.sourceIndex === null ? (
                            cell.value
                          ) : (
                            <input
                              className="seneca-ct__preview-input"
                              value={cell.value}
                              aria-label={`${row.rowIndex + 1}:${cell.sourceIndex}`}
                              onChange={event =>
                                paste.handlePasteCellChange(
                                  row.rowIndex,
                                  cell.sourceIndex as number,
                                  event.target.value,
                                )
                              }
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SnapshotSkeleton>
      )}
    </ModalShell>
  );
}
