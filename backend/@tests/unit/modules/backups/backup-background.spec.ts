import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { carryBackground, stageBackground, startingBackground } from '../../../../src/modules/backups/backup-background';
import { restoredWorkspace } from '../../../../src/modules/backups/backup-restore-workspace';

/** The workspace's uploaded background travels with a backup and comes back as the copy's own (#677). */
describe('workspace background in a backup', () => {
  let uploads: string;
  let previous: string | undefined;

  beforeEach(async () => {
    uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-bg-'));
    previous = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploads;
    await fs.mkdir(path.join(uploads, 'workspace-backgrounds'), { recursive: true });
  });

  afterEach(async () => {
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
    await fs.rm(uploads, { recursive: true, force: true });
  });

  it('carries an uploaded picture and keeps a built-in choice as it is', async () => {
    await fs.writeFile(path.join(uploads, 'workspace-backgrounds', 'lake.jpg'), 'ACME lake');
    const files: Array<{ path: string; contents: Buffer }> = [];

    expect(await carryBackground('/uploads/workspace-backgrounds/lake.jpg', 'ws-1', files)).toBe(
      'workspace-backgrounds/ws-1/lake.jpg',
    );
    expect(files).toEqual([{ path: 'workspace-backgrounds/ws-1/lake.jpg', contents: Buffer.from('ACME lake') }]);
    expect(await carryBackground('/backgrounds/forest.jpg', 'ws-1', files)).toBe('/backgrounds/forest.jpg');
    expect(await carryBackground('/uploads/workspace-backgrounds/gone.jpg', 'ws-1', files)).toBeNull();
    expect(await carryBackground(null, 'ws-1', files)).toBeNull();
  });

  it("restores a carried picture under the copy's own name", async () => {
    const staged: Array<{ stagedPath: string; targetPath: string }> = [];

    const url = await stageBackground(
      'workspace-backgrounds/ws-1/lake.jpg',
      new Map([['workspace-backgrounds/ws-1/lake.jpg', Buffer.from('ACME lake')]]),
      uploads,
      staged,
    );

    expect(url).toMatch(/^\/uploads\/workspace-backgrounds\/[0-9a-f-]{36}\.jpg$/);
    expect(staged[0].targetPath).toBe(path.join(uploads, 'workspace-backgrounds', path.basename(url as string)));
    expect(await fs.readFile(staged[0].stagedPath, 'utf8')).toBe('ACME lake');
  });

  it("starts a copy from an older archive without the original's picture, and keeps a preset", () => {
    expect(startingBackground('/uploads/workspace-backgrounds/lake.jpg')).toBeNull();
    expect(startingBackground('workspace-backgrounds/ws-1/lake.jpg')).toBeNull();
    expect(startingBackground('/backgrounds/forest.jpg')).toBe('/backgrounds/forest.jpg');
    expect(restoredWorkspace({ backgroundImage: '/uploads/workspace-backgrounds/lake.jpg' }, { id: 'u-1' }, { name: 'Copy' }).backgroundImage).toBeNull();
  });

  it('stages nothing that is not a carried image', async () => {
    const staged: Array<{ stagedPath: string; targetPath: string }> = [];
    const files = new Map([['workspace-backgrounds/ws-1/page.svg', Buffer.from('<svg/>')]]);

    expect(await stageBackground('workspace-backgrounds/ws-1/page.svg', files, uploads, staged)).toBeNull();
    expect(await stageBackground('workspace-backgrounds/ws-1/missing.jpg', files, uploads, staged)).toBeNull();
    expect(staged).toEqual([]);
  });
});
