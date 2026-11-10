import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configChecks, inspectBackupFolder } from '@/modules/system-health/config-checks';

describe('inspectBackupFolder', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'health-backups-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('is off without BACKUP_LOCAL_ROOT', async () => {
    await expect(inspectBackupFolder(undefined)).resolves.toEqual({ configured: false });
    await expect(inspectBackupFolder('  ')).resolves.toEqual({ configured: false });
  });

  it('writes and removes a probe, and reads the free space', async () => {
    const facts = await inspectBackupFolder(dir);
    expect(facts).toMatchObject({ configured: true, writable: true });
    expect(facts.configured && facts.writable && facts.freeBytes).toBeGreaterThan(0);
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('reports a folder that is not there as not writable, and does not create it', async () => {
    const missing = path.join(dir, 'not-mounted', 'backups');
    await expect(inspectBackupFolder(missing)).resolves.toEqual({
      configured: true,
      writable: false,
    });
    expect(existsSync(path.join(dir, 'not-mounted'))).toBe(false);
  });

  it('reports a folder that cannot be created as not writable', async () => {
    const file = path.join(dir, 'a-file');
    writeFileSync(file, '');
    await expect(inspectBackupFolder(path.join(file, 'backups'))).resolves.toEqual({
      configured: true,
      writable: false,
    });
  });
});

describe('configChecks', () => {
  it('reports secrets as set or not, never their values', () => {
    const secrets = ['smtp-pass-value', 'vapid-private-value', 'encryption-key-value', 'jwt-value'];
    const checks = configChecks({
      env: {
        SMTP_HOST: 'smtp.example.co.il',
        SMTP_FROM: 'budget@example.co.il',
        SMTP_PASS: secrets[0],
        WEB_PUSH_VAPID_PUBLIC_KEY: 'public',
        WEB_PUSH_VAPID_PRIVATE_KEY: secrets[1],
        INTEGRATIONS_ENCRYPTION_KEY: secrets[2],
        JWT_SECRET: secrets[3],
        APP_URL: 'https://budget.example.co.il',
      },
      redisUp: true,
      lastSmtpSend: null,
      backupFolder: { configured: false },
      openedOrigin: 'https://budget.example.co.il',
    });

    expect(checks.map(check => [check.key, check.level])).toEqual([
      ['smtp', 'ok'],
      ['push', 'ok'],
      ['backups', 'off'],
      ['app_url', 'ok'],
      ['encryption_key', 'ok'],
    ]);
    const text = JSON.stringify(checks);
    for (const secret of secrets) {
      expect(text).not.toContain(secret);
    }
  });

  it('falls back to FRONTEND_URL for the public address', () => {
    const appUrl = configChecks({
      env: { FRONTEND_URL: 'https://budget.example.co.il' },
      redisUp: true,
      lastSmtpSend: null,
      backupFolder: { configured: false },
      openedOrigin: null,
    }).find(check => check.key === 'app_url');
    expect(appUrl).toMatchObject({ level: 'ok', url: 'https://budget.example.co.il' });
  });
});
