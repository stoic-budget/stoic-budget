import type { ImapFlow } from 'imapflow';
import type { EntityManager, Repository } from 'typeorm';
import { type Integration, IntegrationProvider } from '../../entities/integration.entity';
import { OpenProtocolSettings } from '../../entities/open-protocol-settings.entity';

/** How far a mailbox was read: the last UID taken, valid while UIDVALIDITY stays (#679). */
interface ImapCursor {
  uidValidity: string;
  lastUid: number;
}

const cursorOf = (settings: OpenProtocolSettings | null): ImapCursor | null => {
  const cursor = settings?.config?.imapCursor as Partial<ImapCursor> | undefined;
  return typeof cursor?.uidValidity === 'string' && typeof cursor.lastUid === 'number'
    ? { uidValidity: cursor.uidValidity, lastUid: cursor.lastUid }
    : null;
};

/**
 * The UIDs one sync takes: the next ones after the stored cursor, oldest
 * first, so every message is reached in turn; on the first sync, or after the
 * server renumbered the mailbox (a new UIDVALIDITY), the newest ones.
 */
export function imapBatch(
  searched: unknown,
  settings: OpenProtocolSettings | null,
  uidValidity: bigint | number | string | undefined,
  limit = Number(process.env.IMAP_SYNC_LIMIT ?? 50),
): number[] {
  const uids = (Array.isArray(searched) ? (searched as number[]) : []).sort((a, b) => a - b);
  const cursor = cursorOf(settings);
  if (cursor && cursor.uidValidity === String(uidValidity)) {
    return uids.filter(uid => uid > cursor.lastUid).slice(0, limit);
  }
  return uids.slice(-limit);
}

/** Remembers the last UID taken, so the next sync goes on from there. */
export async function saveImapCursor(
  manager: EntityManager,
  settings: OpenProtocolSettings | null,
  uidValidity: bigint | number | string | undefined,
  batch: number[],
): Promise<void> {
  if (!settings || batch.length === 0 || uidValidity === undefined) {
    return;
  }
  const imapCursor: ImapCursor = { uidValidity: String(uidValidity), lastUid: Math.max(...batch) };
  await manager
    .getRepository(OpenProtocolSettings)
    .update(settings.id, { config: { ...settings.config, imapCursor } });
}

/**
 * Opens the mailbox and picks this sync's UIDs; `remember` stores how far it
 * got once they are processed. A mailbox set from the environment has no
 * settings row and so no cursor: it reads the newest messages each time.
 */
export async function openImapBatch(
  client: ImapFlow,
  { mailbox }: { mailbox: string },
  integrations: Repository<Integration>,
  workspaceId: string,
): Promise<{ batch: number[]; remember: () => Promise<void> }> {
  const manager = integrations.manager;
  const { uidValidity } = await client.mailboxOpen(mailbox);
  const settings = await manager.getRepository(OpenProtocolSettings).findOne({
    where: { integration: { workspaceId, provider: IntegrationProvider.IMAP } },
  });
  const batch = imapBatch(await client.search({}, { uid: true }), settings, uidValidity);
  return { batch, remember: () => saveImapCursor(manager, settings, uidValidity, batch) };
}
