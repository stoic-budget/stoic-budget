import { TransactionType } from '../../../../src/entities/transaction.entity';
import { TransferToAccountService } from '../../../../src/modules/transactions/services/transfer-to-account.service';

describe('TransferToAccountService and pending bank rows', () => {
  it('refuses a pending row before booking a mirror row in the other account', async () => {
    const save = vi.fn();
    const findOne = vi.fn(async () => ({ id: 'wallet-cash', workspaceId: 'ws-1' }));
    const service = new TransferToAccountService(
      { save, create: vi.fn(), manager: { getRepository: () => ({ findOne }) } } as never,
      {
        findOwned: vi.fn(async () => ({
          id: 'tx-pending',
          workspaceId: 'ws-1',
          walletId: 'wallet-everyday',
          transactionType: TransactionType.EXPENSE,
          isPending: true,
          isDuplicate: false,
          splitGroupId: null,
          transferPairId: null,
        })),
      } as never,
    );

    await expect(service.transferToAccount('ws-1', 'tx-pending', 'wallet-cash')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TRANSACTION_LEG_PENDING' }),
    });
    expect(save).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });
});
