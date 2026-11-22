import type { ContractInput, ContractType } from '@/app/lib/query-fn-schema';

/** The provider form as typed; the lists are text until saved. */
export interface OidcSettingsForm {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  buttonLabel: string;
  extraScopes: string;
  allowSignup: boolean;
  allowedDomains: string;
}

// The same rules as SaveOidcSettingsBody in packages/contracts/src/auth/oidc.ts.
const ISSUER = /^https?:\/\/[^\s]+$/;
const SCOPES = /^[\x21\x23-\x5b\x5d-\x7e]+( [\x21\x23-\x5b\x5d-\x7e]+)*$/;
const DOMAIN =
  /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export const LIMITS = {
  issuer: 512,
  clientId: 255,
  clientSecret: 1024,
  buttonLabel: 60,
  extraScopes: 255,
};

export const formFromStatus = (status: ContractType<'OidcSettingsStatus'>): OidcSettingsForm => ({
  enabled: status.enabled,
  issuer: status.issuer ?? '',
  clientId: status.clientId ?? '',
  clientSecret: '',
  buttonLabel: status.buttonLabel ?? '',
  extraScopes: status.extraScopes ?? '',
  allowSignup: status.allowSignup,
  allowedDomains: status.allowedDomains.join(', '),
});

const domainsOf = (text: string): string[] =>
  text
    .split(',')
    .map(domain => domain.trim())
    .filter(Boolean);

export type OidcFormProblem = 'issuer' | 'clientId' | 'extraScopes' | 'allowedDomains';

/** The first field the server would refuse, or null. */
export function formProblem(form: OidcSettingsForm): OidcFormProblem | null {
  const issuer = form.issuer.trim();
  if (!ISSUER.test(issuer) || issuer.length > LIMITS.issuer) return 'issuer';
  const clientId = form.clientId.trim();
  if (clientId.length === 0 || clientId.length > LIMITS.clientId) return 'clientId';
  const scopes = form.extraScopes.trim();
  if (scopes && (!SCOPES.test(scopes) || scopes.length > LIMITS.extraScopes)) return 'extraScopes';
  const domains = domainsOf(form.allowedDomains);
  if (domains.length > 50 || domains.some(domain => domain.length > 253 || !DOMAIN.test(domain))) {
    return 'allowedDomains';
  }
  return null;
}

/**
 * Whether an empty secret field keeps the stored secret. The server drops it
 * when the issuer or client id changes, so the hint shows only while both match.
 */
export const secretKept = (
  form: OidcSettingsForm,
  status: ContractType<'OidcSettingsStatus'>,
): boolean =>
  status.clientSecretSet &&
  form.issuer.trim() === status.issuer &&
  form.clientId.trim() === status.clientId;

/** Exactly what the form shows; an empty secret keeps the stored one (see secretKept). */
export const bodyFromForm = (form: OidcSettingsForm): ContractInput<'SaveOidcSettingsBody'> => ({
  enabled: form.enabled,
  issuer: form.issuer.trim(),
  clientId: form.clientId.trim(),
  clientSecret: form.clientSecret.trim() || null,
  buttonLabel: form.buttonLabel.trim() || null,
  extraScopes: form.extraScopes.trim() || null,
  allowSignup: form.allowSignup,
  allowedDomains: domainsOf(form.allowedDomains),
});
