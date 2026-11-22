import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SystemHealthCheck } from '../../contracts';
import {
  appUrlVerdict,
  type BackupFolderFacts,
  backupsVerdict,
  encryptionKeyVerdict,
  pushVerdict,
  smtpVerdict,
} from './health-verdicts';

type Env = Record<string, string | undefined>;
const set = (env: Env, name: string): boolean => Boolean(env[name]?.trim());

/**
 * Whether the backup folder takes a file, by writing and removing one: a
 * read-only mount or a wrong owner passes an existence check and fails the
 * first scheduled backup. The folder is not created here: a look at the health
 * page must not make one, and a missing folder is often a volume that was not
 * mounted, whose backups would land on the container's own disk.
 */
export async function inspectBackupFolder(root: string | undefined): Promise<BackupFolderFacts> {
  if (!root?.trim()) {
    return { configured: false };
  }
  const probe = path.join(root, `.health-probe-${randomUUID()}`);
  try {
    await fs.writeFile(probe, '', { flag: 'wx' });
    await fs.rm(probe, { force: true });
  } catch {
    return { configured: true, writable: false };
  }
  try {
    const stats = await fs.statfs(root);
    return { configured: true, writable: true, freeBytes: stats.bavail * stats.bsize };
  } catch {
    return { configured: true, writable: true, freeBytes: null };
  }
}

export interface ConfigInputs {
  env: Env;
  redisUp: boolean;
  lastSmtpSend: { ok: boolean; at: Date } | null;
  backupFolder: BackupFolderFacts;
  /** The origin the admin's browser opened the app at, if it said. */
  openedOrigin: string | null;
}

/** The setup checklist. Each secret is only reported as set or not. */
export function configChecks(inputs: ConfigInputs): SystemHealthCheck[] {
  const { env } = inputs;
  return [
    smtpVerdict({
      configured: set(env, 'SMTP_HOST') && set(env, 'SMTP_FROM'),
      redisUp: inputs.redisUp,
      lastSend: inputs.lastSmtpSend,
    }),
    pushVerdict(set(env, 'WEB_PUSH_VAPID_PUBLIC_KEY'), set(env, 'WEB_PUSH_VAPID_PRIVATE_KEY')),
    backupsVerdict(inputs.backupFolder),
    appUrlVerdict(env.APP_URL?.trim() || env.FRONTEND_URL?.trim() || null, inputs.openedOrigin),
    encryptionKeyVerdict(set(env, 'INTEGRATIONS_ENCRYPTION_KEY'), set(env, 'JWT_SECRET')),
  ];
}
