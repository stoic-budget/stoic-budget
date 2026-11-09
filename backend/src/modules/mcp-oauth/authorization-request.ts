import { isCodeChallenge, PKCE_METHOD } from './oauth-crypto';
import { isSameResource } from './oauth-origin';

export interface AuthorizationProblem {
  error: 'unsupported_response_type' | 'invalid_request' | 'invalid_target';
  description: string;
}

interface AuthorizationParams {
  responseType?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  resource?: string;
}

/**
 * What is wrong with an authorization request from a known client, answered
 * at the client's redirect URI: only the code flow, only PKCE with S256 (a
 * missing method is `plain` by RFC 7636, and refused), and only this server's
 * MCP endpoint as the resource.
 */
export function authorizationProblem(
  request: AuthorizationParams,
  resource: string,
): AuthorizationProblem | null {
  if (request.responseType !== 'code') {
    return {
      error: 'unsupported_response_type',
      description: 'Only response_type=code is supported',
    };
  }
  if (request.codeChallengeMethod !== PKCE_METHOD) {
    return {
      error: 'invalid_request',
      description: 'PKCE with code_challenge_method=S256 is required',
    };
  }
  if (!(request.codeChallenge && isCodeChallenge(request.codeChallenge))) {
    return {
      error: 'invalid_request',
      description: 'code_challenge must be the base64url SHA-256 of the verifier',
    };
  }
  if (request.resource !== undefined && !isSameResource(request.resource, resource)) {
    return { error: 'invalid_target', description: 'The resource must be this MCP endpoint' };
  }
  return null;
}
