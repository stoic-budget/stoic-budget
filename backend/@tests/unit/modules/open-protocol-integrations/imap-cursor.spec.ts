import type { OpenProtocolSettings } from '@/entities/open-protocol-settings.entity';
import { imapBatch, keptImapCursor } from '@/modules/open-protocol-integrations/imap-cursor';

const settings = (imapCursor?: unknown) =>
  ({ id: 's-1', config: imapCursor ? { imapCursor } : {} }) as unknown as OpenProtocolSettings;
const uids = Array.from({ length: 120 }, (_, index) => index + 1);

describe('imapBatch (#679)', () => {
  it('takes the newest messages on the first sync', () => {
    expect(imapBatch(uids, settings(), 7n, 50)).toEqual(uids.slice(-50));
  });

  it('goes on after the last UID taken, oldest first, so every message is reached', () => {
    const cursor = { uidValidity: '7', lastUid: 30 };
    expect(imapBatch(uids, settings(cursor), 7n, 50)).toEqual(uids.slice(30, 80));
    expect(imapBatch([...uids].reverse(), settings(cursor), 7n, 5)).toEqual([31, 32, 33, 34, 35]);
  });

  it('starts over with the newest when the server renumbered the mailbox', () => {
    const cursor = { uidValidity: '6', lastUid: 30 };
    expect(imapBatch(uids, settings(cursor), 7n, 10)).toEqual(uids.slice(-10));
  });

  it('has nothing to take when no message is newer than the cursor', () => {
    expect(imapBatch(uids, settings({ uidValidity: '7', lastUid: 120 }), 7n, 50)).toEqual([]);
  });
});

describe('keptImapCursor', () => {
  const stored = { id: 's-1', config: { host: 'imap.example.com', mailbox: 'INBOX', imapCursor: { uidValidity: '7', lastUid: 500 } } } as unknown as OpenProtocolSettings;

  it('keeps the cursor when a save keeps the host and the mailbox', () => {
    expect(keptImapCursor(stored, { host: 'imap.example.com', mailbox: 'INBOX' })).toEqual({
      imapCursor: { uidValidity: '7', lastUid: 500 },
    });
  });

  it('starts afresh for another host or mailbox', () => {
    expect(keptImapCursor(stored, { host: 'imap.example.com', mailbox: 'Receipts' })).toEqual({});
    expect(keptImapCursor(stored, { host: 'mail.example.com', mailbox: 'INBOX' })).toEqual({});
    expect(keptImapCursor(null, { host: 'imap.example.com', mailbox: 'INBOX' })).toEqual({});
  });
});
