import type { Logger } from '@nestjs/common';
import type { Statement } from '@/entities';
import { pairStatementTransfers } from '@/modules/parsing/helpers/statement-transfer-pairing.helper';
import type { TransferPairingService } from '@/modules/transactions/services/transfer-pairing.service';

describe('pairStatementTransfers', () => {
  const logger = { warn: vi.fn() } as unknown as Logger;
  const statement = (): Statement =>
    ({ id: 'st-1', workspaceId: 'ws-1', parsingDetails: { warnings: [] } }) as unknown as Statement;
  const pairing = (detectAndApply: TransferPairingService['detectAndApply']) =>
    ({ detectAndApply }) as unknown as TransferPairingService;

  beforeEach(() => vi.clearAllMocks());

  it("pairs the statement's rows and notes the count on it", async () => {
    const detect = vi.fn(async () => ({ found: 2, paired: 1 }));
    const target = statement();

    expect(await pairStatementTransfers(pairing(detect), target, logger)).toBe(true);

    expect(detect).toHaveBeenCalledWith('ws-1', 'st-1');
    expect(target.parsingDetails).toEqual({ warnings: [], transferPairs: { found: 2, paired: 1 } });
  });

  it('leaves the statement as it is when nothing was paired', async () => {
    const target = statement();

    expect(
      await pairStatementTransfers(
        pairing(async () => ({ found: 0, paired: 0 })),
        target,
        logger,
      ),
    ).toBe(false);

    expect(target.parsingDetails).toEqual({ warnings: [] });
  });

  it('logs a failure and lets the import finish', async () => {
    const target = statement();
    const failing = pairing(async () => {
      throw new Error('database went away');
    });

    expect(await pairStatementTransfers(failing, target, logger)).toBe(false);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('database went away'));
    expect(target.parsingDetails).toEqual({ warnings: [] });
  });

  it('does nothing without the pairing service or a workspace', async () => {
    const detect = vi.fn();
    expect(await pairStatementTransfers(undefined, statement(), logger)).toBe(false);
    const orphan = { ...statement(), workspaceId: null } as unknown as Statement;
    expect(await pairStatementTransfers(pairing(detect), orphan, logger)).toBe(false);
    expect(detect).not.toHaveBeenCalled();
  });
});
