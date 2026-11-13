'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { type AuthorizationRequest, decisionFields } from './authorization-request';

const CONSENT_URL = '/oauth/consent';

export interface ConsentDecision {
  approve: boolean;
  workspaceId: string;
  scopes: ContractInput<'McpOAuthDecisionBody'>['scopes'];
}

/** An http(s) address, or null for anything else: only those are offered as links. */
const webAddress = (href: string): URL | null => {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
};

/** Leaves the app for the client's redirect URI, as the server built it. */
const goTo = (url: string) => window.location.assign(url);

/**
 * What the app asks for, checked by the server, and the person's answer. A
 * request the app got wrong comes back as an address carrying the error. It is
 * never followed on its own: anyone may register a client, so the address may
 * belong to anyone (RFC 9700 §4.11.2). The page offers it as a link instead.
 */
export function useOAuthConsent(request: AuthorizationRequest | null) {
  const query = useQuery({
    queryKey: ['oauth-consent', request],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: CONSENT_URL,
        params: request ?? undefined,
        signal,
        contract: 'McpOAuthConsent',
      }),
    enabled: request !== null,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const decision = useMutation({
    mutationFn: async (answer: ConsentDecision) => {
      if (!request) throw new Error('No authorization request');
      const body = {
        ...decisionFields(request),
        ...answer,
      } satisfies ContractInput<'McpOAuthDecisionBody'>;
      const response = await apiClient.post(CONSENT_URL, body);
      return checkContract('McpOAuthRedirect', response.data, CONSENT_URL);
    },
    onSuccess: answer => goTo(answer.redirectTo),
  });

  return {
    consent: query.data?.kind === 'consent' ? query.data : null,
    loading: request !== null && query.isPending,
    loadError: query.error,
    /** A refused request, with the app's address carrying the error for the person to follow or not. */
    refusal: query.data?.kind === 'redirect' ? { back: webAddress(query.data.redirectTo) } : null,
    decide: decision.mutate,
    /** Pending, or done and on the way out: the buttons stay off. */
    deciding: decision.isPending || decision.isSuccess,
    decideError: decision.error,
  };
}
