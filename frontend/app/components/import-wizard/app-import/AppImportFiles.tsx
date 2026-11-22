'use client';

import { useRef, useState } from 'react';
import { Upload, X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import type { AppImportResult } from './app-import-api';

const APP_NAMES = { ynab: 'YNAB', actual: 'Actual Budget', firefly: 'Firefly III' } as const;
const ACCEPT = '.csv,.tsv,.txt';

/** The exported files: picked or dropped, each with what the server recognised in it. */
export function AppImportFiles({
  files,
  recognised,
  onAdd,
  onRemove,
}: {
  files: File[];
  recognised: AppImportResult['files'] | null;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}): React.JSX.Element {
  const t = useIntlayer('appImport');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const describe = (index: number) => {
    const found = recognised?.[index];
    if (!found) {
      return '';
    }
    if (!(found.app && found.kind)) {
      return t.notRecognised.value;
    }
    return `${APP_NAMES[found.app]} · ${t.kinds[found.kind].value}`;
  };

  return (
    <div className="seneca-ai__files">
      <button
        type="button"
        className={`seneca-ai__drop${dragging ? ' seneca-ai__drop--active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          onAdd(Array.from(event.dataTransfer.files));
        }}
        data-testid="app-import-drop"
      >
        <Upload size={18} aria-hidden />
        <span className="seneca-ai__drop-title">{t.chooseFiles}</span>
        <span className="seneca-iw__label">{t.dropHint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        data-testid="app-import-input"
        onChange={event => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = '';
          onAdd(picked);
        }}
      />
      {files.length > 0 && (
        <ul className="seneca-ai__file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}`} className="seneca-ai__file">
              <span className="seneca-ai__file-name">{file.name}</span>
              <span className="seneca-iw__label">{describe(index)}</span>
              <button
                type="button"
                className="seneca-ai__remove"
                aria-label={t.removeFile.value}
                onClick={() => onRemove(index)}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
