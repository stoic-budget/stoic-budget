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
  // Both or neither: a status left connected over deleted settings would mislead.
  await manager.transaction(async tx => {
    if (found.settings) {
      await tx.getRepository(OpenProtocolSettings).delete({ id: found.settings.id });
    }
    if (found.integration) {
      found.integration.status = IntegrationStatus.DISCONNECTED;
      await tx.getRepository(Integration).save(found.integration);
    }
  });
}
