'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { Plus } from '@/app/components/icons';
import { useQuickActions } from '@/app/components/mobile/quick-actions-store';
import { Button } from '@/app/components/ui/button';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { useAuth } from '@/app/hooks/useAuth';
import { useTags } from '@/app/hooks/useTags';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { PayableDirection } from '@/app/lib/payables-api';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { tokens } from '@/lib/theme-tokens';
import { dueDateSpan, payableFilterExtras } from '../filters/filter-summary';
import { TransactionsPageTitle } from '../TransactionsPageTitle';
import { CreatePayableDrawer } from './CreatePayableDrawer';
import { usePayableActions } from './hooks/usePayableActions';
import { PAGE_SIZE, usePayablesData } from './hooks/usePayablesData';
import { usePayablesFilters } from './hooks/usePayablesFilters';
import { usePayablesLabels } from './hooks/usePayablesLabels';
import { MarkPaidDialog } from './MarkPaidDialog';
import PayableFiltersBar from './PayableFiltersBar';
import PayableSummaryCards from './PayableSummaryCards';
import { PayablesListLoading } from './PayablesListLoading';
import { PayablesViewSkeleton } from './PayablesViewSkeleton';
import { DEFAULT_PAYABLES_FILTERS } from './payables-utils';

const PayablesNotice = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="container-shared" style={{ padding: '40px 16px' }}>
    <div
      style={{
        borderRadius: tokens.radius.lg,
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        padding: 24,
        fontSize: 14,
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </div>
  </div>
);

type PayablesViewProps = {
  /** Which side of the ledger this view manages. Defaults to money the workspace owes. */
  direction?: PayableDirection;
};

export function PayablesView({ direction = 'payable' }: PayablesViewProps = {}): React.JSX.Element {
  useAttentionFocus();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { locale } = useLocale();
  const titleText = useIntlayer('transactionsPageTitle');
  const tagsText = useIntlayer('tagsPage');
  const { data: tags } = useTags();
  const router = useRouter();
  const { labels, tx } = usePayablesLabels(direction);
  const { filters, page, setPage, queryPage, setQueryPage, handleFiltersChange, handlePageChange } =
    usePayablesFilters();
  const { summary, items, total, totalPages, loading, loadData } = usePayablesData({
    direction,
    filters,
    queryPage,
    setPage,
    setQueryPage,
    loadFailedMessage: labels.toasts.loadFailed,
  });
  const actions = usePayableActions({
    direction,
    reload: () => loadData({ silent: true }),
    toasts: labels.toasts,
  });
  useQuickActions([{ id: 'add', label: labels.add, icon: Plus, run: actions.openCreateDrawer }]);

  if (authLoading || workspaceLoading) {
    return <PayablesViewSkeleton direction={direction} />;
  }

  if (!user) {
    return <PayablesNotice>{labels.loginRequired}</PayablesNotice>;
  }

  if (!currentWorkspace) {
    return <PayablesNotice>{labels.noWorkspace}</PayablesNotice>;
  }

  return (
    <>
      <div className="container-shared seneca-stmt-list">
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div className="seneca-stmt-toolbar" style={{ width: '100%' }}>
              <TransactionsPageTitle
                page={direction === 'receivable' ? 'income' : 'expenses'}
                span={dueDateSpan(filters.dueDateFrom, filters.dueDateTo)}
                extras={payableFilterExtras(filters, {
                  labels: {
                    search: resolveLabel(getNestedValue(titleText, ['search'])),
                    status: labels.filters.status,
                    source: labels.filters.source,
                    tag: tagsText.title.value,
                  },
                  statusOptions: labels.filters.statusOptions,
                  sourceOptions: labels.filters.sourceOptions,
                  tagOptions: Object.fromEntries((tags ?? []).map(tag => [tag.id, tag.name])),
                })}
              />
              <div className="seneca-stmt-toolbar__group">
                <PayableFiltersBar
                  value={filters}
                  onChange={handleFiltersChange}
                  onReset={() => handleFiltersChange(DEFAULT_PAYABLES_FILTERS)}
                  labels={labels.filters}
                />
                {/* Keeps the primary actions from reading as more filter buttons. */}
                <span aria-hidden className="seneca-stmt-toolbar__divider" />
                {/* One primary action per page; the bank check is secondary. */}
                <Button variant="ghost" onClick={() => router.push('/statements/reconcile')}>
                  {tx(['payables', 'reconcile'])}
                </Button>
                <Button className="seneca-bottom-bar-source" onClick={actions.openCreateDrawer}>
                  <Plus size={18} aria-hidden />
                  {labels.add}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            minHeight: 0,
            flex: 1,
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            paddingBottom: 8,
          }}
        >
          <PayableSummaryCards
            summary={loading ? null : summary}
            locale={locale}
            currency={(currentWorkspace.currency || FALLBACK_CURRENCY).toUpperCase()}
            direction={direction}
            labels={labels.summary}
          />

          <PayablesListLoading
            items={loading ? null : items}
            locale={locale}
            emptyTitle={labels.emptyTitle}
            emptyDescription={labels.emptyDescription}
            emptyIllustration={direction === 'receivable' ? 'receivables' : 'payables'}
            labels={labels.list}
            pagination={{
              page,
              totalPages,
              totalItems: total,
              pageSize: PAGE_SIZE,
              onPageChange: handlePageChange,
            }}
            actionState={{
              markingPaidId: actions.markingPaidId,
              archivingId: actions.archivingId,
              deletingId: actions.deletingId,
            }}
            onEdit={actions.handleEdit}
            onMarkPaid={actions.handleMarkPaid}
            onArchive={actions.handleArchive}
            onDelete={actions.handleDelete}
          />
        </div>
      </div>

      <MarkPaidDialog
        removingPaymentId={actions.removingPaymentId}
        onRemovePayment={(payable, paymentId) => void actions.removePayment(payable, paymentId)}
        payable={actions.payingPayable}
        submitting={actions.markingPaidId !== null}
        onClose={() => actions.setPayingPayable(null)}
        onConfirm={(payable, result) => void actions.confirmMarkPaid(payable, result)}
      />

      <CreatePayableDrawer
        open={actions.drawerOpen}
        payable={actions.editingPayable}
        defaultCurrency={(currentWorkspace.currency || FALLBACK_CURRENCY).toUpperCase()}
        saving={actions.saving}
        onClose={actions.closeDrawer}
        onSubmit={actions.handleSave}
        labels={labels.drawer}
      />
    </>
  );
}
