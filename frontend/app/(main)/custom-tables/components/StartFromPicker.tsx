'use client';

import type { ReactNode } from 'react';
import { Check } from '@/app/components/icons';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { findSource, SOURCE_KINDS, type SourceKind } from '../sources';
import { TABLE_TEMPLATES, type TableTemplateId } from '../templates';
import type { CreateTableDialogProps } from './CreateTableDialog';
import { SourceIcon, TemplateIcon } from './StartIcons';
import { distinctName } from './table-names';

interface TemplateCard {
  id: TableTemplateId | null;
  name: string;
  description: string;
  columnCount: number;
}

type StartMode = 'template' | 'source';

function StartCard({
  checked,
  icon,
  name,
  description,
  columnCount,
  columnsCountLabel,
  onClick,
}: {
  checked: boolean;
  icon: ReactNode;
  name: string;
  description: string;
  columnCount: number;
  columnsCountLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className="seneca-ct__template"
      onClick={onClick}
    >
      {checked ? (
        <span className="seneca-ct__template-check" aria-hidden="true">
          <Check size={14} />
        </span>
      ) : null}
      <span className="seneca-ct__template-icon">{icon}</span>
      <span className="seneca-ct__template-name">{name}</span>
      <span className="seneca-ct__template-desc">{description}</span>
      {columnCount ? (
        <span className="seneca-ct__template-count">
          {columnsCountLabel.replace('{{count}}', String(columnCount))}
        </span>
      ) : null}
    </button>
  );
}

/**
 * One card grid, switched between "blank or template" and "fill from app
 * data": the same nouns (Invoices, Payables…) exist in both, so showing them
 * side by side read as duplicates.
 */
export function StartFromPicker({
  form,
  setForm,
  labels,
  existingNames,
}: Pick<CreateTableDialogProps, 'form' | 'setForm' | 'labels'> & { existingNames: string[] }) {
  const mode: StartMode = form.sourceKind ? 'source' : 'template';
  const pickTemplate = (id: TableTemplateId | null) =>
    setForm(prev => ({ ...prev, templateId: id, sourceKind: null }));
  const pickSource = (id: SourceKind, suggestPeriod = false) =>
    setForm(prev => ({
      ...prev,
      templateId: null,
      sourceKind: id,
      // A first fill suggests this year; "All time" stays one click away.
      sourceFilters:
        suggestPeriod &&
        findSource(id)?.filterFields.includes('dateRange') &&
        !prev.sourceFilters.dateFrom &&
        !prev.sourceFilters.dateTo &&
        !prev.sourceFilters.ids.length
          ? { ...prev.sourceFilters, dateFrom: `${new Date().getFullYear()}-01-01` }
          : prev.sourceFilters,
      // A filled table is named after its source unless the user already typed a name.
      name: prev.name.trim()
        ? prev.name
        : distinctName(labels.sources[id]?.name ?? id, existingNames),
    }));
  const switchMode = (next: StartMode) => {
    if (next === mode) {
      return;
    }
    if (next === 'template') {
      pickTemplate(null);
    } else {
      pickSource(SOURCE_KINDS[0]?.id ?? 'transactions', true);
    }
  };
  const templateCards: TemplateCard[] = [
    { id: null, name: labels.blankName, description: labels.blankDescription, columnCount: 0 },
    ...TABLE_TEMPLATES.map(template => ({
      id: template.id,
      name: labels.templates[template.id].name,
      description: labels.templates[template.id].description,
      columnCount: template.columns.length,
    })),
  ];
  return (
    <div className="seneca-ct__field seneca-ct__field--wide seneca-ct__start">
      <span className="seneca-ct__label">{labels.templateLabel}</span>
      <TextTabs
        value={mode}
        onChange={switchMode}
        ariaLabel={labels.templateLabel}
        options={[
          { value: 'template', label: labels.groupTemplates },
          { value: 'source', label: labels.groupSources },
        ]}
      />
      {mode === 'source' ? <p className="seneca-ct__start-hint">{labels.sourcesHint}</p> : null}
      {mode === 'template' ? (
        <div className="seneca-ct__templates" role="radiogroup" aria-label={labels.groupTemplates}>
          {templateCards.map(card => (
            <StartCard
              key={card.id ?? 'blank'}
              checked={form.templateId === card.id}
              icon={<TemplateIcon id={card.id} />}
              name={card.name}
              description={card.description}
              columnCount={card.columnCount}
              columnsCountLabel={labels.columnsCount}
              onClick={() => pickTemplate(card.id)}
            />
          ))}
        </div>
      ) : (
        <div
          className="seneca-ct__templates seneca-ct__templates--compact"
          role="radiogroup"
          aria-label={labels.groupSources}
        >
          {SOURCE_KINDS.map(source => (
            <StartCard
              key={source.id}
              checked={form.sourceKind === source.id}
              icon={<SourceIcon id={source.id} />}
              name={labels.sources[source.id].name}
              description={labels.sources[source.id].description}
              columnCount={source.columnFields.length}
              columnsCountLabel={labels.columnsCount}
              onClick={() => pickSource(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
