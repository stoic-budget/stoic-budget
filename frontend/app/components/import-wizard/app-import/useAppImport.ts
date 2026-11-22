'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { type AppImportResult, runAppImport, undoAppImport } from './app-import-api';

const DRY_RUN_DEBOUNCE_MS = 300;

/** What each account of the files goes to: the person's pick, else what the preview matched. */
export function shownAccountChoices(
  preview: AppImportResult | null,
  picked: Record<string, string | null>,
): Record<string, string | null> {
  const shown: Record<string, string | null> = {};
  for (const account of preview?.accounts ?? []) {
    shown[account.name] =
      account.name in picked
        ? (picked[account.name] ?? null)
        : account.status === 'matched'
          ? account.walletId
          : null;
  }
  return shown;
}

/**
 * The files, the choices and the server's answer about them. Every change
 * asks for a fresh dry run; the import sends exactly the choices on screen,
 * and only once the preview for them is in.
 */
export function useAppImport(defaultCurrency: string, onError: (error: unknown) => void) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const wallets = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  const [files, setFiles] = useState<File[]>([]);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [categorize, setCategorize] = useState(true);
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<AppImportResult | null>(null);
  const [pending, setPending] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AppImportResult | null>(null);
  const [undone, setUndone] = useState(false);
  const version = useRef(0);
  const errorRef = useRef(onError);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const current = ++version.current;
    if (files.length === 0 || currency.length !== 3) {
      setPreview(null);
      setPending(false);
      return;
    }
    setPending(true);
    const timer = setTimeout(() => {
      // The categorizer runs only on import; the preview does not depend on it.
      runAppImport(files, { dryRun: true, currency, categorize: false, accounts: picked })
        .then(next => {
          if (current === version.current) {
            setPreview(next);
          }
        })
        .catch(error => {
          if (current === version.current) {
            setPreview(null);
            errorRef.current(error);
          }
        })
        .finally(() => {
          if (current === version.current) {
            setPending(false);
          }
        });
    }, DRY_RUN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [files, currency, picked]);

  const choices = useMemo(() => shownAccountChoices(preview, picked), [preview, picked]);

  const addFiles = (added: File[]) => {
    setFiles(previous => [
      ...previous,
      ...added.filter(
        file => !previous.some(item => item.name === file.name && item.size === file.size),
      ),
    ]);
  };
  const removeFile = (index: number) =>
    setFiles(previous => previous.filter((_, at) => at !== index));
  const pick = (name: string, walletId: string | null) =>
    setPicked(previous => ({ ...previous, [name]: walletId }));

  const commit = async () => {
    setRunning(true);
    try {
      setResult(
        await runAppImport(files, { dryRun: false, currency, categorize, accounts: choices }),
      );
      await queryClient.invalidateQueries();
    } catch (error) {
      onError(error);
    } finally {
      setRunning(false);
    }
  };

  const undo = async () => {
    if (!result?.batchId) {
      return;
    }
    setRunning(true);
    try {
      await undoAppImport(result.batchId);
      setUndone(true);
      await queryClient.invalidateQueries();
    } catch (error) {
      onError(error);
    } finally {
      setRunning(false);
    }
  };

  return {
    wallets: (wallets.data ?? []).filter(wallet => wallet.isActive),
    files,
    addFiles,
    removeFile,
    currency,
    setCurrency,
    categorize,
    setCategorize,
    choices,
    pick,
    preview,
    pending,
    running,
    result,
    undone,
    commit,
    undo,
  };
}
