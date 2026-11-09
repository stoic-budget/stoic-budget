import type { ContractInput } from '@/app/lib/query-fn-schema';

export type AuthorizationRequest = ContractInput<'McpOAuthConsentQuery'>;

/**
 * The OAuth authorization request from this page's URL, renamed to what the
 * API takes. Only the parameters the server checks are kept; the server, not
 * the page, decides whether they are valid. Null without a client or a
 * redirect URI: there is nothing to answer then.
 */
export function readAuthorizationRequest(search: URLSearchParams): AuthorizationRequest | null {
  const clientId = search.get('client_id');
  const redirectUri = search.get('redirect_uri');
  if (!(clientId && redirectUri)) {
    return null;
  }
  const optional = (name: string) => search.get(name) || undefined;
  return {
    clientId,
    redirectUri,
    responseType: optional('response_type'),
    codeChallenge: optional('code_challenge'),
    codeChallengeMethod: optional('code_challenge_method'),
    state: optional('state'),
    resource: optional('resource'),
    scope: optional('scope'),
  };
}

/** The same request, without the scope the app asked for: the person's choice replaces it. */
export function decisionFields({ scope: _scope, ...request }: AuthorizationRequest) {
  return request;
}
