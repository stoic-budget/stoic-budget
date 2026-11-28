import { describe, expect, it, vi } from 'vitest';
import { CryptoSyncService } from '../../../../src/modules/crypto/crypto-sync.service';
import { finalizeTransfers } from '../../../../src/modules/crypto/crypto-transfer.mapper';

const ME = '0x1111111111111111111111111111111111111111';
const ROUTER = '0x4444444444444444444444444444444444444444';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const SWAP = '0xswap';

/** The EVM read asks for internal transfers and books a token-for-ETH swap as a trade (#693). */
describe('CryptoSyncService.readEvm', () => {
  it('reads txlistinternal and sees both legs of a token sold for ETH', async () => {
    const asked: string[] = [];
    const answers: Record<string, unknown[]> = {
      txlist: [{ hash: SWAP, timeStamp: '1750000000', from: ME, to: ROUTER, value: '0', gasUsed: '0', gasPrice: '0' }],
      tokentx: [
        { hash: SWAP, timeStamp: '1750000000', from: ME, to: ROUTER, value: '1000000000', contractAddress: USDC, tokenDecimal: '6' },
      ],
      // Blockscout's shape: the hash is `transactionHash`.
      txlistinternal: [
        { transactionHash: SWAP, timeStamp: '1750000000', from: ROUTER, to: ME, value: '500000000000000000' },
      ],
    };
    const service = Object.create(CryptoSyncService.prototype) as Record<string, unknown>;
    service.fetchEtherscan = vi.fn(async (_wallet: unknown, action: string) => {
      asked.push(action);
      return answers[action] ?? [];
    });
    service.fetchNativeBalance = vi.fn(async () => '0');
    service.fetchTokenBalances = vi.fn(async () => []);
    service.getWorkspaceAddresses = vi.fn(async () => [ME]);

    const read = await (service as unknown as { readEvm(wallet: unknown): Promise<{ transfers: never[] }> }).readEvm({
      address: ME,
      chainId: 1,
      workspaceId: 'ws-1',
    });
    const legs = finalizeTransfers(read.transfers).filter(transfer => (transfer as { leg?: string }).leg === 'value');

    expect(asked.sort()).toEqual(['tokentx', 'txlist', 'txlistinternal']);
    expect(legs).toEqual([
      expect.objectContaining({ asset: 'ETH', amount: '0.5', direction: 'in', isTrade: true }),
      expect.objectContaining({ asset: 'USDC', amount: '1000', direction: 'out', isTrade: true }),
    ]);
  });
});
