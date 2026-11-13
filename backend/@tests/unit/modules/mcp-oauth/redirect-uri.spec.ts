import {
  isRegisteredRedirect,
  redirectHost,
  redirectUriProblem,
  redirectWith,
} from '../../../../src/modules/mcp-oauth/redirect-uri';

describe('redirect URIs at registration', () => {
  it.each([
    'https://app.example.com/oauth/callback',
    'https://app.example.com:8443/cb?tenant=1',
    'http://localhost:6274/oauth/callback',
    'http://127.0.0.1:33418/',
    'http://[::1]:8080/cb',
  ])('accepts %s', uri => {
    expect(redirectUriProblem(uri)).toBeNull();
  });

  it.each([
    ['http://app.example.com/cb', 'scheme'],
    ['http://localhost.example.com/cb', 'scheme'],
    ['http://127.0.0.1.example.com/cb', 'scheme'],
    ['javascript:alert(1)', 'scheme'],
    ['data:text/html,hi', 'scheme'],
    ['example-client://callback', 'scheme'],
    ['ftp://app.example.com/cb', 'scheme'],
    ['https://member-1:secret@app.example.com/cb', 'userinfo'],
    ['https://app.example.com@evil.example.com/cb', 'userinfo'],
    ['https://app.example.com/cb#fragment', 'fragment'],
    ['https://app.example.com/cb#', 'fragment'],
    ['https://app.example.com\\@evil.example.com/cb', 'malformed'],
    [' https://app.example.com/cb', 'malformed'],
    ['https://app.example.com/c b', 'malformed'],
    ['https://app.example.com/cb\n', 'malformed'],
    ['/relative/callback', 'malformed'],
    ['', 'malformed'],
    [`https://app.example.com/${'a'.repeat(2000)}`, 'malformed'],
  ])('refuses %s (%s)', (uri, problem) => {
    expect(redirectUriProblem(uri)).toBe(problem);
  });
});

describe('redirect URIs at authorization', () => {
  const registered = ['https://app.example.com/oauth/callback', 'http://127.0.0.1:33418/cb'];

  it('matches a registered URI only verbatim', () => {
    expect(isRegisteredRedirect(registered, 'https://app.example.com/oauth/callback')).toBe(true);
    expect(isRegisteredRedirect(registered, 'http://127.0.0.1:33418/cb')).toBe(true);
  });

  it.each([
    ['another port', 'http://127.0.0.1:33419/cb'],
    ['another loopback name', 'http://localhost:33418/cb'],
    ['another path', 'https://app.example.com/oauth/callback2'],
    ['a sub-path', 'https://app.example.com/oauth/callback/evil'],
    ['a dot segment', 'https://app.example.com/oauth/../oauth/callback'],
    ['a trailing slash', 'https://app.example.com/oauth/callback/'],
    ['another scheme', 'http://app.example.com/oauth/callback'],
    ['another host case', 'https://APP.example.com/oauth/callback'],
    ['an added query', 'https://app.example.com/oauth/callback?next=https://evil.example.com'],
    ['a fragment', 'https://app.example.com/oauth/callback#https://evil.example.com'],
    ['user info', 'https://app.example.com/oauth/callback@evil.example.com'],
    ['user info before the host', 'https://app.example.com@evil.example.com/oauth/callback'],
    ['a look-alike host', 'https://app.example.com.evil.example.com/oauth/callback'],
    ['an encoded slash', 'https://app.example.com%2F@evil.example.com/oauth/callback'],
  ])('refuses %s', (_label, uri) => {
    expect(isRegisteredRedirect(registered, uri)).toBe(false);
  });
});

describe('the redirect back', () => {
  it('adds the code and state to the registered query, encoded', () => {
    const target = redirectWith('https://app.example.com/cb?tenant=1', {
      code: 'mcp_ac_x',
      state: 'a&b=c',
      iss: undefined,
    });
    const url = new URL(target);
    expect(url.origin + url.pathname).toBe('https://app.example.com/cb');
    expect(url.searchParams.get('tenant')).toBe('1');
    expect(url.searchParams.get('state')).toBe('a&b=c');
    expect(url.searchParams.has('iss')).toBe(false);
  });

  it('shows the host the browser will go to', () => {
    expect(redirectHost('http://127.0.0.1:33418/cb')).toBe('127.0.0.1:33418');
  });
});
