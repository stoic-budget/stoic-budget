import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collectColumnFiles,
  columnFilesOf,
  withRestorablePictures,
} from '../../../../src/modules/backups/backup-file-columns';
import { withRestorableAttachments } from '../../../../src/modules/backups/backup-attachment-files';
import { prepareDocumentPaths } from '../../../../src/modules/backups/backup-restore-documents';

/** Pictures travel with a backup and come back as the copy's own files (#677). */
describe('pictures in a backup', () => {
  let uploads: string;
  let previous: string | undefined;

  beforeEach(async () => {
    uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-logo-'));
    previous = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploads;
    await fs.mkdir(path.join(uploads, 'workspace-logos'), { recursive: true });
    await fs.mkdir(path.join(uploads, 'goal-covers'), { recursive: true });
    await fs.mkdir(path.join(uploads, 'item-images'), { recursive: true });
  });

  afterEach(async () => {
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
    await fs.rm(uploads, { recursive: true, force: true });
  });

  it('carries the logo file, and leaves out one whose file is gone', async () => {
    await fs.writeFile(path.join(uploads, 'workspace-logos', 'acme.png'), 'ACME logo');
    const files: Array<{ path: string; contents: Buffer }> = [];

    const records = await collectColumnFiles(
      'workspace_business_profiles',
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

  it("carries a goal's cover and gives the copy its own", async () => {
    await fs.writeFile(path.join(uploads, 'goal-covers', 'trip.jpg'), 'ACME trip');
    const files: Array<{ path: string; contents: Buffer }> = [];
    const [record] = await collectColumnFiles('goals', [{ id: 'goal-1', coverFile: 'trip.jpg' }], files);
    expect(record).toEqual({ id: 'goal-1', coverFile: 'goal-covers/goal-1/trip.jpg' });

    const mapped: Record<string, unknown> = { id: 'goal-new' };
    const staged: Array<{ stagedPath: string; targetPath: string }> = [];
    await prepareDocumentPaths(
      'goals',
      record,
      mapped,
      new Map(files.map(file => [file.path, file.contents])),
      uploads,
      staged,
    );

    expect(mapped.coverFile).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(staged[0].targetPath).toBe(path.join(uploads, 'goal-covers', mapped.coverFile as string));
  });

  it('names every picture a discarded copy owns, in its own folder', async () => {
    const asked: string[] = [];
    const files = await columnFilesOf(async (sql, params) => {
      asked.push(sql, String(params[0]));
      return [
        { name: 'logo.png', spec: 0 },
        { name: 'trip.jpg', spec: 1 },
      ] as never;
    }, 'ws-copy');

    expect(asked.join(' ')).toMatch(/FROM workspace_business_profiles[\s\S]*FROM goals[\s\S]*ws-copy/);
    // Each table only for this workspace, and never a file another one still names.
    expect(asked[0].match(/WHERE t\.workspace_id = \$1/g)).toHaveLength(3);
    expect(asked[0].match(/o\.workspace_id <> \$1/g)).toHaveLength(3);
    expect(files).toEqual([
      path.join(uploads, 'workspace-logos', 'logo.png'),
      path.join(uploads, 'goal-covers', 'trip.jpg'),
    ]);
  });

  it('carries an item picture, and leaves out a picture row whose file is gone', async () => {
    await fs.writeFile(path.join(uploads, 'item-images', 'buds.png'), 'ACME buds');
    const files: Array<{ path: string; contents: Buffer }> = [];

    const records = await collectColumnFiles(
      'item_images',
      [
        { id: 'img-1', fileName: 'buds.png' },
        { id: 'img-2', fileName: 'gone.png' },
      ],
      files,
    );

    expect(records).toEqual([{ id: 'img-1', fileName: 'item-images/img-1/buds.png' }]);
    expect(files.map(file => file.path)).toEqual(['item-images/img-1/buds.png']);
  });

  it('restores only the picture rows the archive carries a picture for', () => {
    const opened = {
      collections: {
        item_images: [
          { id: 'img-1', fileName: 'item-images/img-1/buds.png' },
          // An older archive: the original's file name, no picture of its own.
          { id: 'img-2', fileName: 'old.png' },
        ],
        goals: [{ id: 'goal-1', coverFile: 'old.jpg' }],
      },
      files: new Map([['item-images/img-1/buds.png', Buffer.from('ACME buds')]]),
    };

    const kept = withRestorablePictures(opened);

    expect(kept.collections.item_images).toEqual([{ id: 'img-1', fileName: 'item-images/img-1/buds.png' }]);
    // A goal is more than its cover: it stays, and its cover restores as none.
    expect(kept.collections.goals).toHaveLength(1);
  });

  it("gives a restored item picture a file of the copy's own", async () => {
    const mapped: Record<string, unknown> = { id: 'img-new' };
    const staged: Array<{ stagedPath: string; targetPath: string }> = [];

    await prepareDocumentPaths(
      'item_images',
      { fileName: 'item-images/img-1/buds.png' },
      mapped,
      new Map([['item-images/img-1/buds.png', Buffer.from('ACME buds')]]),
      uploads,
      staged,
    );

    expect(mapped.fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(staged[0].targetPath).toBe(path.join(uploads, 'item-images', mapped.fileName as string));
  });

  it('applies the picture rule where a restore filters its rows', () => {
    const kept = withRestorableAttachments({
      collections: { item_images: [{ id: 'img-2', fileName: 'old.png' }] },
      files: new Map<string, Buffer>(),
    });

    expect(kept.collections.item_images).toEqual([]);
  });
});
