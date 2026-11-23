import type { Mock } from 'vitest';
vi.mock('imapflow', () => ({ ImapFlow: vi.fn() }));
vi.mock('webdav', () => ({ createClient: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
}));
vi.mock('mailparser', () => ({
  simpleParser: vi.fn().mockResolvedValue({
    messageId: '<receipt-001@captions.ai>',
    subject: 'Your receipt from Captions #2786-5570',
    from: { text: 'billing@captions.ai' },
    date: new Date('2026-05-21T10:00:00Z'),
    html: '<p>Amount due: $11.99</p>',
    text: 'Amount due: $11.99',
    attachments: [],
  }),
}));

import { ImapFlow } from 'imapflow';
import { OpenProtocolIntegrationsService } from '../../../../src/modules/open-protocol-integrations/open-protocol-integrations.service';

const connectMock = vi.fn().mockResolvedValue(undefined);
const mailboxOpenMock = vi.fn().mockResolvedValue({ uidValidity: 7n });
const searchMock = vi.fn().mockResolvedValue([3]);
const fetchOneMock = vi.fn().mockResolvedValue({
  uid: 3,
  flags: new Set(['\\Seen']),
  source: Buffer.from('From: billing@captions.ai\r\nSubject: Your receipt\r\n\r\nAmount due: $11.99'),
});
const messageFlagsAddMock = vi.fn().mockResolvedValue(undefined);
const logoutMock = vi.fn().mockResolvedValue(undefined);

(ImapFlow as Mock).mockImplementation(function () {
    return {
  connect: connectMock,
  mailboxOpen: mailboxOpenMock,
  search: searchMock,
  fetchOne: fetchOneMock,
  messageFlagsAdd: messageFlagsAddMock,
  logout: logoutMock,
};
  });

const savedReceipt = { id: 'receipt-001', status: 'needs_review' };

const receiptRepository = {
  findOne: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockImplementation((data: unknown) => data),
  save: vi.fn().mockResolvedValue(savedReceipt),
};

const settingsRepository = { findOne: vi.fn().mockResolvedValue(null), update: vi.fn() };
const integrationRepository = {
  findOne: vi.fn().mockResolvedValue(null),
  manager: { getRepository: () => settingsRepository, query: vi.fn() },
};

const receiptParserService = {
  parseFromEmailOnly: vi.fn().mockResolvedValue({ amount: 11.99, currency: 'USD' }),
};

const receiptDuplicateService = {
  findPotentialDuplicates: vi.fn().mockResolvedValue([]),
};

const receiptCategoryService = {
  categorize: vi.fn().mockResolvedValue(null),
};

const auditService = {
  createEvent: vi.fn().mockResolvedValue(undefined),
};

const fileStorageService = {
  saveFile: vi.fn().mockResolvedValue('/tmp/receipt.html'),
};

const createService = () =>
  new OpenProtocolIntegrationsService(
    integrationRepository as never,
    {} as never,
    {} as never,
    receiptRepository as never,
    {} as never,
    fileStorageService as never,
    receiptParserService as never,
    receiptDuplicateService as never,
    receiptCategoryService as never,
    auditService as never,
  );

describe('OpenProtocolIntegrationsService.syncImap — already-seen messages', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      IMAP_HOST: '127.0.0.1',
      IMAP_USER: 'test@example.com',
      IMAP_PASS: 'secret',
      IMAP_PORT: '1143',
      IMAP_SECURE: 'false',
      IMAP_MAILBOX: 'Folders/Receipts',
    };
    connectMock.mockResolvedValue(undefined);
    mailboxOpenMock.mockResolvedValue({ uidValidity: 7n });
    searchMock.mockResolvedValue([3]);
    fetchOneMock.mockResolvedValue({
      uid: 3,
      flags: new Set(['\\Seen']),
      source: Buffer.from(
        'From: billing@captions.ai\r\nSubject: Your receipt\r\n\r\nAmount due: $11.99',
      ),
    });
    messageFlagsAddMock.mockResolvedValue(undefined);
    logoutMock.mockResolvedValue(undefined);
    receiptRepository.findOne.mockResolvedValue(null);
    receiptRepository.save.mockResolvedValue(savedReceipt);
    receiptParserService.parseFromEmailOnly.mockResolvedValue({ amount: 11.99, currency: 'USD' });
    receiptDuplicateService.findPotentialDuplicates.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('imports a message even when it was already marked \\Seen in the mailbox', async () => {
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;

    const result = await createService().syncImap(user, 'workspace-1');

    expect(result.scanned).toBe(1);
    expect(result.imported).toBe(1);
    expect(receiptRepository.save).toHaveBeenCalled();
  });

  it('remembers the last UID it took, so the next sync goes on from there (#679)', async () => {
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;
    settingsRepository.findOne.mockResolvedValueOnce({
      id: 'settings-1',
      config: { host: 'imap.example.com', mailbox: 'INBOX' },
    });
    integrationRepository.manager.query.mockClear();

    await createService().syncImap(user, 'workspace-1');

    // Merged into the stored config, only while it names the same host and mailbox.
    expect(integrationRepository.manager.query).toHaveBeenCalledWith(
      expect.stringContaining("config || jsonb_build_object('imapCursor'"),
      [JSON.stringify({ uidValidity: '7', lastUid: 3 }), 'settings-1', 'imap.example.com', 'INBOX'],
    );
  });

  it('stops the cursor before a message that failed, and saves none when the first did', async () => {
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;
    const settings = { id: 'settings-1', config: { host: 'imap.example.com', mailbox: 'INBOX' } };
    searchMock.mockResolvedValueOnce([4, 5, 6]);
    settingsRepository.findOne.mockResolvedValueOnce(settings);
    fetchOneMock.mockImplementation(async (uid: number) => {
      if (uid === 5) throw new Error('Connection not available');
      return { uid, flags: new Set(), source: Buffer.from('From: a@example.com\r\n\r\nhi') };
    });
    integrationRepository.manager.query.mockClear();

    await createService().syncImap(user, 'workspace-1');
    expect(integrationRepository.manager.query.mock.calls[0][1][0]).toBe(
      JSON.stringify({ uidValidity: '7', lastUid: 4 }),
    );

    // A dropped connection fails every message: the cursor stays where it was.
    searchMock.mockResolvedValueOnce([4, 5, 6]);
    settingsRepository.findOne.mockResolvedValueOnce(settings);
    fetchOneMock.mockRejectedValue(new Error('Connection not available'));
    integrationRepository.manager.query.mockClear();
    await createService().syncImap(user, 'workspace-1');
    expect(integrationRepository.manager.query).not.toHaveBeenCalled();
  });

  it('does not search with seen:false filter so already-read emails are included', async () => {
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;

    await createService().syncImap(user, 'workspace-1');

    const [searchQuery, options] = searchMock.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(searchQuery).not.toHaveProperty('seen');
    // UIDs, not sequence numbers: fetchOne reads them as UIDs (#679).
    expect(options).toEqual({ uid: true });
  });

  it('imports into the workspace it syncs for, deduplicating within it', async () => {
    const user = { id: 'user-1', workspaceId: 'ws-home' } as never;

    await createService().syncImap(user, 'ws-open');

    expect(receiptRepository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-open', messageId: expect.stringMatching(/^imap:/) },
    });
    expect(receiptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', workspaceId: 'ws-open' }),
    );
  });
});
