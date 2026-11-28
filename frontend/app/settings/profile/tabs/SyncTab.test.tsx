// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Labels resolve to their key path, so a panel is found by the text it reads.
const textProxy = (path: string): unknown =>
  new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === 'value' ? path : textProxy(path ? `${path}.${String(prop)}` : String(prop)),
    },
  );

vi.mock('@/app/i18n', () => ({ useIntlayer: (key: string) => textProxy(key) }));
vi.mock('@/app/settings/profile/hooks/useSettingsText', () => ({
  useSettingsText: () => ({ tx: (path: string[]) => path.join('.') }),
}));
vi.mock('@/app/settings/profile/hooks/useSync', () => ({
  useSync: () => ({
    bankStats: [],
    totalCount: 0,
    statsLoading: false,
    downloading: false,
    errorMessage: null,
    handleExportZip: vi.fn(),
  }),
}));
vi.mock('@/app/settings/profile/components/SyncSection', () => ({
  SyncSection: () => <div>archive and backups</div>,
}));
// The form loads its status from the API; here only which store it was given matters.
vi.mock('@/app/integrations/open-protocol-page', () => ({
  ProtocolIntegrationPage: ({ settingsPath }: { settingsPath: string }) => (
    <div data-testid="connection-form">{settingsPath}</div>
  ),
}));

import { SyncTab } from './SyncTab';

const props = {
  user: {} as never,
  setUser: vi.fn(),
  logout: vi.fn(async () => undefined),
};

describe('SyncTab', () => {
  it('holds the archive panel and the S3 and WebDAV forms', () => {
    render(<SyncTab section={null} {...props} />);

    expect(screen.getByText('syncCard.title')).toBeTruthy();
    expect(screen.getByText('integrationCatalog.entries.s3.name')).toBeTruthy();
    expect(screen.getByText('integrationCatalog.entries.webdav.name')).toBeTruthy();
    const forms = screen.getAllByTestId('connection-form').map(node => node.textContent);
    expect(forms).toEqual(['/integrations/s3-compatible/settings', '/integrations/webdav/settings']);
  });

  it('opens the deep-linked panel', () => {
    render(<SyncTab section="webdav" {...props} />);

    const webdav = document.getElementById('settings-section-webdav');
    expect(webdav?.querySelector('[aria-expanded="true"]')).toBeTruthy();
    const backup = document.getElementById('settings-section-backup');
    expect(backup?.querySelector('[aria-expanded="true"]')).toBeNull();
  });
});
