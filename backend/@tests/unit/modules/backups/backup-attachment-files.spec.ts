import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  collectTransactionAttachmentFiles,
  shareIdenticalAttachmentFiles,
  withLegacyAttachmentFiles,
  withRestorableAttachments,
} from '@/modules/backups/backup-attachment-files';
import { prepareDocumentPaths } from '@/modules/backups/backup-restore-documents';

describe('transaction attachment files in backups', () => {
  let uploadsDir: string;
  let attachments: string;

  beforeEach(() => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seneca-backup-att-'));
    process.env.UPLOADS_DIR = uploadsDir;
    attachments = path.join(uploadsDir, 'transaction-attachments');
    fs.mkdirSync(attachments);
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('carries each file under a portable path and leaves out rows whose file is gone', async () => {
    fs.writeFileSync(path.join(attachments, 'stored-1.pdf'), '%PDF-1.4 one');
    const files: Array<{ path: string; contents: Buffer }> = [];

    const records = await collectTransactionAttachmentFiles(
      [
        { id: 'att-1', storedFileName: 'stored-1.pdf', fileName: 'Invoice.pdf' },
        { id: 'att-2', storedFileName: 'gone.png', fileName: 'Gone.png' },
      ],
      files,
    );

    expect(records).toEqual([
      {
        id: 'att-1',
        storedFileName: 'transaction-attachments/att-1/stored-1.pdf',
        fileName: 'Invoice.pdf',
      },
    ]);
    expect(files).toEqual([
      {
        path: 'transaction-attachments/att-1/stored-1.pdf',
        contents: Buffer.from('%PDF-1.4 one'),
      },
    ]);
  });

  it('restores only rows whose file the archive carries', () => {
    const files = new Map([['transaction-attachments/att-1/a.pdf', Buffer.from('%PDF')]]);
    const opened = withRestorableAttachments({
      collections: {
        transaction_attachments: [
          { id: 'att-1', storedFileName: 'transaction-attachments/att-1/a.pdf' },
          // A backup from before files were carried: a name on some server's disk.
          { id: 'att-2', storedFileName: 'someone-elses.pdf' },
          { id: 'att-3', storedFileName: 'transaction-attachments/att-3/missing.pdf' },
        ],
        transactions: [{ id: 'tx-1' }],
      },
      files,
    });

    expect(opened.collections.transaction_attachments).toEqual([
      { id: 'att-1', storedFileName: 'transaction-attachments/att-1/a.pdf' },
    ]);
    expect(opened.collections.transactions).toEqual([{ id: 'tx-1' }]);
  });

  it('stages a restored attachment under a fresh name in the attachments dir', async () => {
    const restoreDirectory = fs.mkdtempSync(path.join(uploadsDir, '.restore-'));
    const staged: Array<{ stagedPath: string; targetPath: string }> = [];
    const portable = 'transaction-attachments/att-1/stored-1.pdf';
    const mapped: Record<string, unknown> = { id: 'new-att', storedFileName: portable };

    await prepareDocumentPaths(
      'transaction_attachments',
      { id: 'att-1', storedFileName: portable },
      mapped,
      new Map([[portable, Buffer.from('%PDF-1.4 one')]]),
      restoreDirectory,
      staged,
    );

    expect(mapped.storedFileName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(staged).toHaveLength(1);
    expect(staged[0].targetPath).toBe(path.join(attachments, String(mapped.storedFileName)));
    expect(fs.readFileSync(staged[0].stagedPath, 'utf8')).toBe('%PDF-1.4 one');
  });

  it('carries an approved receipt photo once: the attachment points at the receipt file', () => {
    const photo = Buffer.from('ACME Store receipt photo');
    const files = [
      { path: 'transaction-attachments/att-1/a.jpg', contents: photo },
      { path: 'receipts/r-1/0-scan.jpg', contents: photo },
      { path: 'transaction-attachments/att-2/b.pdf', contents: Buffer.from('%PDF other') },
    ];
    const collections: Record<string, unknown[]> = {
      transaction_attachments: [
        { id: 'att-1', storedFileName: 'transaction-attachments/att-1/a.jpg' },
        { id: 'att-2', storedFileName: 'transaction-attachments/att-2/b.pdf' },
      ],
    };

    shareIdenticalAttachmentFiles(collections, files);

    expect(files.map(file => file.path)).toEqual([
      'receipts/r-1/0-scan.jpg',
      'transaction-attachments/att-2/b.pdf',
    ]);
    expect(collections.transaction_attachments).toEqual([
      { id: 'att-1', storedFileName: 'receipts/r-1/0-scan.jpg' },
      { id: 'att-2', storedFileName: 'transaction-attachments/att-2/b.pdf' },
    ]);
  });

  it('brings back an old backup\'s file only when the restorer can read it today', async () => {
    fs.writeFileSync(path.join(attachments, 'readable.pdf'), '%PDF readable');
    fs.writeFileSync(path.join(attachments, 'not-theirs.pdf'), '%PDF not theirs');
    const query = vi.fn().mockResolvedValue([{ stored_file_name: 'readable.pdf' }]);
    const opened = {
      collections: {
        transaction_attachments: [
          { id: 'a', storedFileName: 'readable.pdf' },
          { id: 'b', storedFileName: 'not-theirs.pdf' },
          { id: 'c', storedFileName: '../escape.pdf' },
        ],
      },
      files: new Map<string, Buffer>(),
    };

    const result = await withLegacyAttachmentFiles({ query } as any, 'user-1', opened);

    expect(query.mock.calls[0][1]).toEqual(['user-1', ['readable.pdf', 'not-theirs.pdf']]);
    expect(query.mock.calls[0][0]).toMatch(/owner_member_id = wm\.id/);
    expect([...result.files.keys()]).toEqual(['readable.pdf']);
    expect(withRestorableAttachments(result).collections.transaction_attachments).toEqual([
      { id: 'a', storedFileName: 'readable.pdf' },
    ]);
  });
});
