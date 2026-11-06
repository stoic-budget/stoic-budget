'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import type { PayableDirection } from '@/app/lib/payables-api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** What a cash payment of a bill can name: active wallets in its currency, categories of its side. */
export function useCashPaymentOptions({
  currency,
  direction,
  enabled = true,
}: {
  currency: string;
  direction: PayableDirection;
  enabled?: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const categoryType = direction === 'receivable' ? 'income' : 'expense';

  const wallets = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: enabled && Boolean(workspaceId),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    enabled: enabled && Boolean(workspaceId),
  });

  return {
    wallets: (wallets.data ?? []).filter(
      wallet =>
        wallet.isActive !== false && wallet.currency.toUpperCase() === currency.toUpperCase(),
    ),
    walletsLoading: wallets.isPending,
    categories: (categories.data ?? []).filter(category => category.type === categoryType),
  };
}
