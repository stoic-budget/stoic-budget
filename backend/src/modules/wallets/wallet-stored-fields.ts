import type { Wallet } from '../../entities/wallet.entity';

/** The account's own columns as `GET /wallets` answers them; balances come on top. */
export function walletStoredFields(wallet: Wallet) {
  return {
    id: wallet.id,
    workspaceId: wallet.workspaceId,
    userId: wallet.userId,
    name: wallet.name,
    type: wallet.type,
    accountNumber: wallet.accountNumber,
    bankName: wallet.bankName,
    currency: wallet.currency,
    initialBalance: String(wallet.initialBalance ?? '0'),
    isActive: wallet.isActive,
    ownerMemberId: wallet.ownerMemberId,
    includeInNetWorth: wallet.includeInNetWorth,
    creditLimit: wallet.creditLimit == null ? null : String(wallet.creditLimit),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}
