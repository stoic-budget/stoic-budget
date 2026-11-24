import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectLogoFiles } from '../../../../src/modules/backups/backup-logo-files';
import { prepareDocumentPaths } from '../../../../src/modules/backups/backup-restore-documents';

/** The invoice logo travels with a backup and comes back as the copy's own file (#677). */
describe('business logo in a backup', () => {
  let uploads: string;
  let previous: string | undefined;

  beforeEach(async () => {
    uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-logo-'));
    previous = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploads;
    await fs.mkdir(path.join(uploads, 'workspace-logos'), { recursive: true });
  });

  afterEach(async () => {
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
    await fs.rm(uploads, { recursive: true, force: true });
  });

  it('carries the logo file, and leaves out one whose file is gone', async () => {
    await fs.writeFile(path.join(uploads, 'workspace-logos', 'acme.png'), 'ACME logo');
    const files: Array<{ path: string; contents: Buffer }> = [];

    const records = await collectLogoFiles(
      [
        { workspaceId: 'ws-1', logoFile: 'acme.png' },
        { workspaceId: 'ws-2', logoFile: 'gone.png' },
        { workspaceId: 'ws-3', logoFile: null },
      ],
      files,
    );

    expect(records).toEqual([
      { workspaceId: 'ws-1', logoFile: 'workspace-logos/ws-1/acme.png' },
      { workspaceId: 'ws-2', logoFile: null },
      { workspaceId: 'ws-3', logoFile: null },
    ]);
    expect(files).toEqual([{ path: 'workspace-logos/ws-1/acme.png', contents: Buffer.from('ACME logo') }]);
  });

  it("restores it under a name of the copy's own", async () => {
    const mapped: Record<string, unknown> = { id: 'new-profile' };
    const staged: Array<{ stagedPath: string; targetPath: string }> = [];

    await prepareDocumentPaths(
      'workspace_business_profiles',
      { logoFile: 'workspace-logos/ws-1/acme.png' },
      mapped,
      new Map([['workspace-logos/ws-1/acme.png', Buffer.from('ACME logo')]]),
      uploads,
      staged,
    );

    expect(mapped.logoFile).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(staged[0].targetPath).toBe(path.join(uploads, 'workspace-logos', mapped.logoFile as string));
  });

  it("gives a copy from an older archive no logo, not the original's file", async () => {
    const mapped: Record<string, unknown> = { id: 'new-profile' };

    await prepareDocumentPaths('workspace_business_profiles', { logoFile: 'acme.png' }, mapped, new Map(), uploads, []);

    expect(mapped.logoFile).toBeNull();
  });

  it('restores no logo from a file an upload would not take', async () => {
    const mapped: Record<string, unknown> = { id: 'new-profile' };

    await prepareDocumentPaths(
      'workspace_business_profiles',
      { logoFile: 'workspace-logos/ws-1/page.svg' },
      mapped,
      new Map([['workspace-logos/ws-1/page.svg', Buffer.from('<svg/>')]]),
      uploads,
      [],
    );

    expect(mapped.logoFile).toBeNull();
  });
});
