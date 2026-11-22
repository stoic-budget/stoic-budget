'use client';

import MuiButton from '@mui/material/Button';
import toast from 'react-hot-toast';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Spinner } from '@/app/components/ui/spinner';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { resolveCurrencyCode } from '@/app/lib/format-money';
import { AppImportAccounts } from './AppImportAccounts';
import { AppImportFiles } from './AppImportFiles';
import { AppImportSummary } from './AppImportSummary';
import { useAppImport } from './useAppImport';

/**
 * Whether the preview would write anything, as the server decides it: rows,
 * rows it links as transfer legs, budgets, new accounts, or an opening balance
 * a matched account takes (only one an earlier import created at zero gets one).
 */
export const hasWork = (preview: NonNullable<ReturnType<typeof useAppImport>['preview']>) =>
  preview.transactions.created + preview.transactions.linked > 0 ||
  preview.budgets.created + preview.budgets.updated > 0 ||
  preview.accounts.some(account => account.status === 'created' || account.opening !== 0);

/**
 * Exports of another budgeting app in one dialog: drop the files, see per
 * kind of record what they create, match and skip, choose where each account
 * goes, import as one batch, undo if it was not what you wanted.
 */
export function AppImportDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const t = useIntlayer('appImport');
  const wizard = useIntlayer('importWizard');
  const { currentWorkspace } = useWorkspace();
  const state = useAppImport(resolveCurrencyCode(currentWorkspace?.currency, 'USD'), error =>
    toast.error(getApiErrorMessage(error, wizard.errors.importFailed.value)),
  );
  const { preview, result } = state;
  const ready = Boolean(preview && !state.pending && hasWork(preview));

  const footer = result ? (
    <ModalFooter>
      <MuiButton type="button" variant="outlined" color="inherit" onClick={onClose}>
        {wizard.actions.close}
      </MuiButton>
      {!state.undone && result.batchId && (
        <MuiButton
          type="button"
          variant="outlined"
          color="inherit"
          onClick={() => void state.undo()}
          disabled={state.running}
        >
          {wizard.actions.undo}
        </MuiButton>
      )}
    </ModalFooter>
  ) : (
    <ModalFooter
      onCancel={onClose}
      cancelText={wizard.actions.cancel.value}
      onConfirm={() => void state.commit()}
      confirmText={wizard.actions.run.value}
      isConfirmLoading={state.running}
      isConfirmDisabled={!ready || state.running}
    />
  );

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t.title} size="lg" footer={footer}>
      <div className="seneca-iw seneca-ai" data-testid="app-import">
        {result ? (
          <div className="seneca-iw__result" data-testid="app-import-result">
            <p className="seneca-iw__result-title">
              {state.undone ? wizard.result.undone : wizard.result.title}
            </p>
            {!state.undone && <AppImportSummary result={result} />}
          </div>
        ) : (
          <>
            <p className="seneca-iw__hint">{t.intro}</p>
            <AppImportFiles
              files={state.files}
              recognised={preview?.files ?? null}
              onAdd={state.addFiles}
              onRemove={state.removeFile}
            />
            <div className="seneca-iw__controls">
              <label className="seneca-iw__control">
                <span className="seneca-iw__label">{t.currency}</span>
                <input
                  className="seneca-iw__input"
                  value={state.currency}
                  maxLength={3}
                  onChange={event => state.setCurrency(event.target.value.toUpperCase())}
                />
              </label>
              <div className="seneca-iw__check">
                <Checkbox checked={state.categorize} onCheckedChange={state.setCategorize} />
                <span>{wizard.categorize}</span>
              </div>
            </div>
            {state.pending && !preview && <Spinner size={16} />}
            {preview && (
              <>
                <AppImportAccounts
                  accounts={preview.accounts}
                  wallets={state.wallets}
                  choices={state.choices}
                  onPick={state.pick}
                />
                <AppImportSummary result={preview} />
                {!hasWork(preview) && preview.files.some(file => file.app) && (
                  <p className="seneca-iw__hint">{t.nothingNew}</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}
