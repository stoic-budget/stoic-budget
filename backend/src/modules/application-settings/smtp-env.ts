import { pinPublicEgressHost } from '../../common/utils/egress-url.util';
import type { SmtpRuntimeSettings } from './application-settings.service';

/** The instance's own SMTP server from SMTP_*: what mail uses without workspace settings. */
export function smtpFromEnv(
  positiveNumber: (value: unknown, fallback: number) => number,
): SmtpRuntimeSettings {
  const env = {
    host: process.env.SMTP_HOST || null,
    port: positiveNumber(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || null,
    replyTo: process.env.SMTP_REPLY_TO || null,
    timeoutMs: positiveNumber(process.env.SMTP_TIMEOUT_MS, 10000),
  };
  return env.host && env.from ? { ...env, source: 'env' } : { ...env, source: 'disabled' };
}

/**
 * Where an SMTP transport for `host` connects. A host from a workspace's
 * settings is user input: it was checked when saved and is resolved and checked
 * again here, so the socket goes to the address that passed (DNS rebinding).
 * The SMTP_* env host is the operator's own and may be a private relay.
 */
export function smtpConnectTarget(
  smtp: SmtpRuntimeSettings | null | undefined,
  host: string,
): Promise<{ host: string; servername?: string }> {
  const workspaceHost =
    smtp?.source !== 'env' && smtp?.host === host && host !== process.env.SMTP_HOST;
  return workspaceHost ? pinPublicEgressHost(host) : Promise.resolve({ host });
}
