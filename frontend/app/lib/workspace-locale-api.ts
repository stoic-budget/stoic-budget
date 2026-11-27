import { api } from './api';
import type { AppLocale } from './locale';
import { type ContractInput, checkContract } from './query-fn-schema';

// Saved this session. The workspace list is fetched once per page load, so it
// lags behind a language chosen since; this map is the fresher answer.
const savedLocales = new Map<string, string>();

/** The caller's language in a workspace: saved this session, else as the list has it. */
export function workspaceLocale(workspace: {
  id: string;
  memberLocale?: string | null;
}): string | null {
  return savedLocales.get(workspace.id) ?? workspace.memberLocale ?? null;
}

/** Stores the caller's interface language for one workspace. */
export async function saveWorkspaceLocale(workspaceId: string, locale: AppLocale): Promise<void> {
  savedLocales.set(workspaceId, locale);
  const response = await api.put(`/workspaces/${workspaceId}/locale`, {
    locale,
  } satisfies ContractInput<'SetMyWorkspaceLocaleBody'>);
  await checkContract('WorkspaceMemberLocale', response.data, '/workspaces/:id/locale');
}
