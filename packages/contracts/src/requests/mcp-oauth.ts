import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';
import { ApiKeyScope } from './api-keys';

const Text = (maxLength: number) => Schema.String.check(Schema.isMaxLength(maxLength));

/**
 * The authorization request (RFC 6749 §4.1.1 with PKCE and RFC 8707), as the
 * consent page read it from its own URL. Checked by the server, not trusted.
 */
const AuthorizationRequest = {
  clientId: Text(64),
  redirectUri: Text(2000),
  responseType: Schema.optional(Text(32)),
  codeChallenge: Schema.optional(Text(128)),
  codeChallengeMethod: Schema.optional(Text(16)),
  state: Schema.optional(Text(2000)),
  resource: Schema.optional(Text(2000)),
};

/** `GET /oauth/consent`. */
export const McpOAuthConsentQuery = Schema.Struct({
  ...AuthorizationRequest,
  scope: Schema.optional(Text(4000)),
});
export type McpOAuthConsentQuery = Wire<typeof McpOAuthConsentQuery>;

/** `POST /oauth/consent`: the person's answer, with the request it answers. */
export const McpOAuthDecisionBody = Schema.Struct({
  ...AuthorizationRequest,
  approve: Schema.Boolean,
  workspaceId: Schema.String.check(Schema.isUUID()),
  scopes: Schema.Array(ApiKeyScope).check(Schema.isUnique(), Schema.isMaxLength(200)),
});
export type McpOAuthDecisionBody = Wire<typeof McpOAuthDecisionBody>;

/** `DELETE /mcp-oauth/grants/:id` and `DELETE /mcp-oauth/workspace/grants/:id`. */
export const McpOAuthGrantIdParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type McpOAuthGrantIdParams = Wire<typeof McpOAuthGrantIdParams>;
