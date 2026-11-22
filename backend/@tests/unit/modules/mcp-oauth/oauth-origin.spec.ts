import {
  isSameResource,
  mcpResourceUrl,
  publicOrigin,
  resourceMetadataUrl,
} from '../../../../src/modules/mcp-oauth/oauth-origin';
import { authorizationProblem } from '../../../../src/modules/mcp-oauth/authorization-request';

describe('public origin', () => {
  it('comes from APP_URL, then FRONTEND_URL, as an origin', () => {
    expect(publicOrigin({ APP_URL: 'https://books.example.co.il/app/' })).toBe(
      'https://books.example.co.il',
    );
    expect(publicOrigin({ FRONTEND_URL: 'https://books.example.com,https://other.example.com' })).toBe(
      'https://books.example.com',
    );
  });

  it('is absent rather than guessed', () => {
    expect(publicOrigin({})).toBeNull();
    expect(publicOrigin({ APP_URL: 'not a url' })).toBeNull();
    expect(publicOrigin({ APP_URL: 'javascript:alert(1)' })).toBeNull();
  });

  it('names the MCP endpoint and its metadata (RFC 9728 path insertion)', () => {
    expect(mcpResourceUrl('https://books.example.com')).toBe('https://books.example.com/api/v1/mcp');
    expect(resourceMetadataUrl('https://books.example.com')).toBe(
      'https://books.example.com/.well-known/oauth-protected-resource/api/v1/mcp',
    );
  });
});

describe('resource indicators', () => {
  const resource = 'https://books.example.com/api/v1/mcp';

  it('match the endpoint, a trailing slash and host case aside', () => {
    expect(isSameResource(resource, resource)).toBe(true);
    expect(isSameResource(`${resource}/`, resource)).toBe(true);
    expect(isSameResource('https://BOOKS.example.com/api/v1/mcp', resource)).toBe(true);
  });

  it.each([
    'https://evil.example.com/api/v1/mcp',
    'http://books.example.com/api/v1/mcp',
    'https://books.example.com:8443/api/v1/mcp',
    'https://books.example.com/api/v1',
    'https://books.example.com/api/v1/mcp/other',
    'https://books.example.com/api/v1/mcp?x=1',
    'https://books.example.com/api/v1/mcp#x',
    'not a url',
  ])('refuse %s', other => {
    expect(isSameResource(other, resource)).toBe(false);
  });
});

describe('authorization requests', () => {
  const resource = 'https://books.example.com/api/v1/mcp';
  const valid = {
    responseType: 'code',
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    codeChallengeMethod: 'S256',
    resource,
  };

  it('accept the code flow with S256 for this endpoint', () => {
    expect(authorizationProblem(valid, resource)).toBeNull();
    expect(authorizationProblem({ ...valid, resource: undefined }, resource)).toBeNull();
  });

  it('refuse plain PKCE, a missing method and a missing challenge', () => {
    for (const request of [
      { ...valid, codeChallengeMethod: 'plain' },
      { ...valid, codeChallengeMethod: undefined },
      { ...valid, codeChallenge: undefined },
      { ...valid, codeChallenge: 'too-short' },
    ]) {
      expect(authorizationProblem(request, resource)?.error).toBe('invalid_request');
    }
  });

  it('refuse the implicit flow and another resource', () => {
    expect(authorizationProblem({ ...valid, responseType: 'token' }, resource)?.error).toBe(
      'unsupported_response_type',
    );
    expect(
      authorizationProblem({ ...valid, resource: 'https://evil.example.com/mcp' }, resource)?.error,
    ).toBe('invalid_target');
  });
});
