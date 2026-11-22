import { Controller, Get, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { APP_NAME } from '../../common/brand';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { McpOAuthClientsService } from './mcp-oauth-clients.service';
import { McpOAuthTokensService } from './mcp-oauth-tokens.service';
import { PKCE_METHOD } from './oauth-crypto';
import { type OAuthResult, oauthFailure, sendNoStore, sendOAuthResult } from './oauth-error';
import { mcpResourceUrl, publicOrigin } from './oauth-origin';

/** A form field as one string; repeated or nested fields count as missing. */
const field = (body: unknown, name: string): string | undefined => {
  const value =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const unavailable = (response: Response) =>
  sendNoStore(response, HttpStatus.NOT_FOUND, {
    error: 'temporarily_unavailable',
    error_description: 'OAuth needs APP_URL or FRONTEND_URL on the server',
  });

/**
 * The OAuth 2.1 authorization server and protected resource metadata for the
 * MCP endpoint, and the endpoints a client talks to without a session:
 * registration, token and revocation. Answers follow the RFCs, not the app's
 * error format. The frontend proxies the `/.well-known` paths here.
 */
@ApiTags('MCP OAuth')
@Public()
@Controller('oauth')
export class McpOAuthController {
  constructor(
    private readonly clients: McpOAuthClientsService,
    private readonly tokens: McpOAuthTokensService,
  ) {}

  /** RFC 9728. No `scopes_supported`: clients would ask for all of them; people pick on consent. */
  @Get('protected-resource')
  @ApiOperation({ summary: 'OAuth protected resource metadata for the MCP endpoint (RFC 9728)' })
  protectedResource(@Res() response: Response): void {
    const origin = publicOrigin();
    if (!origin) {
      unavailable(response);
      return;
    }
    response.json({
      resource: mcpResourceUrl(origin),
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
      resource_name: APP_NAME,
    });
  }

  /** RFC 8414. The registration endpoint is left out while registration is closed. */
  @Get('authorization-server')
  @ApiOperation({ summary: 'OAuth authorization server metadata (RFC 8414)' })
  async authorizationServer(@Res() response: Response): Promise<void> {
    const origin = publicOrigin();
    if (!origin) {
      unavailable(response);
      return;
    }
    const open = await this.clients.isRegistrationOpen();
    response.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/api/v1/oauth/token`,
      ...(open ? { registration_endpoint: `${origin}/api/v1/oauth/register` } : {}),
      revocation_endpoint: `${origin}/api/v1/oauth/revoke`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: [PKCE_METHOD],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      authorization_response_iss_parameter_supported: true,
    });
  }

  /** RFC 7591. Anonymous by design, so held to ten registrations an hour per address. */
  @Post('register')
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Register an MCP client (RFC 7591, public clients only)' })
  async register(@Req() request: Request, @Res() response: Response): Promise<void> {
    sendOAuthResult(response, await this.clients.register(request.body), HttpStatus.CREATED);
  }

  @Post('token')
  @SkipCsrf()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a code or rotate a refresh token' })
  async token(@Req() request: Request, @Res() response: Response): Promise<void> {
    sendOAuthResult(response, await this.grant(request.body));
  }

  /** RFC 7009: 200 whether or not the token was known. */
  @Post('revoke')
  @SkipCsrf()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revoke a token and the grant behind it (RFC 7009)' })
  async revoke(@Req() request: Request, @Res() response: Response): Promise<void> {
    const token = field(request.body, 'token');
    if (!token) {
      sendOAuthResult(response, oauthFailure('invalid_request', 'token is required'));
      return;
    }
    await this.tokens.revokeToken(token, field(request.body, 'client_id'));
    sendNoStore(response, HttpStatus.OK, {});
  }

  private async grant(body: unknown): Promise<OAuthResult<object>> {
    const grantType = field(body, 'grant_type');
    const clientId = field(body, 'client_id');
    if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
      return oauthFailure('unsupported_grant_type', 'Use authorization_code or refresh_token');
    }
    if (!(clientId && (await this.clients.findClient(clientId)))) {
      return oauthFailure('invalid_client', 'Unknown client_id', HttpStatus.UNAUTHORIZED);
    }
    const resource = field(body, 'resource');
    if (grantType === 'refresh_token') {
      const refreshToken = field(body, 'refresh_token');
      return refreshToken
        ? this.tokens.refresh({ refreshToken, clientId, resource, scope: field(body, 'scope') })
        : oauthFailure('invalid_request', 'refresh_token is required');
    }
    const code = field(body, 'code');
    const codeVerifier = field(body, 'code_verifier');
    const redirectUri = field(body, 'redirect_uri');
    if (!(code && codeVerifier && redirectUri)) {
      return oauthFailure('invalid_request', 'code, code_verifier and redirect_uri are required');
    }
    return this.tokens.exchangeCode({ code, codeVerifier, redirectUri, clientId, resource });
  }
}
