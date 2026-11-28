'use client';

import Popover from '@mui/material/Popover';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from '@/app/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Select, type SelectOption } from '@/app/components/ui/select';
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

/** The UTC calendar day n days ago, as the API takes `dateFrom`. */
function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** "All time" clears both dates: a missing key would keep the period picked before. */
function presetToDates(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') {
    return { dateFrom: undefined, dateTo: undefined };
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return { dateFrom: daysAgoIso(days), dateTo: undefined };
}

/**
 * The period the filters stand for. Both dates are whole UTC days, so the gap is
 * a whole number of days whatever the hour; no `dateFrom` loads every event.
 */
function currentPreset(filters: AuditEventFilter): DatePreset {
  if (!filters.dateFrom) {
    return 'all';
  }
  const diff = Math.round(
    (Date.parse(daysAgoIso(0)) - Date.parse(filters.dateFrom.slice(0, 10))) / 86_400_000,
  );
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

/** A field label above its select, tied to it so a screen reader names the select. */
function FilterField({
  id,
  label,
  ...select
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="audit-filter-field">
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <Select id={id} labelId={`${id}-label`} size="small" {...select} />
    </div>
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
  const [filtersAnchor, setFiltersAnchor] = useState<HTMLElement | null>(null);
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

      <button
        type="button"
        className={`audit-filter-button${activeCount > 0 ? ' audit-filter-button--active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={filtersAnchor !== null}
        onClick={e => setFiltersAnchor(e.currentTarget)}
      >
        {filterLabels.title}
        {activeCount > 0 ? ` · ${activeCount}` : null}
        <ChevronDown size={16} aria-hidden />
      </button>
      {/* A popover, not a menu: a menu keeps focus on its list, so Tab and the arrows never reached the fields. */}
      <Popover
        open={filtersAnchor !== null}
        anchorEl={filtersAnchor}
        onClose={() => setFiltersAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: '12px' } } }}
      >
        <div className="audit-filter-panel">
          <FilterField
            id="audit-filter-actor"
            label={t.actor}
            value={filters.actorType ?? ''}
            options={ACTOR_OPTIONS.map(o => ({ value: o.value, label: t[o.labelKey] }))}
            onChange={value => onFiltersChange({ actorType: (value || undefined) as ActorType })}
          />
          <FilterField
            id="audit-filter-action"
            label={t.action}
            value={filters.action ?? ''}
            options={ACTION_OPTIONS.map(o => ({ value: o.value, label: t[o.labelKey] }))}
            onChange={value => onFiltersChange({ action: (value || undefined) as AuditAction })}
          />
          <FilterField
            id="audit-filter-entity"
            label={t.entity}
            value={filters.entityType ?? ''}
            options={[
              { value: '', label: t.allEntityTypes },
              ...ENTITY_TYPES.map(value => ({
                value,
                label: t.entityLabels[value]?.value ?? value,
              })),
            ]}
            onChange={value => onFiltersChange({ entityType: (value || undefined) as EntityType })}
          />
          {activeCount > 0 ? (
            <button
              type="button"
              className="audit-filter-button"
              style={{ alignSelf: 'flex-start' }}
              onClick={() =>
                onFiltersChange({ actorType: undefined, action: undefined, entityType: undefined })
              }
            >
              {t.reset}
            </button>
          ) : null}
        </div>
      </Popover>

      <DropdownMenu>
        <MenuButton active={preset !== 'all'}>{presetLabel}</MenuButton>
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
