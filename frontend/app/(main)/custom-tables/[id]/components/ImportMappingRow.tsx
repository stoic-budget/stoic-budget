'use client';

import { Select } from '@/app/components/ui/select';
import { configChip, fill, IGNORE, NEW, selectionValue } from '../utils/importPreviewHelpers';
import { configForType, fieldForType } from '../utils/importTypes';
import type { PasteColumnMapping, PasteMappingSelection } from '../utils/pasteTypes';
import type { ColumnType, CustomTableColumn } from '../utils/types';
import type { ImportPreviewLabels } from './ImportPreviewDialog';

/** Типы, которые импорт умеет заполнить из текста; формулы и связи задаются потом руками. */
const IMPORT_TYPES: ColumnType[] = ['text', 'number', 'currency', 'date', 'boolean', 'select'];

export function ImportMappingRow({
  mapping,
  columns,
  onChange,
  labels,
  typeLabels,
}: {
  mapping: PasteColumnMapping;
  columns: CustomTableColumn[];
  onChange: (selection: PasteMappingSelection) => void;
  labels: ImportPreviewLabels;
  typeLabels: Record<string, string>;
}) {
  const sourceIndex = mapping.sourceIndex;
  if (sourceIndex === null) {
    return null;
  }
  const value = selectionValue(mapping);
  const asNew = (patch: Partial<PasteMappingSelection>): PasteMappingSelection => ({
    mode: 'new',
    newTitle: mapping.newTitle ?? mapping.label,
    newType: mapping.newType,
    newConfig: mapping.newConfig,
    field: mapping.field,
    ...patch,
  });
  const chip = configChip(mapping, labels.optionsCount);
  const formula = mapping.formula;
  const formulaTitle = formula
    ? formula.expression && mapping.newType === 'formula'
      ? fill(labels.formulaCarried, {}).replace('{{expression}}', formula.expression)
      : fill(labels.formulaSkipped, {}).replace('{{reason}}', formula.reason ?? formula.excel)
    : undefined;
  const typeOptions = IMPORT_TYPES.concat(mapping.newConfig?.expression ? ['formula'] : []);
  return (
    <li className="seneca-ct__map-row">
      <span className="seneca-ct__map-source" title={mapping.label}>
        {mapping.label}
      </span>
      <Select
        size="small"
        inputProps={{ 'aria-label': `${labels.target}: ${mapping.label}` }}
        value={value}
        onChange={next => {
          if (next === IGNORE) {
            onChange({ mode: 'ignore' });
          } else if (next === NEW) {
            onChange(asNew({}));
          } else {
            onChange({ mode: 'existing', columnKey: next });
          }
        }}
        options={[
          { value: IGNORE, label: labels.ignore },
          { value: NEW, label: labels.newColumn },
          ...columns.map(column => ({ value: column.key, label: column.title })),
        ]}
      />
      {mapping.mode === 'new' ? (
        <>
          <input
            className="seneca-ct__input seneca-ct__input--compact"
            aria-label={labels.newColumnTitle}
            placeholder={labels.newColumnTitle}
            defaultValue={mapping.newTitle ?? ''}
            onBlur={event => onChange(asNew({ newTitle: event.target.value }))}
          />
          <span className="seneca-ct__map-type">
            <Select
              size="small"
              inputProps={{ 'aria-label': `${labels.newColumnType}: ${mapping.label}` }}
              value={mapping.newType ?? 'text'}
              onChange={next => {
                const type = next as ColumnType;
                onChange(
                  asNew({
                    newType: type,
                    newConfig: configForType(type, mapping.newConfig),
                    field: fieldForType(type),
                  }),
                );
              }}
              options={typeOptions.map(type => ({ value: type, label: typeLabels[type] ?? type }))}
            />
            {chip ? (
              <span className="seneca-ct__map-chip" title={formulaTitle}>
                {chip}
              </span>
            ) : null}
            {formula && !(formula.expression && mapping.newType === 'formula') ? (
              <span
                className="seneca-ct__map-chip seneca-ct__map-chip--warning"
                title={formulaTitle}
              >
                ⚠ ƒ
              </span>
            ) : null}
          </span>
        </>
      ) : null}
    </li>
  );
}
