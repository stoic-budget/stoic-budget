import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser, workspaceSummary } from '@/app/test/fixtures/contracts';
import { EMPTY_BUSINESS_DETAILS, type OnboardingData } from '../useOnboardingWizard';
import { workspaceLocale } from '@/app/lib/workspace-locale-api';
import { type OnboardingApi, submitOnboarding } from './onboarding-submit';

type Call = { method: string; url: string; body?: unknown; headers?: Record<string, string> };

function fakeApi(failOn?: string) {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    async (url: string, body?: unknown, config?: { headers?: Record<string, string> }) => {
      calls.push({ method, url, body, headers: config?.headers });
      if (failOn && url === failOn) throw new Error(`${url} failed`);
      if (method === 'post' && url === '/workspaces') {
        return { data: workspaceSummary({ id: 'ws-new' }) };
      }
      if (url === '/users/me/onboarding' || url === '/users/me/preferences') {
        return { data: { user: currentUser({ id: 'u-1' }) } };
      }
      return { data: {} };
    };
  const api: OnboardingApi = { post: record('post'), put: record('put'), patch: record('patch') };
  return { api, calls };
}

const base: OnboardingData = {
  locale: 'de',
  timeZone: 'Europe/Berlin',
  dateFormat: 'dmy',
  firstDayOfWeek: 1,
  workspaceName: ' Acme ',
  workspaceCurrency: 'eur',
  workspaceBackgroundImage: 'lightscape-LtnPejWDSAY-unsplash.jpg',
  profile: 'business',
  taxCountry: 'DE',
  business: { ...EMPTY_BUSINESS_DETAILS, legalName: ' Acme GmbH ' },
};

describe('submitOnboarding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes every answer and marks onboarding complete last', async () => {
    const { api, calls } = fakeApi();
    const result = await submitOnboarding(api, base, 'standard', 'ws-1');

    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([
      'patch /workspaces/ws-1',
      'put /tax/settings/jurisdiction',
      'put /business-profile',
      'put /workspaces/ws-1/locale',
      'patch /users/me/preferences',
      'patch /users/me/onboarding',
    ]);
    expect(calls[0].body).toEqual({ profile: 'business' });
    expect(calls[1].body).toEqual({ code: 'DE' });
    expect(calls[2].body).toEqual({
      legalName: 'Acme GmbH',
      taxId: undefined,
      registrationId: undefined,
      addressLines: undefined,
      countryCode: 'DE',
    });
    expect(calls[3].body).toEqual({ locale: base.locale });
    expect(calls[4].body).toEqual({ dateFormat: 'dmy', firstDayOfWeek: 1 });
    expect(calls[5].body).toEqual({
      locale: 'de',
      timeZone: 'Europe/Berlin',
      workspaceName: 'Acme',
      workspaceCurrency: 'EUR',
      workspaceBackgroundImage: 'lightscape-LtnPejWDSAY-unsplash.jpg',
    });
    expect(result).toEqual({ workspaceId: 'ws-1', user: expect.objectContaining({ id: 'u-1' }) });
  });

  it('sends the workspace-scoped writes to the workspace being set up', async () => {
    const { api, calls } = fakeApi();
    await submitOnboarding(api, base, 'standard', 'ws-1');

    for (const call of calls.filter(c => c.method === 'put')) {
      expect(call.headers).toEqual({ 'X-Workspace-Id': 'ws-1' });
    }
  });

  it('leaves tax alone when the country was deferred', async () => {
    const { api, calls } = fakeApi();
    await submitOnboarding(api, { ...base, taxCountry: null }, 'standard', 'ws-1');

    const urls = calls.map(call => call.url);
    expect(urls).not.toContain('/tax/settings/jurisdiction');
    // Business details still go out, without a country of their own.
    expect(calls.find(call => call.url === '/business-profile')?.body).toMatchObject({
      countryCode: undefined,
    });
  });

  it('never writes business details for a home workspace', async () => {
    const { api, calls } = fakeApi();
    await submitOnboarding(api, { ...base, profile: 'home' }, 'standard', 'ws-1');

    expect(calls.map(call => call.url)).not.toContain('/business-profile');
  });

  it('skips the business profile when every field is blank', async () => {
    const { api, calls } = fakeApi();
    await submitOnboarding(
      api,
      { ...base, business: { ...EMPTY_BUSINESS_DETAILS, legalName: '   ' } },
      'standard',
      'ws-1',
    );

    expect(calls.map(call => call.url)).not.toContain('/business-profile');
  });

  it('does not mark onboarding complete when a write fails', async () => {
    const { api, calls } = fakeApi('/tax/settings/jurisdiction');

    await expect(submitOnboarding(api, base, 'standard', 'ws-1')).rejects.toThrow();
    expect(calls.map(call => call.url)).not.toContain('/users/me/onboarding');
  });

  it('creates and switches to a new workspace, then scopes the tax writes to it', async () => {
    const { api, calls } = fakeApi();
    const result = await submitOnboarding(api, base, 'create-workspace', 'ws-1');

    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([
      'post /workspaces',
      'post /workspaces/ws-new/switch',
      'put /tax/settings/jurisdiction',
      'put /business-profile',
      'put /workspaces/ws-new/locale',
    ]);
    expect(calls[0].body).toEqual({
      name: 'Acme',
      currency: 'EUR',
      backgroundImage: 'lightscape-LtnPejWDSAY-unsplash.jpg',
      profile: 'business',
    });
    expect(calls[2].headers).toEqual({ 'X-Workspace-Id': 'ws-new' });
    // The language goes to the new workspace only: the account and other workspaces keep theirs.
    expect(calls[4].body).toEqual({ locale: base.locale });
    expect(calls.map(call => call.url)).not.toContain('/users/me/preferences');
    expect(result).toEqual({ workspaceId: 'ws-new' });
    // This session agrees with the stored language before the list is fetched again.
    expect(workspaceLocale({ id: 'ws-new', memberLocale: null })).toBe(base.locale);
  });
});
