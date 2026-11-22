import { describe, expect, it } from 'vitest';
import { assertMatchesContract } from '@/app/lib/contract-check';
import {
  bodyFromForm,
  formFromStatus,
  formProblem,
  type OidcSettingsForm,
  secretKept,
} from './oidc-settings-form';

const base: OidcSettingsForm = {
  enabled: true,
  issuer: 'https://login.example.com/application/o/stoic/',
  clientId: 'stoic-client',
  clientSecret: '',
  buttonLabel: 'ACME Login',
  extraScopes: '',
  allowSignup: false,
  allowedDomains: '',
};

const acceptedByContract = (form: OidcSettingsForm): boolean => {
  try {
    assertMatchesContract('SaveOidcSettingsBody', bodyFromForm(form), '/settings/instance/oidc', 'error');
    return true;
  } catch {
    return false;
  }
};

describe('the single sign-on form', () => {
  it.each<[string, Partial<OidcSettingsForm>]>([
    ['the defaults', {}],
    ['a plain http issuer', { issuer: 'http://login.example.com' }],
    ['an issuer that is not a URL', { issuer: 'login.example.com' }],
    ['an issuer with a space', { issuer: 'https://login.example.com/a b' }],
    ['an issuer at the length limit', { issuer: `https://${'a'.repeat(504)}` }],
    ['an issuer past the length limit', { issuer: `https://${'a'.repeat(505)}` }],
    ['an empty client id', { clientId: '  ' }],
    ['one extra scope', { extraScopes: 'groups' }],
    ['two scopes and a URI-like one', { extraScopes: 'groups offline_access https://example.com/x' }],
    ['scopes with two spaces between them', { extraScopes: 'groups  roles' }],
    ['a scope with a quote', { extraScopes: 'gr"oups' }],
    ['a scope with a backslash', { extraScopes: 'gr\\oups' }],
    ['domains with spaces around commas', { allowedDomains: ' example.com , example.co.il ' }],
    ['a domain without a dot', { allowedDomains: 'localhost' }],
    ['a domain with a scheme', { allowedDomains: 'https://example.com' }],
    ['a domain ending in a hyphen', { allowedDomains: 'example-.com' }],
    ['upper-case domains', { allowedDomains: 'Example.COM' }],
    ['fifty domains', { allowedDomains: Array.from({ length: 50 }, (_, i) => `d${i}.example.com`).join(',') }],
    ['fifty-one domains', { allowedDomains: Array.from({ length: 51 }, (_, i) => `d${i}.example.com`).join(',') }],
  ])('refuses exactly what the API refuses: %s', (_label, change) => {
    const form = { ...base, ...change };
    expect(formProblem(form) === null).toBe(acceptedByContract(form));
  });

  it('sends what it shows: an empty secret keeps the stored one, lists become arrays', () => {
    expect(
      bodyFromForm({ ...base, clientSecret: '  ', extraScopes: ' groups ', allowedDomains: 'example.com, ,example.co.il' }),
    ).toEqual({
      enabled: true,
      issuer: 'https://login.example.com/application/o/stoic/',
      clientId: 'stoic-client',
      clientSecret: null,
      buttonLabel: 'ACME Login',
      extraScopes: 'groups',
      allowSignup: false,
      allowedDomains: ['example.com', 'example.co.il'],
    });
  });

  it('starts from the stored settings with the secret empty', () => {
    expect(
      formFromStatus({
        configured: true,
        enabled: false,
        issuer: 'https://login.example.com',
        clientId: 'stoic-client',
        clientSecretSet: true,
        buttonLabel: null,
        extraScopes: null,
        allowSignup: true,
        allowedDomains: ['example.com', 'example.co.il'],
        redirectUri: 'https://app.example.com/api/v1/auth/oidc/callback',
      }),
    ).toEqual({
      ...base,
      enabled: false,
      issuer: 'https://login.example.com',
      buttonLabel: '',
      allowSignup: true,
      allowedDomains: 'example.com, example.co.il',
    });
  });

  it('says an empty secret keeps the stored one only while the issuer and client stay', () => {
    const status = {
      configured: true,
      enabled: true,
      issuer: base.issuer,
      clientId: base.clientId,
      clientSecretSet: true,
      buttonLabel: null,
      extraScopes: null,
      allowSignup: false,
      allowedDomains: [],
      redirectUri: null,
    };
    expect(secretKept(base, status)).toBe(true);
    expect(secretKept({ ...base, issuer: 'https://other.example.com' }, status)).toBe(false);
    expect(secretKept({ ...base, clientId: 'other-client' }, status)).toBe(false);
    expect(secretKept(base, { ...status, clientSecretSet: false })).toBe(false);
  });
});
