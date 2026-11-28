import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/hooks/useAuth';
import type { ParserHealth } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** How each bank's statements parsed over the last 30 days; asked only by the server's administrator. */
export function useParserHealth(): {
  isAdmin: boolean;
  health: ParserHealth | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const query = useQuery({
    queryKey: queryKeys.parserHealth(),
    queryFn: ({ signal }): Promise<ParserHealth> =>
      apiQueryDecoded({ url: '/parsing/health', signal, contract: 'ParserHealth' }),
    enabled: isAdmin,
  });
  return { isAdmin, health: query.data, isPending: query.isPending, isError: query.isError };
}
