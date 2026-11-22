import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { QueryDeepPartialEntity, Repository } from 'typeorm';
import { decryptText, encryptText } from '../../../common/utils/encryption.util';
import type {
  OidcPublicStatus,
  OidcSettingsStatus,
  SaveOidcSettingsBody,
} from '../../../contracts';
import { InstanceSetting, InstanceSettingKey, type User } from '../../../entities';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../security-audit.util';
import { isAllowedProviderUrl, OidcProviderClient } from './oidc-provider.client';
import { OidcRefusal } from './oidc-refusal';

/** The provider as the sign-in uses it, secret decrypted. Never leaves the backend. */
export interface OidcConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string | null;
  buttonLabel: string | null;
  extraScopes: string | null;
  allowSignup: boolean;
  allowedDomains: string[];
}

type StoredValue = Omit<OidcConfig, 'clientSecret'>;

const readValue = (value: Record<string, unknown> | null): StoredValue | null => {
  if (!value || typeof value.issuer !== 'string' || typeof value.clientId !== 'string') return null;
  const text = (key: string) =>
    typeof value[key] === 'string' && value[key] ? (value[key] as string) : null;
  return {
    enabled: value.enabled === true,
    issuer: value.issuer,
    clientId: value.clientId,
    buttonLabel: text('buttonLabel'),
    extraScopes: text('extraScopes'),
    allowSignup: value.allowSignup === true,
    allowedDomains: Array.isArray(value.allowedDomains)
      ? value.allowedDomains.filter((domain): domain is string => typeof domain === 'string')
      : [],
  };
};

/** The public address of this install, from APP_URL or FRONTEND_URL only. */
export function appOrigin(): string | null {
  const configured = (process.env.APP_URL || process.env.FRONTEND_URL || '').trim();
  try {
    return configured ? new URL(configured).origin : null;
  } catch {
    return null;
  }
}

/** Where the provider sends the browser back: the API behind the app's /api proxy. */
export const oidcRedirectUri = (): string | null => {
  const origin = appOrigin();
  return origin ? `${origin}/api/v1/auth/oidc/callback` : null;
};

/**
 * The one OpenID Connect provider of this server, kept in instance settings.
 * The client secret is encrypted at rest and only ever reported as set or not.
 */
@Injectable()
export class OidcSettingsService {
  private readonly logger = new Logger(OidcSettingsService.name);

  constructor(
    @InjectRepository(InstanceSetting)
    private readonly settings: Repository<InstanceSetting>,
    private readonly provider: OidcProviderClient,
    private readonly auditService: AuditService,
  ) {}

  /** The provider when it is configured and switched on; null otherwise. */
  async active(): Promise<OidcConfig | null> {
    const config = await this.read();
    return config?.enabled && oidcRedirectUri() ? config : null;
  }

  async publicStatus(): Promise<OidcPublicStatus> {
    const config = await this.active();
    return { enabled: Boolean(config), buttonLabel: config?.buttonLabel ?? null };
  }

  async status(): Promise<OidcSettingsStatus> {
    const row = await this.row();
    const value = readValue(row?.value ?? null);
    return {
      configured: Boolean(value),
      enabled: value?.enabled ?? false,
      issuer: value?.issuer ?? null,
      clientId: value?.clientId ?? null,
      clientSecretSet: Boolean(row?.encryptedSecrets?.clientSecret),
      buttonLabel: value?.buttonLabel ?? null,
      extraScopes: value?.extraScopes ?? null,
      allowSignup: value?.allowSignup ?? false,
      allowedDomains: value?.allowedDomains ?? [],
      redirectUri: oidcRedirectUri(),
    };
  }

  /**
   * Saves the provider. Switching it on first asks the provider for its
   * discovery document, so a wrong issuer is refused here and not at the
   * first person's sign-in.
   */
  async save(user: User, body: SaveOidcSettingsBody): Promise<OidcSettingsStatus> {
    const issuer = body.issuer.trim();
    if (!isAllowedProviderUrl(issuer)) throw new OidcRefusal('OIDC_ISSUER_INSECURE');
    this.provider.forget();
    if (body.enabled) await this.provider.discover(issuer);

    const before = await this.status();
    const existing = await this.row();
    const newSecret = body.clientSecret?.trim() || null;
    // The stored secret belongs to one client at one provider: a new issuer
    // or client id without a new secret drops it rather than send it there.
    const stored = readValue(existing?.value ?? null);
    const sameClient = stored?.issuer === issuer && stored.clientId === body.clientId.trim();
    const keptSecrets = sameClient ? (existing?.encryptedSecrets ?? {}) : {};
    const value: StoredValue = {
      enabled: body.enabled,
      issuer,
      clientId: body.clientId.trim(),
      buttonLabel: body.buttonLabel?.trim() || null,
      extraScopes: body.extraScopes?.trim() || null,
      allowSignup: body.allowSignup,
      allowedDomains: [...new Set(body.allowedDomains.map(domain => domain.trim().toLowerCase()))],
    };
    // An upsert on the unique key: two saves at once (a double click) both land.
    await this.settings.upsert(
      {
        key: InstanceSettingKey.OIDC,
        // jsonb: TypeORM's deep-partial type cannot take a null inside it.
        value: { ...value } as QueryDeepPartialEntity<InstanceSetting>['value'],
        encryptedSecrets: newSecret ? { clientSecret: encryptText(newSecret) } : keptSecrets,
        updatedByUserId: user.id,
      },
      ['key'],
    );
    const after = await this.status();
    await this.audit(
      user,
      before,
      after,
      Boolean(newSecret) || before.clientSecretSet !== after.clientSecretSet,
    );
    return after;
  }

  async clear(user: User): Promise<OidcSettingsStatus> {
    const before = await this.status();
    await this.settings.delete({ key: InstanceSettingKey.OIDC });
    this.provider.forget();
    const after = await this.status();
    await this.audit(user, before, after, before.clientSecretSet);
    return after;
  }

  private async read(): Promise<OidcConfig | null> {
    const row = await this.row();
    const value = readValue(row?.value ?? null);
    if (!value) return null;
    const secret = row?.encryptedSecrets?.clientSecret;
    return { ...value, clientSecret: secret ? decryptText(secret) : null };
  }

  private row(): Promise<InstanceSetting | null> {
    return this.settings.findOne({ where: { key: InstanceSettingKey.OIDC } });
  }

  /** The diff holds what the status shows: the secret only as "changed", never its value. */
  private async audit(
    user: User,
    before: OidcSettingsStatus,
    after: OidcSettingsStatus,
    secretChanged: boolean,
  ): Promise<void> {
    const shown = ({ redirectUri: _redirect, ...rest }: OidcSettingsStatus) => rest;
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      diff: { before: shown(before), after: shown(after) },
      meta: { oidcEvent: 'settings_changed', clientSecretChanged: secretChanged },
    });
  }
}
