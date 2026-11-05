'use client';

import { useMemo } from 'react';
import { type GridColumnDef } from '@/app/components/data-grid';
import { Checkbox } from '@/app/components/ui/checkbox';
import { AggregateFooter } from '../components/AggregateFooter';
import { ColumnMenu } from '../components/ColumnHeader';
import { EditableCell } from '../components/cells/EditableCell';
import { isNumericColumn } from '../components/cells/formatCell';
import type { TableGridProps } from '../components/TableGrid';
import { isMissingRequiredCell } from '../helpers/draftRowHelpers';
import { type CustomTableGridRow } from '../utils/types';

export const useGridColumns = (
  props: TableGridProps,
): GridColumnDef<CustomTableGridRow, unknown>[] => {
  const { columns, fallbackCurrency, labels, onUpdateCell, onEditColumn, onDeleteColumn } = props;
  const { sourceKind } = props;
  const { aggregates, aggregateValues, onAggregateChange } = props;
  return useMemo(() => {
    // Row number at rest, the selection checkbox on hover, focus or while selecting.
    const rowNumber: GridColumnDef<CustomTableGridRow, unknown> = {
      id: '__row',
      size: 52,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <span className="seneca-ct__row-select">
          <span className="seneca-ct__row-number" aria-hidden>
            #
          </span>
          <Checkbox
            className="seneca-ct__row-checkbox"
            aria-label={labels.selectAll}
            checked={table.getIsAllRowsSelected()}
            indeterminate={!table.getIsAllRowsSelected() && table.getIsSomeRowsSelected()}
            onCheckedChange={value => table.toggleAllRowsSelected(value)}
          />
        </span>
      ),
      meta: { align: 'center', className: 'seneca-ct__row-number-cell', label: labels.rowNumber },
      cell: ({ row }) => (
        <span className="seneca-ct__row-select">
          <span className="seneca-ct__row-number">{row.original.rowNumber}</span>
          <Checkbox
            className="seneca-ct__row-checkbox"
            aria-label={labels.selectRow}
            checked={row.getIsSelected()}
            onCheckedChange={value => row.toggleSelected(value)}
            onClick={event => event.stopPropagation()}
          />
        </span>
      ),
    };
    const dataColumns = columns.map<GridColumnDef<CustomTableGridRow, unknown>>(column => ({
      id: column.key,
      accessorFn: row => row.data?.[column.key],
      size: column.width ?? (isNumericColumn(column) ? 140 : 200),
      header: () => (
        <span className="seneca-ct__col-title" title={column.title}>
          {column.title}
          {column.isRequired ? <span className="seneca-ct__col-required">*</span> : null}
        </span>
      ),
      meta: {
        align: isNumericColumn(column) ? 'end' : 'start',
        className: isNumericColumn(column) ? 'seneca-grid__cell--numeric' : undefined,
        label: column.title,
        headerActions: (
          <ColumnMenu
            column={column}
            labels={labels}
            onEdit={onEditColumn}
            onDelete={onDeleteColumn}
            total={
              isNumericColumn(column)
                ? {
                    value: aggregates[column.key] ?? null,
                    onChange: fn => onAggregateChange(column.key, fn),
                  }
                : undefined
            }
          />
        ),
      },
      cell: ({ row }) => (
        <EditableCell
          column={column}
          row={row.original}
          fallbackCurrency={fallbackCurrency}
          missingRequired={isMissingRequiredCell(row.original, column)}
          onUpdate={onUpdateCell}
          labels={labels}
          sourceKind={sourceKind}
        />
      ),
      footer: isNumericColumn(column)
        ? () => (
            <AggregateFooter
              column={column}
              fallbackCurrency={fallbackCurrency}
              aggregates={aggregates}
              aggregateValues={aggregateValues}
              onAggregateChange={onAggregateChange}
              labels={labels}
            />
          )
        : undefined,
    }));
    return [rowNumber, ...dataColumns];
  }, [
    columns,
    fallbackCurrency,
    sourceKind,
    labels,
    onUpdateCell,
    onEditColumn,
    onDeleteColumn,
    aggregates,
    aggregateValues,
    onAggregateChange,
  ]);
};
