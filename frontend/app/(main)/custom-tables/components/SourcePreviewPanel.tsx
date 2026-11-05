'use client';

import Link from 'next/link';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useLocale } from '@/app/i18n';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import { resolveLocaleTag } from '@/app/lib/user-format';
import type { SourcePreview } from '../hooks/useSourcePreview';
import { type SourceDef } from '../sources';
import type { SourceFilterPanelLabels } from './source-filter-labels';
import { ENUM_FIELDS, formatPreviewCell } from './source-preview-format';

const SAMPLE_ROWS = 5;

function PreviewSample({
  preview,
  fields,
  labels,
}: {
  preview: SourcePreview;
  fields: string[];
  labels: SourceFilterPanelLabels;
}) {
  const { locale } = useLocale();
  const tag = resolveLocaleTag(locale);
  const columns = fields
    .map(field => preview.columns.find(column => column.field === field))
    .filter((column): column is SourcePreview['columns'][number] => Boolean(column));
  const numeric = (type: string) => type === 'currency' || type === 'number';
  const colClass = (column: SourcePreview['columns'][number]): string | undefined => {
    if (column.type === 'date') return 'seneca-ct__preview-col--date';
    if (numeric(column.type)) return 'seneca-ct__preview-col--money';
    if (ENUM_FIELDS.has(column.field)) return 'seneca-ct__preview-col--enum';
    return undefined;
  };
  const rows = preview.rows.slice(0, SAMPLE_ROWS);
  const privacy = usePrivacyMode();
  return (
    <>
      <table className="seneca-ct__preview-table">
        <colgroup>
          {columns.map(column => (
            <col key={column.field} className={colClass(column)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.field}
                className={numeric(column.type) ? 'seneca-ct__preview-cell--numeric' : undefined}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${String(row[columns[0]?.field ?? ''] ?? '')}`}>
              {columns.map(column => {
                const text = formatPreviewCell(row[column.field], column, row, tag, labels.options);
                return (
                  <td
                    key={column.field}
                    // In privacy mode the tooltip would give the amount away.
                    title={privacy && numeric(column.type) ? undefined : text}
                    className={
                      numeric(column.type)
                        ? `seneca-ct__preview-cell--numeric ${PRIVATE_CLASS}`
                        : undefined
                    }
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="seneca-ct__preview-caption">
        {labels.preview.sample
          .replace('{{shown}}', String(rows.length))
          .replace('{{count}}', String(preview.count))}
      </p>
    </>
  );
}

interface SourcePreviewPanelProps {
  source: SourceDef;
  sourceName: string;
  preview: SourcePreview | null;
  /** Rows of the source without filters; null while unknown or when no filter is set. */
  total: number | null;
  loading: boolean;
  error: boolean;
  /** A table already filled from this source, which this one would duplicate. */
  existing: { id: string; name: string } | null;
  onResetFilters: (() => void) | null;
  labels: SourceFilterPanelLabels;
}

/**
 * What will be created, beside the filters so it changes as they do: the
 * source and its column count, the row count, what a refresh rewrites, and a
 * few rows formatted as the table will show them.
 */
export function SourcePreviewPanel(props: SourcePreviewPanelProps) {
  const { source, sourceName, preview, total, loading, error, existing, onResetFilters, labels } =
    props;
  const count = preview?.count ?? 0;

  let countText: string;
  if (error) {
    countText = labels.preview.failed;
  } else if (!preview && loading) {
    countText = labels.preview.loading;
  } else if (!preview || count === 0) {
    countText = labels.preview.empty;
  } else if (total !== null && total !== count) {
    countText = labels.preview.countOf
      .replace('{{count}}', String(count))
      .replace('{{total}}', String(total));
  } else {
    countText = labels.preview.count.replace('{{count}}', String(count));
  }

  return (
    <section className="seneca-ct__preview-pane" aria-label={labels.preview.title}>
      <p className="seneca-ct__preview-source">
        {labels.preview.sourceLine
          .replace('{{name}}', sourceName)
          .replace('{{count}}', String(source.columnFields.length))}
      </p>
      {existing ? (
        <p className="seneca-ct__preview-existing">
          <span className="seneca-ct__preview-dot" aria-hidden="true" />
          <span>
            {labels.preview.existing.replace('{{name}}', existing.name)}{' '}
            <Link href={`/custom-tables/${existing.id}`}>{labels.preview.openExisting}</Link>
          </span>
        </p>
      ) : null}
      <div className="seneca-ct__preview-head">
        <span
          className="seneca-ct__preview-count"
          aria-live="polite"
          aria-busy={loading}
          data-loading={loading || undefined}
        >
          {countText}
        </span>
        {onResetFilters ? (
          <button type="button" className="seneca-ct__text-button" onClick={onResetFilters}>
            {labels.preview.resetFilters}
          </button>
        ) : null}
      </div>
      <p className="seneca-ct__preview-note">{labels.preview.overwriteNote}</p>
      {preview && count > 0 ? (
        <PreviewSample preview={preview} fields={source.previewFields} labels={labels} />
      ) : null}
    </section>
  );
}
