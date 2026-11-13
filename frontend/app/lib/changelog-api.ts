import type { ChangelogEntry } from '@/app/components/ChangelogModal';
import apiClient from '@/app/lib/api';
import type { ChangelogSeen } from '@/app/lib/contracts';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const LATEST_URL = '/changelog-latest.json';

function readEntry(value: unknown): ChangelogEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const text = (key: string): string | undefined =>
    typeof entry[key] === 'string' ? (entry[key] as string) : undefined;
  const id = text('id');
  const date = text('date');
  const title = text('title');
  if (!(id && date && title)) {
    return null;
  }
  return {
    id,
    date,
    title,
    summary: text('summary') ?? '',
    markdown: text('markdown') ?? '',
    version: text('version'),
    branch: text('branch'),
  };
}

/**
 * The newest changelog entry, from the small file the changelog workflow writes
 * next to changelog.json, so the app does not load every release to check for one.
 */
export async function fetchLatestChangelogEntry(
  signal?: AbortSignal,
): Promise<ChangelogEntry | null> {
  const response = await fetch(LATEST_URL, { cache: 'no-cache', signal });
  if (!response.ok) {
    throw new Error(`Failed to load ${LATEST_URL}: ${response.status}`);
  }
  const payload: unknown = await response.json();
  return readEntry((payload as { entry?: unknown } | null)?.entry);
}

/** Records `entry` as seen; the answer is the stored marker, which only moves forward. */
export async function postChangelogSeen(entry: ChangelogEntry): Promise<ChangelogSeen> {
  const url = '/users/me/changelog-seen';
  const response = await apiClient.post(url, {
    id: entry.id,
    date: entry.date,
  } satisfies ContractInput<'ChangelogSeenBody'>);
  return checkContract('ChangelogSeen', response.data, url);
}
