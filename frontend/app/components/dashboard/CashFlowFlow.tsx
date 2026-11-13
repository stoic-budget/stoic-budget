'use client';

import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  buildCashFlowSankey,
  cashFlowChartHeight,
} from '@/app/(main)/reports/components/cash-flow/cash-flow.chart';
import { SpendFlowSkeleton } from '@/app/(main)/statements/components/analytics/flow/SpendFlowSkeleton';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { useCategoryName } from '@/app/lib/use-category-name';
import { foldSmallest, monthRange, withoutSubcategories } from './cash-flow-flow';
import { CardEmpty } from './ui';

/** The lines drawing in again after a month switch: the first draw's animation, shortened. */
const SWITCH_ANIMATION = { animationDuration: 400, animationEasing: 'cubicOut' } as const;

interface CashFlowFlowProps {
  /** The dashboard's picked month (YYYY-MM). */
  month: string;
  formatAmount: (value: number) => string;
}

/**
 * The card's month as the Reports sankey, one level shallower: where the
 * income came from and which categories it went to, the smallest of each
 * folded into "Other". Same endpoint and the same default switches as the
 * card's own figures (no transfers, refunds as income); filters,
 * subcategories and comparisons stay in Reports.
 */
export function CashFlowFlow({ month, formatAmount }: CashFlowFlowProps): React.JSX.Element {
  const t = useIntlayer('cashFlowCard');
  const otherName = useIntlayer('topCategoriesCard').other.value;
  const workspaceId = useWorkspaceId();
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const privacy = usePrivacyMode();
  const categoryName = useCategoryName();
  const { from, to } = monthRange(month);
  const params = { dateFrom: from, dateTo: to } satisfies ContractInput<'CashFlowMapQuery'>;
  const query = useQuery({
    // The Reports key: a month opened there and here is fetched once.
    queryKey: queryKeys.cashFlowMap({ workspaceId, params: JSON.stringify(params) }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/reports/cash-flow-map', params, signal, contract: 'CashFlowMap' }),
    // Switching months keeps the last month's flow on screen until the next one is in,
    // never another workspace's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });
  // The first flow drawn opens with the full animation; once another month's data replaces it,
  // the lines draw in a short take. Keyed to the data, not the month: the placeholder kept on
  // screen while the next month loads is the same object, so it is not drawn twice.
  const [firstData, setFirstData] = useState(query.data);
  const [switched, setSwitched] = useState(false);
  if (query.data && !firstData) {
    setFirstData(query.data);
  } else if (query.data && firstData && query.data !== firstData && !switched) {
    setSwitched(true);
  }
  const sankey = useMemo(
    () => (query.data ? foldSmallest(withoutSubcategories(query.data.sankey), otherName) : null),
    [query.data, otherName],
  );
  const option = useMemo(
    () =>
      sankey
        ? {
            ...buildCashFlowSankey(
              { sankey },
              resolvedTheme,
              formatAmount,
              isMobile,
              categoryName,
              privacy,
            ),
            ...(switched ? SWITCH_ANIMATION : {}),
          }
        : null,
    // formatAmount is rebuilt every render; the chart only needs to follow the data and theme.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
    [sankey, resolvedTheme, isMobile, categoryName, privacy, switched],
  );

  if (query.isPending) {
    return <SpendFlowSkeleton />;
  }
  if (!(sankey && option) || sankey.links.length === 0) {
    return (
      <CardEmpty icon={BarChartOutlined} fill>
        {t.empty}
      </CardEmpty>
    );
  }
  return (
    <>
      {query.data?.missingRates.length ? (
        <p className="seneca-dashboard__card-note" style={{ color: 'var(--attention)' }}>
          {t.missingRates.value.replace('{{currencies}}', query.data.missingRates.join(', '))}
        </p>
      ) : null}
      <LazyECharts
        option={option}
        style={{ height: cashFlowChartHeight({ sankey }), width: '100%' }}
        notMerge
      />
    </>
  );
}
