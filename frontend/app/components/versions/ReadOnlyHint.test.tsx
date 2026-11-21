import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDemoStatusForTests } from '@/app/hooks/useDemoStatus';
import { ReadOnlyHint } from './ReadOnlyHint';

const VERSION_HINT = 'A past version can only be viewed';
const DEMO_HINT = 'A demo can only be viewed';

const state = vi.hoisted(() => ({ inVersion: false }));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useReadOnlyWorkspace: () => ({ isReadOnly: state.inVersion, version: null }),
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: (key: string) => ({
    readOnlyHint: { value: key === 'demoBanner' ? DEMO_HINT : VERSION_HINT },
  }),
}));

const renderButton = () =>
  render(
    <ReadOnlyHint>
      <button type="button">Save</button>
    </ReadOnlyHint>,
  );

describe('ReadOnlyHint', () => {
  afterEach(() => {
    state.inVersion = false;
    act(() => setDemoStatusForTests(null));
  });

  it('leaves the button alone in a live workspace', () => {
    renderButton();
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.parentElement?.getAttribute('title')).toBeNull();
  });

  it('disables it inside a past version and says so', () => {
    state.inVersion = true;
    renderButton();
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.parentElement?.getAttribute('title')).toBe(VERSION_HINT);
  });

  it('disables it on a demo server and says it is a demo', () => {
    act(() => setDemoStatusForTests({ enabled: true, account: null }));
    renderButton();
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.parentElement?.getAttribute('title')).toBe(DEMO_HINT);
  });
});
