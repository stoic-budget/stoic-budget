import { describe, expect, it } from 'vitest';
import { decisionFields, readAuthorizationRequest } from './authorization-request';

describe('readAuthorizationRequest', () => {
  it('renames the OAuth parameters and keeps nothing else', () => {
    const search = new URLSearchParams({
      response_type: 'code',
      client_id: '00000000-0000-4000-8000-000000000001',
      redirect_uri: 'http://127.0.0.1:33418/callback',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      state: 'a&b',
      resource: 'https://books.example.com/api/v1/mcp',
      scope: 'transaction.view',
      prompt: 'consent',
    });

    expect(readAuthorizationRequest(search)).toEqual({
      clientId: '00000000-0000-4000-8000-000000000001',
      redirectUri: 'http://127.0.0.1:33418/callback',
      responseType: 'code',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      codeChallengeMethod: 'S256',
      state: 'a&b',
      resource: 'https://books.example.com/api/v1/mcp',
      scope: 'transaction.view',
    });
  });

  it('answers nothing without a client or a redirect URI', () => {
    expect(readAuthorizationRequest(new URLSearchParams({ client_id: 'x' }))).toBeNull();
    expect(readAuthorizationRequest(new URLSearchParams({ redirect_uri: 'https://a' }))).toBeNull();
  });

  it('drops empty values instead of sending them', () => {
    const request = readAuthorizationRequest(
      new URLSearchParams({ client_id: 'x', redirect_uri: 'https://a', state: '' }),
    );
    expect(request?.state).toBeUndefined();
  });

  it('leaves the asked-for scope out of the decision', () => {
    const request = readAuthorizationRequest(
      new URLSearchParams({ client_id: 'x', redirect_uri: 'https://a', scope: 'transaction.view' }),
    );
    expect(request && 'scope' in decisionFields(request)).toBe(false);
  });
});
