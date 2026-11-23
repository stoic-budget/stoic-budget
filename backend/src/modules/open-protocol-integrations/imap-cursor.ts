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

/**
 * Remembers how far the sync got: up to the message before the first one that
 * failed (a dropped connection, a parse or database error), so that one is
 * tried again next time rather than passed for good. Merged into the stored
 * config, and only while it still names the same host and mailbox: settings
 * saved meanwhile are not overwritten with the copy read at the start.
 */
async function saveImapCursor(
  manager: EntityManager,
  settings: OpenProtocolSettings | null,
  uidValidity: bigint | number | string | undefined,
  batch: number[],
  failed: Set<number>,
): Promise<void> {
  const firstFailure = batch.findIndex(uid => failed.has(uid));
  const done = firstFailure === -1 ? batch : batch.slice(0, firstFailure);
  if (!settings || done.length === 0 || uidValidity === undefined) {
    return;
  }
  const imapCursor: ImapCursor = { uidValidity: String(uidValidity), lastUid: Math.max(...done) };
  await manager.query(
    `UPDATE open_protocol_settings SET config = config || jsonb_build_object('imapCursor', $1::jsonb)
      WHERE id = $2 AND config->>'host' IS NOT DISTINCT FROM $3 AND config->>'mailbox' IS NOT DISTINCT FROM $4`,
    [
      JSON.stringify(imapCursor),
      settings.id,
      settings.config?.host ?? null,
      settings.config?.mailbox ?? null,
    ],
  );
}

/**
 * The cursor a settings save keeps: the same host and mailbox go on from
 * where they were; another host or mailbox starts afresh.
 */
export function keptImapCursor(
  settings: OpenProtocolSettings | null,
  next: { host: string; mailbox: string },
): { imapCursor?: unknown } {
  const config = settings?.config ?? {};
  return config.host === next.host && config.mailbox === next.mailbox && config.imapCursor
    ? { imapCursor: config.imapCursor }
    : {};
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
): Promise<{ batch: number[]; failed: (uid: number) => void; remember: () => Promise<void> }> {
  const manager = integrations.manager;
  const { uidValidity } = await client.mailboxOpen(mailbox);
  const settings = await manager.getRepository(OpenProtocolSettings).findOne({
    where: { integration: { workspaceId, provider: IntegrationProvider.IMAP } },
  });
  const batch = imapBatch(await client.search({}, { uid: true }), settings, uidValidity);
  const failed = new Set<number>();
  return {
    batch,
    failed: uid => failed.add(uid),
    remember: () => saveImapCursor(manager, settings, uidValidity, batch, failed),
  };
}
