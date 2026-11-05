'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { type GridColumnDef } from '@/app/components/data-grid';
import { ExternalLink, Trash2 } from '@/app/components/icons';

import { Button } from '@/app/components/ui/button';

import { useCategoryName } from '@/app/lib/use-category-name';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { type ListLabels } from '../labels';
import type { SourceKind } from '../sources';
import { type TableListItem } from './useTablesList';

export function useListColumns(labels: ListLabels, onDelete: (item: TableListItem) => void) {
  const router = useRouter();
  const categoryName = useCategoryName();
  return useMemo<GridColumnDef<TableListItem, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: row => row.name,
        header: labels.columns.name,
        size: 320,
        meta: { skeleton: { shape: 'text', width: 120 } },
        cell: ({ row }) => (
          <span className="seneca-ct__cell">
            <span className="seneca-ct__cell-text">
              <span className="seneca-ct__list-name">{row.original.name}</span>
              {row.original.description ? (
                <span className="seneca-ct__list-sub">{row.original.description}</span>
              ) : null}
            </span>
          </span>
        ),
      },
      {
        id: 'source',
        accessorFn: row => row.source,
        header: labels.columns.source,
        size: 150,
        meta: { skeleton: { shape: 'rounded', width: 57, height: 20, radius: '999px' } },
        cell: ({ row }) => {
          const kind = row.original.sourceBinding?.kind as SourceKind | undefined;
          let label = row.original.source;
          if (kind) {
            label = labels.create.sources[kind]?.name ?? kind;
          } else if (row.original.source === 'manual') {
            label = labels.actions.sourceManual;
          }
          return <span className="seneca-ct__badge seneca-ct__badge--neutral">{label}</span>;
        },
      },
      {
        id: 'category',
        accessorFn: row => row.category?.name ?? '',
        header: labels.columns.category,
        size: 160,
        cell: ({ row }) => (row.original.category ? categoryName(row.original.category.name) : '—'),
      },
      {
        id: 'rows',
        accessorFn: row => row.rowsCount ?? -1,
        header: labels.columns.rows,
        size: 90,
        sortFn: 'basic',
        meta: {
          align: 'end',
          className: 'seneca-grid__cell--numeric',
          skeleton: { shape: 'text', width: 16 },
        },
        cell: ({ row }) => (row.original.rowsCount === undefined ? '…' : row.original.rowsCount),
      },
      {
        id: 'updated',
        accessorFn: row => row.updatedAt,
        header: labels.columns.updated,
        size: 130,
        sortFn: 'datetime',
        cell: ({ row }) => formatStoredDate(new Date(row.original.updatedAt)),
      },
      {
        id: 'actions',
        header: '',
        size: 110,
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'end', label: labels.actions.rowActions, skeleton: { shape: 'none' } },
        cell: ({ row }) => (
          <span className="seneca-ct__list-actions">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`${labels.actions.open}: ${row.original.name}`}
              onClick={event => {
                event.stopPropagation();
                router.push(`/custom-tables/${row.original.id}`);
              }}
            >
              <ExternalLink size={16} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`${labels.actions.delete}: ${row.original.name}`}
              onClick={event => {
                event.stopPropagation();
                onDelete(row.original);
              }}
            >
              <Trash2 size={16} aria-hidden />
            </Button>
          </span>
        ),
      },
    ],
    [labels, router, onDelete, categoryName],
  );
}
