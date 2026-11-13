import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TransactionAttachmentSweeperService } from '@/modules/transactions/services/transaction-attachment-sweeper.service';

describe('TransactionAttachmentSweeperService', () => {
  let uploadsDir: string;
  let dir: string;
  let trashRoot: string;
  const HOUR = 60 * 60 * 1000;
  const NOW = Date.parse('2026-11-13T03:40:00Z');
  /** The names the database knows; `count` is every row anywhere. */
  let named: string[];
  let rowCount: number;
  const repository = {
    find: vi.fn(async ({ where }: any) =>
      [...where.storedFileName.value]
        .filter((name: string) => named.includes(name))
        .map((name: string) => ({ id: name, storedFileName: name })),
    ),
    count: vi.fn(async () => rowCount),
  } as any;
  const sweeper = () => new TransactionAttachmentSweeperService(repository);

  const put = (name: string, ageMs = 2 * HOUR) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, 'x');
    const at = new Date(NOW - ageMs);
    fs.utimesSync(file, at, at);
  };
  const left = () => fs.readdirSync(dir).sort();
  const trashed = (day = '2026-11-13') =>
    fs.existsSync(path.join(trashRoot, day)) ? fs.readdirSync(path.join(trashRoot, day)).sort() : [];

  beforeEach(() => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seneca-sweep-test-'));
    process.env.UPLOADS_DIR = uploadsDir;
    dir = path.join(uploadsDir, 'transaction-attachments');
    trashRoot = path.join(uploadsDir, '.attachments-trash');
    fs.mkdirSync(dir);
    named = [];
    rowCount = 0;
    repository.find.mockClear();
    repository.count.mockClear();
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('moves old unnamed files to the trash of the day and keeps named or fresh ones', async () => {
    for (const name of ['a.png', 'b.png', 'c.png', 'd.png', 'e.png']) put(name);
    put('orphan.png');
    put('fresh.png', 60 * 1000);
    named = ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'];
    rowCount = 5;

    const result = await sweeper().sweep(NOW);

    expect(result).toEqual({ status: 'swept', quarantined: 1, purgedDays: 0 });
    expect(left()).toEqual(['a.png', 'b.png', 'c.png', 'd.png', 'e.png', 'fresh.png']);
    expect(trashed()).toEqual(['orphan.png']);
  });

  it('touches nothing when the table is empty but the folder holds files', async () => {
    put('a.png');
    put('b.png');
    rowCount = 0;

    const result = await sweeper().sweep(NOW);

    expect(result).toMatchObject({ status: 'skipped', reason: 'no-rows', files: 2 });
    expect(left()).toEqual(['a.png', 'b.png']);
    expect(fs.existsSync(trashRoot)).toBe(false);
  });

  it('touches nothing when more than 50 files would go', async () => {
    for (let index = 0; index < 400; index++) put(`kept-${index}.png`);
    for (let index = 0; index < 51; index++) put(`orphan-${index}.png`);
    named = Array.from({ length: 400 }, (_, index) => `kept-${index}.png`);
    rowCount = 400;

    const result = await sweeper().sweep(NOW);

    expect(result).toMatchObject({ status: 'skipped', reason: 'too-many', orphans: 51, files: 451 });
    expect(fs.existsSync(trashRoot)).toBe(false);
  });

  it('touches nothing when more than a fifth of the files would go', async () => {
    for (let index = 0; index < 20; index++) put(`kept-${index}.png`);
    for (let index = 0; index < 6; index++) put(`orphan-${index}.png`);
    named = Array.from({ length: 20 }, (_, index) => `kept-${index}.png`);
    rowCount = 20;

    const result = await sweeper().sweep(NOW);

    expect(result).toMatchObject({ status: 'skipped', reason: 'too-many', orphans: 6, files: 26 });
    expect(left()).toHaveLength(26);
  });

  it('still cleans a small install: one deleted file of four', async () => {
    for (const name of ['a.png', 'b.png', 'c.png', 'gone.png']) put(name);
    named = ['a.png', 'b.png', 'c.png'];
    rowCount = 3;

    expect(await sweeper().sweep(NOW)).toMatchObject({ status: 'swept', quarantined: 1 });
    expect(trashed()).toEqual(['gone.png']);
  });

  it('deletes trash days older than 30 days and keeps the rest', async () => {
    for (const day of ['2026-10-01', '2026-10-20', 'not-a-day']) {
      fs.mkdirSync(path.join(trashRoot, day), { recursive: true });
      fs.writeFileSync(path.join(trashRoot, day, 'x.png'), 'x');
    }
    put('a.png');
    named = ['a.png'];
    rowCount = 1;

    expect(await sweeper().sweep(NOW)).toMatchObject({ status: 'swept', purgedDays: 1 });
    expect(fs.readdirSync(trashRoot).sort()).toEqual(['2026-10-20', 'not-a-day']);
  });

  it('does nothing, and creates nothing, when no file was ever attached', async () => {
    fs.rmSync(dir, { recursive: true });
    await expect(sweeper().sweep(NOW)).resolves.toMatchObject({ status: 'swept', quarantined: 0 });
    expect(fs.existsSync(dir)).toBe(false);
    expect(fs.existsSync(trashRoot)).toBe(false);
    expect(repository.find).not.toHaveBeenCalled();
  });
});
