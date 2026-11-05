'use client';

import { useEffect, useRef } from 'react';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';

import { FULL_SCREEN_ON_PHONE, ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';

import type { CreateTableForm } from '../hooks/useCreateTable';
import { useSourcePreview } from '../hooks/useSourcePreview';
import type { TableCategory } from '../hooks/useTablesList';
import {
  EMPTY_SOURCE_FILTERS,
  findSource,
  normalizeSourceFilters,
  type SourceKind,
} from '../sources';
import { type TableTemplateId } from '../templates';
import { SourceFilterFields } from './SourceFilterFields';
import { SourcePreviewPanel } from './SourcePreviewPanel';
import { StartFromPicker } from './StartFromPicker';
import type { SourceFilterPanelLabels } from './source-filter-labels';
import { isTaken } from './table-names';

export interface CreateTableDialogLabels {
  title: string;
  name: string;
  namePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  category: string;
  noCategory: string;
  templateLabel: string;
  columnsCount: string;
  blankName: string;
  blankDescription: string;
  templates: Record<TableTemplateId, { name: string; description: string }>;
  groupTemplates: string;
  groupSources: string;
  /** The line under 'Fill from Seneca' saying what it does. */
  sourcesHint: string;
  nameTaken: string;
  sources: Record<SourceKind, { name: string; description: string }>;
  /** Translated titles per source field, sent to the server on creation. */
  sourceColumnTitles: Record<string, string>;
  sourcePanel: SourceFilterPanelLabels;
  submit: string;
  creating: string;
  cancel: string;
}

export interface CreateTableDialogProps {
  open: boolean;
  form: CreateTableForm;
  setForm: React.Dispatch<React.SetStateAction<CreateTableForm>>;
  creating: boolean;
  categories: TableCategory[];
  /** The tables already there: a new one should not repeat a name or a source. */
  existingTables?: Array<{ id: string; name: string; sourceBinding?: { kind: string } | null }>;
  onSubmit: () => void;
  onClose: () => void;
  labels: CreateTableDialogLabels;
}

/** Name, description, category and a template or app data source to start from. */
export function CreateTableDialog(props: CreateTableDialogProps) {
  const {
    open,
    form,
    setForm,
    creating,
    categories,
    existingTables = [],
    onSubmit,
    onClose,
    labels,
  } = props;
  const existingNames = existingTables.map(table => table.name);
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) {
      window.setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);
  const source = findSource(form.sourceKind);
  const preview = useSourcePreview({
    kind: form.sourceKind,
    filters: form.sourceFilters,
    columnTitles: labels.sourceColumnTitles,
  });
  const filtered = Object.keys(normalizeSourceFilters(form.sourceFilters)).some(
    key => key !== 'ids',
  );
  // The whole source, unfiltered: the "of N" of the count.
  const whole = useSourcePreview({
    kind: form.sourceKind,
    filters: EMPTY_SOURCE_FILTERS,
    columnTitles: labels.sourceColumnTitles,
  });
  const sameSource = existingTables.find(table => table.sourceBinding?.kind === form.sourceKind);
  const sourceBlocked = source !== null && (preview.preview?.count ?? 0) === 0;
  const nameTaken = form.name.trim() !== '' && isTaken(form.name, existingNames ?? []);
  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      size={source ? 'lg' : 'md'}
      paperSx={{ maxWidth: source ? 960 : 720, ...FULL_SCREEN_ON_PHONE }}
      title={labels.title}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onSubmit}
          cancelText={labels.cancel}
          confirmText={creating ? labels.creating : labels.submit}
          isConfirmLoading={creating}
          isConfirmDisabled={!form.name.trim() || sourceBlocked}
        />
      }
    >
      <form
        className={source ? 'seneca-ct__create seneca-ct__create--split' : 'seneca-ct__create'}
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="seneca-ct__form">
          <label className="seneca-ct__field seneca-ct__field--wide">
            <span className="seneca-ct__label">{labels.name}</span>
            <input
              className="seneca-ct__input"
              value={form.name}
              placeholder={labels.namePlaceholder}
              ref={nameRef}
              aria-invalid={nameTaken || undefined}
              aria-describedby={nameTaken ? 'ct-name-taken' : undefined}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            />
            {nameTaken ? (
              <span id="ct-name-taken" className="seneca-ct__field-note">
                {labels.nameTaken}
              </span>
            ) : null}
          </label>
          <label className="seneca-ct__field seneca-ct__field--wide">
            <span className="seneca-ct__label">{labels.description}</span>
            <input
              className="seneca-ct__input"
              value={form.description}
              placeholder={labels.descriptionPlaceholder}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            />
          </label>
          <div className="seneca-ct__field seneca-ct__field--wide">
            <span className="seneca-ct__label">{labels.category}</span>
            <CategoryPickerField
              size="small"
              ariaLabel={labels.category}
              value={form.categoryId}
              categories={categories}
              onChange={categoryId => setForm(prev => ({ ...prev, categoryId }))}
              placeholder={labels.noCategory}
              clearLabel={labels.noCategory}
            />
          </div>
          <StartFromPicker
            form={form}
            setForm={setForm}
            labels={labels}
            existingNames={existingNames}
          />
          {source ? (
            <div className="seneca-ct__field seneca-ct__field--wide">
              <SourceFilterFields
                source={source}
                filters={form.sourceFilters}
                onChange={patch =>
                  setForm(prev => ({ ...prev, sourceFilters: { ...prev.sourceFilters, ...patch } }))
                }
                categories={categories}
                labels={labels.sourcePanel}
              />
            </div>
          ) : null}
        </div>
        {source ? (
          <aside className="seneca-ct__create-side">
            <SourcePreviewPanel
              source={source}
              sourceName={labels.sources[source.id].name}
              preview={preview.preview}
              total={filtered ? (whole.preview?.count ?? null) : null}
              loading={preview.loading}
              error={preview.error}
              existing={sameSource ? { id: sameSource.id, name: sameSource.name } : null}
              onResetFilters={
                filtered
                  ? () => setForm(prev => ({ ...prev, sourceFilters: EMPTY_SOURCE_FILTERS }))
                  : null
              }
              labels={labels.sourcePanel}
            />
          </aside>
        ) : null}
      </form>
    </ModalShell>
  );
}
