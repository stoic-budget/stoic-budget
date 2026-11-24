import { afterEach, describe, expect, it } from 'vitest';
import { clearOpenWorkspaceId, readOpenWorkspaceId, writeOpenWorkspaceId } from './open-workspace';

const KEY = 'currentWorkspaceId';

describe('the workspace open in this tab (#682)', () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('keeps this tab on its workspace when another tab switches', () => {
    writeOpenWorkspaceId('ws-home');
    // Another tab switches: it shares localStorage, not this sessionStorage.
    localStorage.setItem(KEY, 'ws-business');

    expect(readOpenWorkspaceId()).toBe('ws-home');
  });

  it('starts a new tab on the last workspace picked anywhere', () => {
    localStorage.setItem(KEY, 'ws-business');

    expect(readOpenWorkspaceId()).toBe('ws-business');
  });

  it('keeps a new tab on the default it opened with', () => {
    localStorage.setItem(KEY, 'ws-business');
    readOpenWorkspaceId();
    localStorage.setItem(KEY, 'ws-home');

    expect(readOpenWorkspaceId()).toBe('ws-business');
  });

  it('keeps a past version to this tab: a new tab never opens in one', () => {
    writeOpenWorkspaceId('ws-home');
    writeOpenWorkspaceId('ws-version', { shared: false });

    expect(readOpenWorkspaceId()).toBe('ws-version');
    expect(localStorage.getItem(KEY)).toBe('ws-home');
  });

  it('forgets both on clear', () => {
    writeOpenWorkspaceId('ws-home');
    clearOpenWorkspaceId();

    expect(readOpenWorkspaceId()).toBeNull();
  });
});
