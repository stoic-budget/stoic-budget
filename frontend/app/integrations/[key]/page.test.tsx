// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.hoisted(() => vi.fn());
const openAppPanel = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ current: { key: 'imap' } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useParams: () => params.current,
}));
vi.mock('@/app/components/panels/app-panels-store', () => ({ openAppPanel }));

import IntegrationRoute from './page';

describe('/integrations/<key>', () => {
  beforeEach(() => {
    replace.mockReset();
    openAppPanel.mockReset();
  });

  it('sends the file stores and the app address to their panels in Settings', () => {
    for (const [key, href] of [
      ['s3-compatible', '/settings/profile?tab=sync&section=s3-compatible'],
      ['webdav', '/settings/profile?tab=sync&section=webdav'],
      ['app-url', '/settings/profile?tab=data&section=app-url'],
    ]) {
      params.current = { key };
      render(<IntegrationRoute />);
      expect(replace).toHaveBeenLastCalledWith(href);
    }
    expect(openAppPanel).not.toHaveBeenCalled();
  });

  it('opens any other key in the panel, a name Object happens to have included', () => {
    for (const key of ['imap', 'constructor']) {
      params.current = { key };
      render(<IntegrationRoute />);
      expect(openAppPanel).toHaveBeenLastCalledWith('plugins', key);
    }
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });
});
