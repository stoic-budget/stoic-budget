'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import type {
  CalendarFeedCreated,
  CalendarFeedInclude,
  CalendarFeedSettings,
} from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

const URL_PATH = '/calendar-feed';

/** The address a calendar app subscribes to: served by the API behind this same origin. */
export function calendarFeedUrl(token: string, origin = window.location.origin): string {
  return `${origin}/api/v1/public/calendar/${token}.ics`;
}

/**
 * The member's own calendar feed: read it, turn it on or make a new link
 * (the answer carries the link, once), change what it shows, turn it off.
 * `issueLink` asks for a link in the current workspace; `token` is the link
 * just made there, or null: a link made in another workspace is not shown
 * after switching.
 */
export function useCalendarFeed() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const key = queryKeys.calendarFeed(workspaceId);
  const keep = (settings: CalendarFeedSettings) => queryClient.setQueryData(key, settings);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: URL_PATH, signal, contract: 'CalendarFeedSettings' }),
    enabled: Boolean(workspaceId),
    retry: false,
  });

  // The workspace is the mutation's variable: fixed when the link is asked for,
  // so the answer lands in that workspace even after a switch.
  const issue = useMutation({
    mutationFn: async (_madeIn: string | null): Promise<CalendarFeedCreated> => {
      const body = {} satisfies ContractInput<'CalendarFeedIncludeBody'>;
      const response = await apiClient.post(URL_PATH, body);
      return checkContract('CalendarFeedCreated', response.data, URL_PATH);
    },
    onSuccess: ({ token: _token, ...settings }, madeIn) =>
      queryClient.setQueryData(queryKeys.calendarFeed(madeIn), settings),
  });
  const issueLink = (options?: { onError?: (error: unknown) => void }) =>
    issue.mutate(workspaceId, options);
  const token = issue.data && issue.variables === workspaceId ? issue.data.token : null;

  const update = useMutation({
    mutationFn: async (change: Partial<CalendarFeedInclude>): Promise<CalendarFeedSettings> => {
      const body = change satisfies ContractInput<'CalendarFeedIncludeBody'>;
      const response = await apiClient.patch(URL_PATH, body);
      return checkContract('CalendarFeedSettings', response.data, URL_PATH);
    },
    onSuccess: keep,
  });

  const remove = useMutation({
    mutationFn: async (): Promise<CalendarFeedSettings> => {
      const response = await apiClient.delete(URL_PATH);
      return checkContract('CalendarFeedSettings', response.data, URL_PATH);
    },
    onSuccess: settings => {
      keep(settings);
      // The link shown after turning it on is dead now: forget it.
      issue.reset();
    },
  });

  return { query, issue, issueLink, token, update, remove };
}
