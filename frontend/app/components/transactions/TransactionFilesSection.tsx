'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Download, FileText, Trash2, Upload } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { formatDate } from './helpers/transactionFormatters';
import {
  ATTACHMENT_ACCEPT,
  attachmentProblem,
  type TransactionAttachment,
  useAttachmentThumbnail,
  useCanEditRows,
  useTransactionAttachments,
} from './hooks/useTransactionAttachments';

/** "120 KB", "2.4 MB" in the reader's own number format. */
function formatSize(bytes: number, locale: string): string {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: mb ? 'megabyte' : 'kilobyte',
    unitDisplay: 'short',
    maximumFractionDigits: mb ? 1 : 0,
  }).format(Math.max(bytes / (mb ? 1024 * 1024 : 1024), mb ? 0 : 1));
}

interface FileRowProps {
  attachment: TransactionAttachment;
  /** Absent for a member who may only read the row. */
  canRemove: boolean;
  removing: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onRemove: () => void;
}

function FileRow({ attachment, canRemove, removing, onOpen, onDownload, onRemove }: FileRowProps) {
  const t = useIntlayer('transactionFiles');
  const { locale } = useLocale();
  const thumbnail = useAttachmentThumbnail(attachment);
  const [asking, setAsking] = useState(false);

  return (
    <li className="seneca-tx-files__item">
      <div className="seneca-tx-files__row">
        <button
          type="button"
          className="seneca-tx-files__thumb"
          onClick={onOpen}
          aria-label={`${t.open.value}: ${attachment.fileName}`}
        >
          {thumbnail ? <img src={thumbnail} alt="" /> : <FileText size={18} />}
        </button>
        <div className="seneca-tx-files__meta">
          <button type="button" className="seneca-tx-files__name" onClick={onOpen}>
            {attachment.fileName}
          </button>
          <span className="seneca-tx-files__sub">
            {formatSize(Number(attachment.fileSize), locale)} ·{' '}
            {formatDate(attachment.createdAt, locale)}
          </span>
        </div>
        <button
          type="button"
          className="seneca-tx-files__icon-btn"
          onClick={onDownload}
          aria-label={t.download.value}
          title={t.download.value}
        >
          <Download size={16} />
        </button>
        {canRemove && (
          <button
            type="button"
            className="seneca-tx-files__icon-btn seneca-tx-files__icon-btn--muted"
            onClick={() => setAsking(true)}
            aria-label={t.remove.value}
            title={t.remove.value}
            disabled={removing}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {/* Removing is final, so it asks once more, in place, like deleting the row does. */}
      {asking && (
        <div className="seneca-tx-files__confirm">
          <span>{t.removeQuestion}</span>
          <button
            type="button"
            className="seneca-tx-footer__text-btn"
            onClick={() => setAsking(false)}
            disabled={removing}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            className="seneca-tx-footer__danger-btn"
            onClick={onRemove}
            disabled={removing}
          >
            {t.remove}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * The files kept with a row: a receipt photo, an invoice PDF. Added from the
 * picker (on a phone it offers the camera too), the camera directly, or by
 * dropping a file on the box. Not the receipt itself: a receipt read on the
 * Documents page has its own page, and its photo lands here when approved.
 */
export function TransactionFilesSection({ transactionId }: { transactionId: string }) {
  const t = useIntlayer('transactionFiles');
  const files = useTransactionAttachments(transactionId);
  const canEdit = useCanEditRows();
  const [dragging, setDragging] = useState(false);

  const addFiles = async (picked: File[]) => {
    for (const file of picked) {
      const problem = attachmentProblem(file);
      if (problem) {
        toast.error(problem === 'size' ? t.tooBig.value : t.wrongType.value);
        continue;
      }
      await files.add(file).catch((error: unknown) => {
        toast.error(getApiErrorMessage(error, t.addFailed.value));
      });
    }
  };
  const fromInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // Cleared, so picking the same file again fires a change.
    event.target.value = '';
    void addFiles(picked);
  };
  const failToast = (message: string) => (error: unknown) =>
    toast.error(getApiErrorMessage(error, message));

  // Not the viewer's to see, or nothing to read and nothing they may add.
  if (files.isHidden || (!canEdit && files.attachments.length === 0)) return null;

  return (
    <section className="seneca-tx-files" aria-labelledby={`tx-files-${transactionId}`}>
      <h3 id={`tx-files-${transactionId}`} className="seneca-tx-detail__field-label">
        {t.title}
      </h3>

      {files.loadFailed && <p className="seneca-tx-files__sub">{t.loadFailed}</p>}

      {files.attachments.length > 0 && (
        <ul className="seneca-tx-files__list">
          {files.attachments.map(attachment => (
            <FileRow
              key={attachment.id}
              attachment={attachment}
              canRemove={canEdit}
              removing={files.removingId === attachment.id}
              onOpen={() => void files.open(attachment).catch(failToast(t.openFailed.value))}
              onDownload={() =>
                void files.download(attachment).catch(failToast(t.openFailed.value))
              }
              onRemove={() =>
                void files
                  .remove(attachment.id)
                  .then(() => toast.success(t.removed.value), failToast(t.removeFailed.value))
              }
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <div
          className={`seneca-tx-files__drop${dragging ? ' seneca-tx-files__drop--active' : ''}`}
          data-testid="tx-files-drop"
          role="group"
          aria-label={t.add.value}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            void addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="seneca-tx-files__actions">
            <label className="seneca-tx-files__pick">
              <Upload size={16} />
              {files.adding ? t.adding : t.add}
              <input
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                hidden
                disabled={files.adding}
                onChange={fromInput}
                data-testid="tx-files-input"
              />
            </label>
            {/* Straight to the back camera; shown on touch screens only (see the styles). */}
            <label className="seneca-tx-files__pick seneca-tx-files__pick--camera">
              <Camera size={16} />
              {t.takePhoto}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                disabled={files.adding}
                onChange={fromInput}
              />
            </label>
          </div>
          <span className="seneca-tx-files__sub">
            <span className="seneca-tx-files__drop-hint">{t.dropHere} </span>
            {t.limits}
          </span>
        </div>
      )}
    </section>
  );
}
