'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { usePasskeysSupported } from '@/app/hooks/usePasskeysSupported';
import { passkeysApi } from '@/app/lib/passkeys-api';
import { createPasskey, isPasskeyPromptDismissed } from '@/app/lib/webauthn';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

const PASSKEYS_KEY = ['auth', 'passkeys'] as const;

const done = (pending: Promise<unknown>): Promise<boolean> =>
  pending.then(
    () => true,
    () => false,
  );

export type UsePasskeysMessages = {
  added: string;
  renamed: string;
  removed: string;
  dismissed: string;
  errorFallback: string;
};

/**
 * The person's passkeys: the list, and adding (password, then the browser's
 * prompt), renaming and removing one. Every change refetches the list, so a
 * row on screen is always the stored one.
 */
export function usePasskeys(enabled: boolean, messages: UsePasskeysMessages) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = usePasskeysSupported();

  const query = useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: ({ signal }) => passkeysApi.list(signal),
    enabled,
    retry: false,
  });

  const settle = (done: string) => ({
    onMutate: () => {
      setMessage(null);
      setError(null);
    },
    onSuccess: () => setMessage(done),
    onError: (err: unknown) =>
      setError(
        isPasskeyPromptDismissed(err)
          ? messages.dismissed
          : getApiErrorMessage(err, messages.errorFallback),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  });

  const add = useMutation({
    mutationFn: async (input: { name: string; password: string }) => {
      const options = await passkeysApi.registrationOptions(input.password);
      return passkeysApi.register(input.name.trim(), await createPasskey(options));
    },
    ...settle(messages.added),
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      passkeysApi.rename(input.id, input.name.trim()),
    ...settle(messages.renamed),
  });

  const remove = useMutation({
    mutationFn: (input: { id: string; password: string }) =>
      passkeysApi.remove(input.id, input.password),
    ...settle(messages.removed),
  });

  return {
    passkeys: query.data ?? [],
    loading: query.isLoading,
    loadFailed: query.isError,
    supported,
    busy: add.isPending || rename.isPending || remove.isPending,
    message,
    error,
    // True when it went through; the failure is already in `error`.
    add: (input: { name: string; password: string }) => done(add.mutateAsync(input)),
    rename: (input: { id: string; name: string }) => done(rename.mutateAsync(input)),
    remove: (input: { id: string; password: string }) => done(remove.mutateAsync(input)),
  };
}

export type UsePasskeysReturn = ReturnType<typeof usePasskeys>;
