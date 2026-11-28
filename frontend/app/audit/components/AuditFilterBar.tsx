'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from '@/app/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import {
  type ActorType,
  type AuditAction,
  type AuditEventFilter,
  ENTITY_TYPES,
  type EntityType,
} from '@/lib/api/audit';

/** Keys of the `auditUi` dictionary used as option labels. */
type LabelKey =
  | 'allUsers'
  | 'user'
  | 'system'
  | 'integration'
  | 'ai'
  | 'allActions'
  | 'actionCreate'
  | 'actionUpdate'
  | 'actionDelete'
  | 'actionImport'
  | 'actionExport'
  | 'actionLink'
  | 'actionUnlink'
  | 'actionMerge'
  | 'actionCategorize'
  | 'rollback'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days'
  | 'allTime';

type ActorTypeOption = { value: ActorType | ''; labelKey: LabelKey };
type ActionOption = { value: AuditAction | ''; labelKey: LabelKey };

const ACTOR_OPTIONS: ActorTypeOption[] = [
  { value: '', labelKey: 'allUsers' },
  { value: 'user', labelKey: 'user' },
  { value: 'system', labelKey: 'system' },
  { value: 'integration', labelKey: 'integration' },
  { value: 'ai', labelKey: 'ai' },
];

const ACTION_OPTIONS: ActionOption[] = [
  { value: '', labelKey: 'allActions' },
  { value: 'create', labelKey: 'actionCreate' },
  { value: 'update', labelKey: 'actionUpdate' },
  { value: 'delete', labelKey: 'actionDelete' },
  { value: 'import', labelKey: 'actionImport' },
  { value: 'export', labelKey: 'actionExport' },
  { value: 'link', labelKey: 'actionLink' },
  { value: 'unlink', labelKey: 'actionUnlink' },
  { value: 'match', labelKey: 'actionMerge' },
  { value: 'apply_rule', labelKey: 'actionCategorize' },
  { value: 'rollback', labelKey: 'rollback' },
];

type DatePreset = '7d' | '30d' | '90d' | 'all';

const DATE_PRESETS: { value: DatePreset; labelKey: LabelKey }[] = [
  { value: '7d', labelKey: 'last7Days' },
  { value: '30d', labelKey: 'last30Days' },
  { value: '90d', labelKey: 'last90Days' },
  { value: 'all', labelKey: 'allTime' },
];

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function presetToDates(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') {
    return {};
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return { dateFrom: daysAgoIso(days), dateTo: undefined };
}

function currentPreset(filters: AuditEventFilter): DatePreset {
  if (!filters.dateFrom) {
    return '7d';
  }
  const diff = Math.round((Date.now() - new Date(filters.dateFrom).getTime()) / 86_400_000);
  if (diff <= 7) {
    return '7d';
  }
  if (diff <= 30) {
    return '30d';
  }
  if (diff <= 90) {
    return '90d';
  }
  return 'all';
}

interface AuditFilterBarProps {
  filters: AuditEventFilter;
  onFiltersChange: (update: Partial<AuditEventFilter>) => void;
}

/** A quiet text button that opens a menu; it reads as active while a choice is in force. */
function MenuButton({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className={`audit-filter-button${active ? ' audit-filter-button--active' : ''}`}
      >
        {children}
        <ChevronDown size={16} aria-hidden />
      </button>
    </DropdownMenuTrigger>
  );
}

/**
 * Search across the row; after it, one "Filters" menu holding who, what and
 * which kind of record, each applied as it is picked, and the period.
 */
export function AuditFilterBar({ filters, onFiltersChange }: AuditFilterBarProps) {
  const t = useIntlayer('auditUi');
  const filterLabels = useIntlayer('adminPage').auditTab.filters;

  const [searchVal, setSearchVal] = useState(filters.actorLabel ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (val: string) => {
      setSearchVal(val);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ actorLabel: val || undefined });
      }, 300);
    },
    [onFiltersChange],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const activeCount = [filters.actorType, filters.action, filters.entityType].filter(
    Boolean,
  ).length;
  const preset = currentPreset(filters);
  const presetLabel = t[DATE_PRESETS.find(p => p.value === preset)?.labelKey ?? 'last7Days'];

  return (
    <div className="audit-filter-bar">
      <div className="audit-search-wrap">
        <Search size={14} />
        <input
          className="audit-search"
          placeholder={t.searchPlaceholder.value}
          value={searchVal}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      <DropdownMenu>
        <MenuButton active={activeCount > 0}>
          {filterLabels.title}
          {activeCount > 0 ? ` · ${activeCount}` : null}
        </MenuButton>
        <DropdownMenuContent align="end">
          <div className="audit-filter-panel">
            <label>
              {t.actor}
              <Select
                size="small"
                value={filters.actorType ?? ''}
                options={ACTOR_OPTIONS.map(o => ({ value: o.value, label: t[o.labelKey] }))}
                onChange={value =>
                  onFiltersChange({ actorType: (value || undefined) as ActorType })
                }
              />
            </label>
            <label>
              {t.action}
              <Select
                size="small"
                value={filters.action ?? ''}
                options={ACTION_OPTIONS.map(o => ({ value: o.value, label: t[o.labelKey] }))}
                onChange={value => onFiltersChange({ action: (value || undefined) as AuditAction })}
              />
            </label>
            <label>
              {t.entity}
              <Select
                size="small"
                value={filters.entityType ?? ''}
                options={[
                  { value: '', label: t.allEntityTypes },
                  ...ENTITY_TYPES.map(value => ({
                    value,
                    label: t.entityLabels[value]?.value ?? value,
                  })),
                ]}
                onChange={value =>
                  onFiltersChange({ entityType: (value || undefined) as EntityType })
                }
              />
            </label>
            {activeCount > 0 ? (
              <button
                type="button"
                className="audit-filter-button"
                style={{ alignSelf: 'flex-start' }}
                onClick={() =>
                  onFiltersChange({
                    actorType: undefined,
                    action: undefined,
                    entityType: undefined,
                  })
                }
              >
                {t.reset}
              </button>
            ) : null}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuButton active={preset !== '7d'}>{presetLabel}</MenuButton>
        <DropdownMenuContent align="end">
          {DATE_PRESETS.map(option => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onFiltersChange(presetToDates(option.value))}
              style={{ gap: 8, fontSize: 14 }}
            >
              <span style={{ display: 'inline-flex', width: 16 }}>
                {option.value === preset ? <Check size={16} aria-hidden /> : null}
              </span>
              {t[option.labelKey]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
