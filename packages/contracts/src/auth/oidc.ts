import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import { Timestamp, type Wire } from '../common/wire';
import { ChangePasswordBody } from '../requests/users';

/**
 * Sign-in through one OpenID Connect provider (Authentik, Keycloak, Google…)
 * that the instance administrator configures. The client secret goes in and
 * never comes back: answers only say whether one is stored.
 */

/** `GET /auth/oidc/status` (public): whether the login page shows the button. */
export const OidcPublicStatus = Schema.Struct({
  enabled: Schema.Boolean,
  /** What the administrator wrote on the button; null shows the default text. */
  buttonLabel: Schema.NullOr(Schema.String),
});
export type OidcPublicStatus = Wire<typeof OidcPublicStatus>;

/** `GET|PUT|DELETE /settings/instance/oidc` (instance admins). */
export const OidcSettingsStatus = Schema.Struct({
  configured: Schema.Boolean,
  enabled: Schema.Boolean,
  issuer: Schema.NullOr(Schema.String),
  clientId: Schema.NullOr(Schema.String),
  clientSecretSet: Schema.Boolean,
  buttonLabel: Schema.NullOr(Schema.String),
  /** Asked for on top of `openid email profile`, space-separated. */
  extraScopes: Schema.NullOr(Schema.String),
  /** A first sign-in may create an account (when sign-up is open too). */
  allowSignup: Schema.Boolean,
  /** E-mail domains a new account may have; empty allows any. */
  allowedDomains: Schema.Array(Schema.String),
  /** The address to register at the provider. */
  redirectUri: Schema.NullOr(Schema.String),
});
export type OidcSettingsStatus = Wire<typeof OidcSettingsStatus>;

const ScopeList = Schema.String.check(
  Schema.isMaxLength(255),
  Schema.isPattern(/^[\x21\x23-\x5b\x5d-\x7e]+( [\x21\x23-\x5b\x5d-\x7e]+)*$/, {
    message: 'Expected scopes separated by single spaces',
  }),
);

const Domain = Schema.String.check(
  Schema.isMaxLength(253),
  Schema.isPattern(
    /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/,
    {
      message: 'Expected a domain such as example.com',
    },
  ),
);

/**
 * `PUT /settings/instance/oidc`. A missing, null or empty secret keeps the
 * stored one while the issuer and client id stay the same; a new issuer or
 * client id without a secret drops it, so it is never sent to another provider.
 */
export const SaveOidcSettingsBody = Schema.Struct({
  enabled: Schema.Boolean,
  issuer: Schema.String.check(
    Schema.isMaxLength(512),
    Schema.isPattern(/^https?:\/\/[^\s]+$/, { message: 'Expected an http(s) address' }),
  ),
  clientId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
  clientSecret: optionalNullable(Schema.String.check(Schema.isMaxLength(1024))),
  buttonLabel: optionalNullable(Schema.String.check(Schema.isMaxLength(60))),
  extraScopes: optionalNullable(Schema.Union([ScopeList, Schema.Literal('')])),
  allowSignup: Schema.Boolean,
  allowedDomains: Schema.Array(Domain).check(Schema.isMaxLength(50)),
});
export type SaveOidcSettingsBody = Wire<typeof SaveOidcSettingsBody>;

/** One provider account linked to the signed-in user. */
export const OidcIdentity = Schema.Struct({
  id: Schema.String,
  issuer: Schema.String,
  email: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
  lastUsedAt: Schema.NullOr(Timestamp),
});
export type OidcIdentity = Wire<typeof OidcIdentity>;

/** `GET /auth/oidc/identities` and `DELETE /auth/oidc/identities/:identityId`. */
export const OidcIdentityList = Schema.Struct({
  /** False until an account made by single sign-on sets a password: its last identity stays. */
  passwordSet: Schema.Boolean,
  /** The provider is configured and on, so a new identity can be linked. */
  providerEnabled: Schema.Boolean,
  buttonLabel: Schema.NullOr(Schema.String),
  identities: Schema.Array(OidcIdentity),
});
export type OidcIdentityList = Wire<typeof OidcIdentityList>;

/**
 * `POST /auth/oidc/start`, `/auth/oidc/link` and `/auth/oidc/reauth`: the
 * provider's page the browser goes to.
 */
export const OidcAuthorization = Schema.Struct({ url: Schema.String });
export type OidcAuthorization = Wire<typeof OidcAuthorization>;

/** `POST /auth/oidc/complete`: finishes a provider sign-in, with the second factor when on. */
export const OidcCompleteBody = Schema.Struct({
  twoFactorCode: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
});
export type OidcCompleteBody = Wire<typeof OidcCompleteBody>;

/** `DELETE /auth/oidc/identities/:identityId`. */
export const OidcIdentityParams = Schema.Struct({
  identityId: Schema.String.check(Schema.isUUID()),
});
export type OidcIdentityParams = Wire<typeof OidcIdentityParams>;

/**
 * `POST /auth/oidc/link`: the account's current password. A new way to sign
 * in must not be added with a session alone, which may be borrowed or stolen.
 */
export const OidcLinkBody = Schema.Struct({
  password: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1024)),
});
export type OidcLinkBody = Wire<typeof OidcLinkBody>;

/** `POST /auth/oidc/start`: where to go after signing in, a path on this site. */
export const OidcStartBody = Schema.Struct({
  next: optionalNullable(Schema.String.check(Schema.isMaxLength(512))),
});
export type OidcStartBody = Wire<typeof OidcStartBody>;

/**
 * `POST /auth/password/set`: the first password of an account made by single
 * sign-on, after a fresh sign-in at the provider (`POST /auth/oidc/reauth`).
 * The same rule as a password change. Answers the user as `GET /auth/me` does.
 */
export const SetPasswordBody = Schema.Struct({
  newPassword: ChangePasswordBody.fields.newPassword,
});
export type SetPasswordBody = Wire<typeof SetPasswordBody>;
