import type { Logger } from '@nestjs/common';
import type { Statement } from '../../../entities';
import type { TransferPairingService } from '../../transactions/services/transfer-pairing.service';

/**
 * Pairs the legs of transfers between the user's own accounts that this
 * statement's rows complete, and notes the count on the statement. Call it once
 * the rows and the statement's account are stored (the matcher reads both from
 * the database) and after duplicates are flagged: a duplicate leg must not take
 * the pair. A failure is logged and leaves the import as it is. Answers whether
 * anything was paired, so the caller knows the statement has a note to save.
 */
export async function pairStatementTransfers(
  pairing: TransferPairingService | undefined,
  statement: Statement,
  logger: Logger,
): Promise<boolean> {
  if (!(pairing && statement.workspaceId)) {
    return false;
  }
  try {
    const transferPairs = await pairing.detectAndApply(statement.workspaceId, statement.id);
    if (transferPairs.paired === 0) {
      return false;
    }
    statement.parsingDetails = { ...(statement.parsingDetails || {}), transferPairs };
    return true;
  } catch (error) {
    logger.warn(
      `Transfer pairing failed for statement ${statement.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}
