'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { LoadError } from '@/app/components/ui/load-error';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import type { AuditEvent, AuditEventFilter } from '@/lib/api/audit';
import { rollbackEvent } from '@/lib/api/audit';
import { AuditEventModal } from '../audit/components/AuditEventModal';
import { AuditFilterBar } from '../audit/components/AuditFilterBar';
import { AuditTimeline, AuditTimelineSkeleton } from '../audit/components/AuditTimeline';
import { useAuditLoader } from '../audit/hooks/useAuditLoader';
import { assertRollbackSucceeded } from '../audit/utils/rollback-result';
import { AdminHeader } from './components/AdminGroup';
import { AdminStatusRows } from './components/AdminStatusRows';

/**
 * The admin area's front page: for the server's administrator, the state of
 * parsing and of the server, a row each; for everyone who may open it, the
 * workspace's activity with its rollbacks.
 */
export default function AdminPage() {
  const t = useIntlayer('adminPage');
  const { user } = useAuth();
  const loader = useAuditLoader();

  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const handleDirectRollback = async (event: AuditEvent): Promise<void> => {
    setRollbackLoading(true);
    await rollbackEvent(event.id)
      .then(result => {
        assertRollbackSucceeded(result);
        toast.success(t.toasts.rollbackSuccess.value);
        setModalOpen(false);
        setSelectedEvent(null);
        loader.reload();
      })
      .catch(() => {
        toast.error(t.toasts.rollbackFailed.value);
      })
      .finally(() => {
        setRollbackLoading(false);
      });
  };

  const handleFiltersChange = (update: Partial<AuditEventFilter>) => {
    loader.setFilters(prev => ({ ...prev, ...update }));
    loader.setPage(1);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4, px: { xs: 2, md: 4 } }}>
      <AdminHeader title={t.title} />
      {user?.role === 'admin' ? <AdminStatusRows /> : null}

      <Box component="section">
        <Box
          component="h2"
          sx={{ fontSize: 15, fontWeight: 500, m: 0, mb: 1.5, color: 'var(--foreground)' }}
        >
          {t.auditTab.title}
        </Box>
        <div data-tour-id="admin-audit-filters">
          <AuditFilterBar filters={loader.filters} onFiltersChange={handleFiltersChange} />
        </div>
        {loader.error ? (
          <LoadError>{t.errors.loadAudit}</LoadError>
        ) : (
          <div
            className="audit-timeline-card"
            style={{ opacity: loader.isFetching ? 0.6 : 1, transition: 'opacity 150ms ease' }}
          >
            {loader.isPending ? (
              <AuditTimelineSkeleton />
            ) : (
              <AuditTimeline
                events={loader.events}
                onSelect={event => {
                  setSelectedEvent(event);
                  setModalOpen(true);
                }}
                page={loader.page}
                limit={loader.limit}
                total={loader.total}
                onPageChange={loader.setPage}
              />
            )}
          </div>
        )}
      </Box>

      <AuditEventModal
        event={selectedEvent}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onRollback={handleDirectRollback}
        rollbackLoading={rollbackLoading}
      />
    </Container>
  );
}
