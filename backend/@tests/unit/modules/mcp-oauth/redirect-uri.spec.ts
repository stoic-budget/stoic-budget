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

describe('loopback redirect URIs (RFC 8252 §7.3)', () => {
  const registered = [
    'http://127.0.0.1:33418/cb',
    'http://[::1]:8080/cb?tenant=1',
    'http://localhost/oauth/callback',
    'https://app.example.com:8443/cb',
  ];

  it.each([
    ['another port on 127.0.0.1', 'http://127.0.0.1:51004/cb'],
    ['no port on 127.0.0.1', 'http://127.0.0.1/cb'],
    ['another port on [::1], same query', 'http://[::1]:61000/cb?tenant=1'],
    ['a port on localhost registered without one', 'http://localhost:6274/oauth/callback'],
  ])('accepts %s', (_label, uri) => {
    expect(isRegisteredRedirect(registered, uri)).toBe(true);
  });

  it.each([
    ['another port on a non-loopback host', 'https://app.example.com:9443/cb'],
    ['no port on a non-loopback host', 'https://app.example.com/cb'],
    ['localhost for 127.0.0.1', 'http://localhost:33418/cb'],
    ['127.0.0.1 for localhost', 'http://127.0.0.1:6274/oauth/callback'],
    ['127.0.0.1 for [::1]', 'http://127.0.0.1:8080/cb?tenant=1'],
    ['another path', 'http://127.0.0.1:51004/cb2'],
    ['a sub-path', 'http://127.0.0.1:51004/cb/evil'],
    ['a trailing slash', 'http://127.0.0.1:51004/cb/'],
    ['another query', 'http://[::1]:61000/cb?tenant=2'],
    ['a dropped query', 'http://[::1]:61000/cb'],
    ['https on loopback', 'https://127.0.0.1:51004/cb'],
    ['upper-case scheme', 'HTTP://127.0.0.1:51004/cb'],
    ['upper-case host', 'http://LOCALHOST:6274/oauth/callback'],
    ['a fragment', 'http://127.0.0.1:51004/cb#x'],
    ['user info', 'http://127.0.0.1:51004@evil.example.com/cb'],
    ['user info before the host', 'http://evil@127.0.0.1:51004/cb'],
    ['a look-alike host', 'http://localhost.example.com:6274/oauth/callback'],
    ['a port out of range', 'http://127.0.0.1:99999/cb'],
    ['an empty port', 'http://127.0.0.1:/cb'],
    ['a backslash', 'http://127.0.0.1:51004\\@evil.example.com/cb'],
  ])('refuses %s', (_label, uri) => {
    expect(isRegisteredRedirect(registered, uri)).toBe(false);
  });

  it('lets localhost and 127.0.0.1 both through only when both are registered', () => {
    const both = ['http://127.0.0.1:1/cb', 'http://localhost:1/cb'];
    expect(isRegisteredRedirect(both, 'http://127.0.0.1:2/cb')).toBe(true);
    expect(isRegisteredRedirect(both, 'http://localhost:2/cb')).toBe(true);
    expect(isRegisteredRedirect(both, 'http://[::1]:2/cb')).toBe(false);
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
