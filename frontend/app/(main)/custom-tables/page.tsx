'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { StatementsSearchPopover } from '@/app/(main)/statements/components/filters/StatementsSearchPopover';
import ConfirmModal from '@/app/components/ConfirmModal';
import { DataGrid, useDataGrid } from '@/app/components/data-grid';
import { Plus } from '@/app/components/icons';
import { useQuickActions } from '@/app/components/mobile/quick-actions-store';
import { Button } from '@/app/components/ui/button';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { joinSummary, PageTitle } from '@/app/components/ui/page-title';
import { AppPagination } from '@/app/components/ui/pagination';
import { Select } from '@/app/components/ui/select';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { CreateTableDialog } from './components/CreateTableDialog';
import { useCreateTable } from './hooks/useCreateTable';
import { useListColumns } from './hooks/useListColumns';
import { type SourceFilter, type TableListItem, useTablesList } from './hooks/useTablesList';
import { buildListLabels } from './labels';

export default function CustomTablesPage() {
  const t = useIntlayer('customTablesPage');
  const labels = useMemo(() => buildListLabels(t), [t]);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const list = useTablesList({
    enabled: !authLoading && Boolean(user),
    messages: {
      loadFailed: labels.toasts.loadTablesFailed,
      deleted: labels.toasts.deleted,
      deleteFailed: labels.toasts.deleteFailed,
    },
  });
  const create = useCreateTable({
    columnTitles: labels.create.columnTitles,
    messages: {
      created: labels.toasts.created,
      createdFromSource: labels.toasts.createdFromSource,
      createFailed: labels.toasts.createFailed,
      applying: labels.create.applying,
      partialFailed: labels.create.partialFailed,
    },
  });
  useQuickActions([
    {
      id: 'new-table',
      label: labels.actions.newTable,
      icon: Plus,
      run: () => create.setOpen(true),
    },
  ]);
  const [deleteTarget, setDeleteTarget] = useState<TableListItem | null>(null);
  const columns = useListColumns(labels, setDeleteTarget);
  const table = useDataGrid<TableListItem>({
    data: list.items,
    columns,
    getRowId: row => row.id,
    initialState: { sorting: [{ id: 'updated', desc: true }] },
  });

  return (
    <div className="seneca-ct">
      <PageTitle
        path="/custom-tables"
        summary={joinSummary([
          list.searchQuery.trim() && `“${list.searchQuery.trim()}”`,
          list.sourceFilter === 'manual' && labels.actions.sourceManual,
        ])}
      />
      <div className="seneca-ct__toolbar">
        <span data-tour-id="search-bar">
          <StatementsSearchPopover
            value={list.searchQuery}
            onApply={list.setSearchQuery}
            applyLabel={labels.actions.apply}
            hint={labels.actions.searchHint}
          />
        </span>
        <div className="seneca-ct__actions">
          <Select
            data-tour-id="custom-tables-source-filter"
            inputProps={{ 'aria-label': labels.columns.source }}
            value={list.sourceFilter}
            onChange={next => list.setSourceFilter(next as SourceFilter)}
            options={[
              { value: 'all', label: labels.actions.sourceAll },
              { value: 'manual', label: labels.actions.sourceManual },
            ]}
          />
          <Button
            size="sm"
            type="button"
            className="seneca-bottom-bar-source"
            data-tour-id="custom-tables-create-export"
            onClick={() => create.setOpen(true)}
          >
            <Plus size={18} aria-hidden />
            {labels.actions.newTable}
          </Button>
        </div>
      </div>
      <div data-tour-id="tables-list">
        <DataGrid
          table={table}
          caption={labels.actions.caption}
          loading={authLoading || list.loading}
          skeletonRows={6}
          onRowClick={row => router.push(`/custom-tables/${row.original.id}`)}
          emptyState={
            <EmptyState
              illustration="tables"
              size="sm"
              title={labels.empty.title}
              description={labels.empty.description}
              action={
                <Button size="sm" type="button" onClick={() => create.setOpen(true)}>
                  <Plus size={18} aria-hidden />
                  {labels.actions.newTable}
                </Button>
              }
              compact
            />
          }
        />
      </div>
      {list.totalPages > 1 ? (
        <div data-tour-id="pagination">
          <AppPagination page={list.page} total={list.totalPages} onChange={list.setPage} />
        </div>
      ) : null}
      <CreateTableDialog
        open={create.open}
        form={create.form}
        setForm={create.setForm}
        creating={create.creating}
        categories={list.categories}
        existingTables={list.allTables}
        onSubmit={() => void create.submit()}
        onClose={create.close}
        labels={labels.create}
      />
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void list.deleteTable(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title={labels.confirmDelete.title}
        message={
          deleteTarget?.name
            ? `${labels.confirmDelete.messageWithNamePrefix}${deleteTarget.name}${labels.confirmDelete.messageWithNameSuffix}`
            : labels.confirmDelete.messageNoName
        }
        confirmText={labels.confirmDelete.confirm}
        cancelText={labels.confirmDelete.cancel}
        isDestructive
      />
    </div>
  );
}
