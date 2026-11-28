'use client';

import Skeleton from '@mui/material/Skeleton';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { AppPagination } from '@/app/components/ui/pagination';
import { useIntlayer } from '@/app/i18n';
import { type AuditEvent, isEntityType } from '@/lib/api/audit';
import { buildGroupedData } from '../utils/audit-table-utils';
import { formatAuditEvent } from '../utils/formatAuditEvent';
import { relativeTime } from '../utils/relativeTime';

interface AuditTimelineProps {
  events: AuditEvent[];
  onSelect: (event: AuditEvent) => void;
  onRollback?: (event: AuditEvent) => void;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Who acted: a member by their name, the system or an integration by its label. */
const actorName = (event: AuditEvent): string => event.actor?.name || event.actorLabel;

/** One event on one line: who, did what, to what; when on the right. */
function AuditTimelineItem({
  event,
  onSelect,
  onRollback,
}: {
  event: AuditEvent;
  onSelect: (e: AuditEvent) => void;
  onRollback?: (e: AuditEvent) => void;
}) {
  const t = useIntlayer('auditUi');
  const formatted = formatAuditEvent(event);
  const entityLabel = isEntityType(event.entityType)
    ? (t.entityLabels[event.entityType]?.value ?? event.entityType)
    : event.entityType;

  return (
    <li className="audit-item">
      <button type="button" className="audit-body" onClick={() => onSelect(event)}>
        <span className="audit-line">
          <span className="audit-actor">{actorName(event)}</span>{' '}
          <span className="audit-verb">{formatted.actionVerb}</span>{' '}
          <span className="audit-what">{entityLabel}</span>
        </span>
        <span className="audit-when">{relativeTime(event.createdAt)}</span>
      </button>

      {event.isUndoable && onRollback && (
        <button type="button" className="audit-rollback-btn" onClick={() => onRollback(event)}>
          {t.rollback}
        </button>
      )}
    </li>
  );
}

function AuditBatchGroup({
  count,
  createdAt,
  expanded,
  onToggle,
}: {
  count: number;
  createdAt: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useIntlayer('auditUi');
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <li className="audit-item">
      <button type="button" className="audit-body" aria-expanded={expanded} onClick={onToggle}>
        <span className="audit-line audit-batch-header">
          <Chevron size={14} aria-hidden />
          {t.batchSummary.value.replace('{count}', String(count))}
        </span>
        <span className="audit-when">{relativeTime(createdAt)}</span>
      </button>
    </li>
  );
}

const SKELETON_ROW_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];

export function AuditTimelineSkeleton(): React.JSX.Element {
  return (
    <ol className="audit-list">
      {SKELETON_ROW_KEYS.map(key => (
        <li className="audit-item" key={key}>
          <span className="audit-body">
            <Skeleton variant="text" width={240} height={20} />
            <Skeleton variant="text" width={48} height={20} />
          </span>
        </li>
      ))}
    </ol>
  );
}

export function AuditTimeline({
  events,
  onSelect,
  onRollback,
  page,
  limit,
  total,
  onPageChange,
}: AuditTimelineProps) {
  const t = useIntlayer('auditUi');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const rows = useMemo(() => buildGroupedData(events, expandedBatches), [events, expandedBatches]);

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  if (rows.length === 0) {
    return <div className="audit-empty">{t.noEvents}</div>;
  }

  return (
    <>
      <ol className="audit-list">
        {rows.map(row => {
          if (row.type === 'group') {
            return (
              <AuditBatchGroup
                key={row.id}
                count={row.count}
                createdAt={row.createdAt}
                expanded={expandedBatches.has(row.batchId)}
                onToggle={() => toggleBatch(row.batchId)}
              />
            );
          }
          return (
            <AuditTimelineItem
              key={row.id}
              event={row.event}
              onSelect={onSelect}
              onRollback={onRollback}
            />
          );
        })}
      </ol>

      {totalPages > 1 ? (
        <div className="audit-pagination">
          <span>
            {t.pageOf.value.replace('{page}', String(page)).replace('{total}', String(totalPages))}
          </span>
          <AppPagination page={page} total={totalPages} onChange={onPageChange} size="small" />
        </div>
      ) : null}
    </>
  );
}
