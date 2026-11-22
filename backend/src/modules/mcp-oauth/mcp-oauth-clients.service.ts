import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { InstanceSetting, InstanceSettingKey } from '../../entities/instance-setting.entity';
import { McpOAuthClient } from '../../entities/mcp-oauth-client.entity';
import type { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';
import { type OAuthResult, oauthFailure } from './oauth-error';
import { redirectHost, redirectUriProblem } from './redirect-uri';

/** RFC 7591 §3.2.1: what a registration answers. */
export interface RegisteredClient {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: 'none';
}

const MAX_REDIRECT_URIS = 5;
const MAX_NAME_LENGTH = 200;
const GRANT_TYPES = ['authorization_code', 'refresh_token'];
/** Registered and never approved by anyone for this long: gone. */
const UNUSED_CLIENT_DAYS = 30;
/**
 * A name as the consent screen may show it: no control characters, no
 * zero-width or bidirectional overrides that could make one app look like another.
 */
const cleanName = (value: string): string =>
  [...value]
    .filter(char => {
      const code = char.charCodeAt(0);
      return !(
        code < 0x20 ||
        (code >= 0x7f && code <= 0x9f) ||
        (code >= 0x200b && code <= 0x200f) ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
      );
    })
    .join('')
    .trim()
    .slice(0, MAX_NAME_LENGTH);

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/**
 * Dynamic client registration for MCP clients (RFC 7591): public clients only,
 * no secret, redirect URIs on https or a loopback host, stored verbatim. Open
 * unless the instance administrator closed it; clients already registered keep
 * working either way. Unknown metadata is ignored, as §2 asks.
 */
@Injectable()
export class McpOAuthClientsService {
  private readonly logger = new Logger(McpOAuthClientsService.name);

  constructor(
    @InjectRepository(McpOAuthClient)
    private readonly clients: Repository<McpOAuthClient>,
    @InjectRepository(InstanceSetting)
    private readonly settings: Repository<InstanceSetting>,
    private readonly auditService: AuditService,
  ) {}

  async register(body: unknown): Promise<OAuthResult<RegisteredClient>> {
    if (!(await this.isRegistrationOpen())) {
      return oauthFailure('access_denied', 'Client registration is closed on this server', 403);
    }
    const metadata =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const uris = metadata.redirect_uris;
    if (!isStringList(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
      return oauthFailure('invalid_redirect_uri', `Give 1 to ${MAX_REDIRECT_URIS} redirect_uris`);
    }
    const problem = uris.map(redirectUriProblem).find(Boolean);
    if (problem) {
      return oauthFailure(
        'invalid_redirect_uri',
        `Redirect URIs must be https, or http on localhost, without user info or fragment (${problem})`,
      );
    }
    const unsupported = this.unsupportedMetadata(metadata);
    if (unsupported) {
      return oauthFailure('invalid_client_metadata', unsupported);
    }
    const name = typeof metadata.client_name === 'string' ? cleanName(metadata.client_name) : '';
    const redirectUris = [...new Set(uris)];
    await this.forgetUnusedClients();
    const client = await this.clients.save(
      this.clients.create({ clientName: name || redirectHost(redirectUris[0]), redirectUris }),
    );
    return {
      ok: true,
      value: {
        client_id: client.id,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: GRANT_TYPES,
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
    };
  }

  async findClient(clientId: string): Promise<McpOAuthClient | null> {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuid.test(clientId) ? this.clients.findOne({ where: { id: clientId } }) : null;
  }

  /** The administrator's choice wins; until then `MCP_OAUTH_REGISTRATION_ENABLED` (default open). */
  async isRegistrationOpen(): Promise<boolean> {
    const saved = await this.settings.findOne({
      where: { key: InstanceSettingKey.MCP_CLIENT_REGISTRATION },
    });
    const open = saved?.value?.open;
    return typeof open === 'boolean'
      ? open
      : process.env.MCP_OAUTH_REGISTRATION_ENABLED !== 'false';
  }

  async setRegistrationOpen(user: User, open: boolean): Promise<void> {
    const before = await this.isRegistrationOpen();
    const existing = await this.settings.findOne({
      where: { key: InstanceSettingKey.MCP_CLIENT_REGISTRATION },
    });
    await this.settings.save(
      this.settings.create({
        ...existing,
        key: InstanceSettingKey.MCP_CLIENT_REGISTRATION,
        value: { open },
        updatedByUserId: user.id,
      }),
    );
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      diff: {
        before: { mcpClientRegistrationOpen: before },
        after: { mcpClientRegistrationOpen: open },
      },
      meta: { mcpClientRegistrationOpen: open },
    });
  }

  private unsupportedMetadata(metadata: Record<string, unknown>): string | null {
    const method = metadata.token_endpoint_auth_method;
    if (method !== undefined && method !== 'none') {
      return 'Only public clients are supported: token_endpoint_auth_method must be none';
    }
    const grantTypes = metadata.grant_types;
    if (
      grantTypes !== undefined &&
      !(
        isStringList(grantTypes) &&
        grantTypes.includes('authorization_code') &&
        grantTypes.every(type => GRANT_TYPES.includes(type))
      )
    ) {
      return 'grant_types may only be authorization_code and refresh_token';
    }
    const responseTypes = metadata.response_types;
    if (
      responseTypes !== undefined &&
      !(isStringList(responseTypes) && responseTypes.every(type => type === 'code'))
    ) {
      return 'response_types may only be code';
    }
    return null;
  }

  /** Clients nobody approved within a month: registration is anonymous, so the table is kept small. */
  private async forgetUnusedClients(): Promise<void> {
    await this.clients.query(
      `DELETE FROM mcp_oauth_clients c
        WHERE c.created_at < now() - make_interval(days => $1)
          AND NOT EXISTS (SELECT 1 FROM mcp_oauth_grants g WHERE g.client_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM mcp_oauth_codes k WHERE k.client_id = c.id)`,
      [UNUSED_CLIENT_DAYS],
    );
  }
}
