import type { EntityManager } from 'typeorm';
import { Integration, IntegrationStatus } from '../../entities/integration.entity';
import { OpenProtocolSettings } from '../../entities/open-protocol-settings.entity';

/**
 * Disconnecting S3, WebDAV or IMAP forgets the connection (#788): its stored
 * settings and encrypted credentials are deleted, so the status, imports and
 * the S3 auto-backup see it as not configured, and no password stays behind.
 * A protocol the server itself configures through its environment stays.
 */
export async function disconnectProtocol(
  manager: EntityManager,
  found: { integration: Integration | null; settings: OpenProtocolSettings | null },
): Promise<void> {
  if (found.settings) {
    await manager.getRepository(OpenProtocolSettings).delete({ id: found.settings.id });
  }
  if (found.integration) {
    found.integration.status = IntegrationStatus.DISCONNECTED;
    await manager.getRepository(Integration).save(found.integration);
  }
}
