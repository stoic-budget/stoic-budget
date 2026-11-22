import { loggableUrl } from '@/common/observability/loggable-url';

const TOKEN = 'feedTokenForMemberOne_0123456789ab';

describe('loggableUrl', () => {
  it('keeps the url of an ordinary route', () => {
    const request = { url: '/payables/abc?status=open', route: { path: '/payables/:id' } };
    expect(loggableUrl(request)).toBe('/payables/abc?status=open');
  });

  it('logs the pattern of a route under /public/, whatever the prefix', () => {
    expect(
      loggableUrl({
        url: `/api/v1/public/calendar/${TOKEN}.ics`,
        baseUrl: '/api/v1',
        route: { path: '/public/calendar/:token.ics' },
      }),
    ).toBe('/api/v1/public/calendar/:token.ics');
  });

  it('logs the pattern of a route taking a :token, or one marked public', () => {
    const invitation = { url: `/workspaces/invitations/${TOKEN}`, route: { path: '/workspaces/invitations/:token' } };
    expect(loggableUrl(invitation)).toBe('/workspaces/invitations/:token');
    const marked = { url: `/auth/verify-email?token=${TOKEN}`, route: { path: '/auth/verify-email' } };
    expect(loggableUrl(marked, true)).toBe('/auth/verify-email');
  });

  it('cuts a public url before its secret when no route matched', () => {
    expect(loggableUrl({ url: `/public/invoices/${TOKEN}/pdf` })).toBe('/public/…');
    expect(loggableUrl({ url: `/somewhere/${TOKEN}` }, true)).toBe('(public route)');
  });
});
