import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearManualPrefill, DUPLICATE_PARAM } from '@/app/lib/manual-expense-prefill';
import {
  type OpenExpenseDrawerEventDetail,
  resolveExpenseDrawerMode,
  STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT,
  type StatementExpenseMode,
} from '@/app/lib/statement-expense-drawer';

/**
 * The expense drawer, opened from anywhere in the app (an event naming its
 * mode) or by a link (`?openExpenseDrawer=scan`, dropped from the URL once
 * read). A duplicated row's draft is kept only for a link marked
 * `duplicate=1`, and dropped when the drawer closes.
 */
export function useExpenseDrawerRequests({
  router,
  searchParams,
}: {
  router: AppRouterInstance;
  searchParams: ReadonlyURLSearchParams;
}) {
  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [expenseDrawerMode, setExpenseDrawerMode] = useState<StatementExpenseMode>('scan');

  // Open expense drawer from event
  useEffect(() => {
    const handleOpen = (event: Event): void => {
      const detail = (event as CustomEvent<OpenExpenseDrawerEventDetail>).detail;
      clearManualPrefill();
      setExpenseDrawerMode(resolveExpenseDrawerMode(detail?.mode));
      setExpenseDrawerOpen(true);
    };
    window.addEventListener(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, handleOpen);
    return () => window.removeEventListener(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, handleOpen);
  }, []);

  // Open expense drawer from URL params
  useEffect(() => {
    const requestedMode = searchParams.get('openExpenseDrawer');
    if (!requestedMode) {
      return;
    }
    if (searchParams.get(DUPLICATE_PARAM) !== '1') {
      clearManualPrefill();
    }
    setExpenseDrawerMode(resolveExpenseDrawerMode(requestedMode));
    setExpenseDrawerOpen(true);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('openExpenseDrawer');
    nextParams.delete(DUPLICATE_PARAM);
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/statements/submit?${nextQuery}` : '/statements/submit');
  }, [searchParams, router]);

  // Closing (or leaving the page with it open) drops the duplicated draft.
  useEffect(() => {
    if (!expenseDrawerOpen) {
      return;
    }
    return () => clearManualPrefill();
  }, [expenseDrawerOpen]);

  return { expenseDrawerOpen, setExpenseDrawerOpen, expenseDrawerMode };
}
