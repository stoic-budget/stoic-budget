'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useState } from 'react';
import { WorkspaceDataContext } from '@/app/contexts/WorkspaceContext';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import { blobOf } from '@/app/lib/blob-of';
import { type ContractType, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type TransactionAttachment = ContractType<'TransactionAttachment'>;

/** What the picker offers: on a phone, image/* brings the camera into the choice. */
export const ATTACHMENT_ACCEPT = 'image/*,application/pdf';

/** The API's own list and ceiling (backend transaction-attachment-files.ts). */
const ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
]);
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Why a picked file cannot be attached, before it is sent; null when it can. */
export function attachmentProblem(file: Pick<File, 'type' | 'size'>): 'type' | 'size' | null {
  if (!ATTACHMENT_TYPES.has(file.type)) return 'type';
  return file.size > MAX_ATTACHMENT_BYTES ? 'size' : null;
}

export const isImageAttachment = (attachment: Pick<TransactionAttachment, 'mimeType'>) =>
  attachment.mimeType.startsWith('image/');

const fileUrl = (id: string) => `/transactions/attachments/${id}/download`;

/**
 * Whether this member may add and remove files: the API's own rule for
 * editing rows (owner and admin, a member allowed to edit statements; never a
 * viewer, an accountant or an opened past version). Unknown role: shown, and
 * the API answers for itself.
 */
export function useCanEditRows(): boolean {
  // Read directly, as useReadOnlyWorkspace does: outside a provider (isolated tests) it is null.
  const currentWorkspace = useContext(WorkspaceDataContext)?.currentWorkspace;
  if (currentWorkspace?.kind === 'version') return false;
  const role = currentWorkspace?.memberRole;
  if (!role || role === 'owner' || role === 'admin') return true;
  if (role === 'member') return currentWorkspace?.memberPermissions?.canEditStatements === true;
  return false;
}

/** Hands a file to the browser as a download, under the name it was attached with. */
function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * The files pinned to one row: the list, adding, removing, opening and saving.
 * The file endpoints need the workspace header, so every file arrives through
 * the api client as a blob rather than as a plain link.
 */
export function useTransactionAttachments(transactionId: string) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const listKey = queryKeys.transactionAttachments(workspaceId, transactionId);
  const url = `/transactions/${transactionId}/attachments`;

  const list = useQuery({
    queryKey: listKey,
    queryFn: ({ signal }) =>
      apiClient
        .get(url, { signal })
        .then(response => checkContract('TransactionAttachmentList', response.data, url)),
    enabled: Boolean(workspaceId && transactionId),
    // A row the viewer may not see (another member's private row) answers 404: no retry.
    retry: (count, error) => getApiErrorStatus(error) !== 404 && count < 1,
  });

  const add = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      // The client's default is JSON, which would turn the form into a JSON object.
      const response = await apiClient.post(url, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return checkContract('TransactionAttachment', response.data, url);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const remove = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiClient.delete(`/transactions/attachments/${attachmentId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const fetchFile = (attachmentId: string) =>
    queryClient.fetchQuery({
      queryKey: queryKeys.transactionAttachmentFile(workspaceId, attachmentId),
      queryFn: () => apiClient.get(fileUrl(attachmentId), { responseType: 'blob' }).then(blobOf),
      staleTime: Number.POSITIVE_INFINITY,
    });

  /**
   * Opens the file in a new tab. The tab is opened during the tap, before the
   * download, or a phone's popup blocker would refuse it; without a tab the
   * file is saved instead.
   */
  const open = async (attachment: TransactionAttachment) => {
    const tab = window.open('', '_blank');
    try {
      const blob = await fetchFile(attachment.id);
      if (!tab) {
        saveFile(blob, attachment.fileName);
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      tab.location.href = objectUrl;
      // The tab has read it by then; the memory is not kept for the page's life.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      tab?.close();
      throw error;
    }
  };

  const download = async (attachment: TransactionAttachment) => {
    saveFile(await fetchFile(attachment.id), attachment.fileName);
  };

  return {
    attachments: list.data ?? [],
    isLoading: list.isLoading,
    /** Not the viewer's to see: the section stays out of the way. */
    isHidden: getApiErrorStatus(list.error) === 404,
    loadFailed: list.isError && getApiErrorStatus(list.error) !== 404,
    add: add.mutateAsync,
    adding: add.isPending,
    remove: remove.mutateAsync,
    removingId: remove.isPending ? remove.variables : undefined,
    open,
    download,
  };
}

/** A small picture of an image attachment: an object URL while mounted, null for anything else. */
export function useAttachmentThumbnail(attachment: TransactionAttachment): string | null {
  const workspaceId = useWorkspaceId();
  const image = isImageAttachment(attachment);
  const { data } = useQuery({
    queryKey: queryKeys.transactionAttachmentFile(workspaceId, attachment.id),
    queryFn: ({ signal }) =>
      apiClient.get(fileUrl(attachment.id), { responseType: 'blob', signal }).then(blobOf),
    enabled: Boolean(workspaceId) && image,
    // A stored file never changes; its id names it.
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const next = URL.createObjectURL(data);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [data]);

  return image ? objectUrl : null;
}
