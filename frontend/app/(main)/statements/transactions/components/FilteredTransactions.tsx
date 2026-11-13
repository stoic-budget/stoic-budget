'use client';

import type React from 'react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import DetailsDrawer from '@/app/components/transactions/DetailsDrawer';
import {
  fromStatementTransaction,
  mapApiRecordToTransaction,
} from '@/app/components/transactions/helpers/transactionMapper';
import { useBulkUpdateCategory } from '@/app/components/transactions/hooks/useBulkUpdateCategory';
import type { Transaction } from '@/app/components/transactions/types';
import { AppPagination } from '@/app/components/ui/pagination';
import { useIntlayer } from '@/app/i18n';
import type { ListedRow } from '../all-transactions';
import { type TransactionsFilter, useFilteredTransactions } from '../hooks/useFilteredTransactions';
import { AllTransactionsTable } from './AllTransactionsTable';

const PAGE_SIZE = 25;

/**
 * The rows a filter picks (a payee's, a category's), as All transactions lists
 * them: the same table, the same drawer, the same bulk category change. A new
 * filter starts again on the first page.
 */
export function FilteredTransactions(props: {
  filter: TransactionsFilter;
  title: React.ReactNode;
  empty: React.ReactNode;
  /** Beside the title: what narrows the list, and how to undo it. */
  aside?: React.ReactNode;
}): React.JSX.Element {
  const key = JSON.stringify(props.filter);
  return <FilteredList key={key} {...props} />;
}

function FilteredList({
  filter,
  title,
  empty,
  aside,
}: {
  filter: TransactionsFilter;
  title: React.ReactNode;
  empty: React.ReactNode;
  aside?: React.ReactNode;
}): React.JSX.Element {
  const tPage = useIntlayer('transactionsPageView');
  const tAll = useIntlayer('allTransactionsPage');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { list, categories, budgetByCategory } = useFilteredTransactions(filter, page, PAGE_SIZE);
  const bulkUpdateCategory = useBulkUpdateCategory();

  const rows = list.data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  const setCategory = async (ids: string[], categoryId: string): Promise<boolean> => {
    try {
      await bulkUpdateCategory.mutateAsync({ txIds: ids, categoryId });
      toast.success(tPage.categoryUpdated.value);
      return true;
    } catch {
      toast.error(tPage.categoryUpdateFailed.value);
      return false;
    }
  };
  const toggle = (id: string) => {
    const ids = new Set(selected);
    if (!ids.delete(id)) {
      ids.add(id);
    }
    setSelected(ids);
  };
  const openRow = (row: ListedRow) => {
    setOpened(mapApiRecordToTransaction(fromStatementTransaction(row)));
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setOpened(null), 300);
  };
  // The drawer reads the row from the refreshed list, not the copy taken on open.
  const liveRow = opened ? rows.find(row => row.id === opened.id) : undefined;
  const open = useMemo(
    () => (liveRow ? mapApiRecordToTransaction(fromStatementTransaction(liveRow)) : opened),
    [liveRow, opened],
  );

  return (
    <section className="seneca-all-tx__card seneca-all-tx__list">
      <div className="seneca-all-tx__list-head">
        <h2 className="seneca-all-tx__card-title">{title}</h2>
        {aside}
      </div>
      {!list.isPending && rows.length === 0 ? (
        <p className="seneca-all-tx__state seneca-all-tx__muted">{empty}</p>
      ) : (
        <AllTransactionsTable
          loading={list.isPending}
          rows={rows}
          categories={categories}
          budgetByCategory={budgetByCategory}
          selected={selected}
          onToggle={toggle}
          onToggleAll={checked => setSelected(new Set(checked ? rows.map(row => row.id) : []))}
          onSetCategory={(ids, categoryId) => {
            void setCategory(ids, categoryId).then(done => done && setSelected(new Set()));
          }}
          onOpen={openRow}
        />
      )}
      {totalPages > 1 ? (
        <AppPagination
          className="seneca-all-tx__pagination"
          page={page}
          total={totalPages}
          onChange={next => {
            setPage(next);
            setSelected(new Set());
          }}
        />
      ) : null}

      <DetailsDrawer
        open={drawerOpen}
        transaction={open}
        categories={categories}
        onClose={closeDrawer}
        onUpdateCategory={async (txId, categoryId) => {
          await setCategory([txId], categoryId);
        }}
        onSplitDone={closeDrawer}
        source={
          liveRow?.statementId
            ? { href: `/statements/${liveRow.statementId}/edit`, name: tAll.openDocument.value }
            : undefined
        }
        onChanged={closeDrawer}
      />
    </section>
  );
}
