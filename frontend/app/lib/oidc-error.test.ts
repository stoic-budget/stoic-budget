import { describe, expect, it, vi } from 'vitest';

vi.mock('./api-error', () => ({
  translateErrorCode: (code: string) =>
    ({
      OIDC_ACCOUNT_EXISTS: 'Sign in with your password first',
      AUTH_ACCOUNT_INACTIVE: 'Inactive',
      // A real code, but not one the sign-in sends: a crafted link must not pick it.
      AUTH_2FA_CODE_INVALID: 'Invalid two-factor code',
    })[code],
}));

import { oidcErrorMessage } from './oidc-error';

describe('oidcErrorMessage', () => {
  it('says nothing without a code', () => {
    expect(oidcErrorMessage(null, 'Fallback')).toBeNull();
  });

  it('translates our own codes', () => {
    expect(oidcErrorMessage('OIDC_ACCOUNT_EXISTS', 'Fallback')).toBe('Sign in with your password first');
    expect(oidcErrorMessage('AUTH_ACCOUNT_INACTIVE', 'Fallback')).toBe('Inactive');
  });

  it('never shows text someone put in the link', () => {
    for (const code of ['Call 555-0100 to restore your account', 'AUTH_2FA_CODE_INVALID', 'OIDC_<b>', 'oidc_x']) {
      expect(oidcErrorMessage(code, 'Fallback')).toBe('Fallback');
    }
  });

  it('falls back for an OIDC code the dictionary does not know yet', () => {
    expect(oidcErrorMessage('OIDC_SOMETHING_NEW', 'Fallback')).toBe('Fallback');
  });
});
