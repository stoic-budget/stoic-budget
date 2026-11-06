'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Scale, X } from '@/app/components/icons';
import { byImportance, isGoodNews, needsAttention } from '@/app/components/insights/advice-order';
import { insightHref } from '@/app/components/insights/insight-href';
import { isWorkInsight } from '@/app/components/insights/work-insights';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { BulbLineIcon } from '@/app/components/ui/empty-state-icons';
import { PageTitle } from '@/app/components/ui/page-title';
import { type Insight, useInsights, useRefreshInsights } from '@/app/hooks/useInsights';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';

const ADVICE_SKELETON_KEYS = [
  'advice-0',
  'advice-1',
  'advice-2',
  'advice-3',
  'advice-4',
  'advice-5',
];

/** One column of reading width: the arrow and Dismiss stay next to the words they act on. */
const LIST_MAX_WIDTH = 760;

const isReflection = (item: Insight) => item.type === 'stoic.reflection';
const isStoic = (item: Insight) => item.type.startsWith('stoic.');

/** "Seneca, Moral Letters to Lucilius, Letter 18" for reflections. */
function sourceCredit(item: Insight): string | null {
  const author = item.data?.author;
  const work = item.data?.work;
  return typeof author === 'string' && typeof work === 'string' ? `${author}, ${work}` : null;
}

/**
 * The month the advice judged, when it is not the running one: in the first days
 * of a month the reading is about the month before.
 */
function judgedMonth(item: Insight, locale: string): string | null {
  const month = item.data?.month;
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }
  const now = new Date();
  const running = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (month === running) {
    return null;
  }
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, index - 1, 1),
  );
}

/** "2 days ago", in the reader's language. */
function ago(iso: string, locale: string): string {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return Math.abs(days) < 1
    ? format.format(Math.round((Date.parse(iso) - Date.now()) / 3_600_000), 'hour')
    : format.format(days, 'day');
}

/**
 * The mark before a line: an ochre dot for what needs doing, a sage check for
 * good news, a grey glyph naming a Stoic reading or reflection, otherwise nothing.
 * A bulb on every line repeated the sidebar and said nothing.
 */
function AdviceMark({ item }: { item: Insight }): React.JSX.Element {
  if (needsAttention(item)) {
    return <Box className="seneca-advice__dot" aria-hidden />;
  }
  if (isGoodNews(item)) {
    return <CheckCircle2 size={18} color="var(--money-up)" aria-hidden />;
  }
  if (isReflection(item)) {
    return <BookOpen size={18} color="var(--muted-foreground)" aria-hidden />;
  }
  if (isStoic(item)) {
    return <Scale size={18} color="var(--muted-foreground)" aria-hidden />;
  }
  return <span aria-hidden />;
}

function AdviceRow({
  item,
  openLabel,
  dismissLabel,
  locale,
  onDismiss,
}: {
  item: Insight;
  openLabel: string;
  dismissLabel: string;
  locale: string;
  onDismiss: (id: string) => void;
}): React.JSX.Element {
  const href = insightHref(item);
  const month = judgedMonth(item, locale);
  const body = (
    <>
      <Box sx={{ width: 18, pt: 0.375, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <AdviceMark item={item} />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{item.title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {item.message}
        </Typography>
        {sourceCredit(item) && (
          <Typography
            variant="caption"
            component="p"
            sx={{ color: 'text.secondary', fontStyle: 'italic' }}
          >
            — {sourceCredit(item)}
          </Typography>
        )}
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {month ? `${month} · ` : ''}
          {ago(item.createdAt, locale)}
        </Typography>
      </Box>
      {href === null ? null : <ArrowRight size={16} className="seneca-advice__arrow" aria-hidden />}
    </>
  );

  return (
    <Box component="li" className="seneca-advice__row">
      {href === null ? (
        <Box className="seneca-advice__main">{body}</Box>
      ) : (
        <ButtonBase
          component={Link}
          href={href}
          aria-label={`${item.title}. ${openLabel}`}
          className="seneca-advice__main"
        >
          {body}
        </ButtonBase>
      )}
      {/* Seen it: away it goes, or the list only ever grows. */}
      <IconButton
        size="small"
        className="seneca-advice__dismiss"
        aria-label={`${dismissLabel}: ${item.title}`}
        onClick={() => onDismiss(item.id)}
      >
        <X size={14} />
      </IconButton>
    </Box>
  );
}

function AdviceGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box component="section">
      <Typography
        component="h2"
        variant="caption"
        sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}
      >
        {title}
      </Typography>
      <Box component="ul" className="seneca-advice">
        {children}
      </Box>
    </Box>
  );
}

/** A row of the list while it loads: the dot, the lines and the arrow in their places. */
function AdviceRowSkeleton(): React.JSX.Element {
  return (
    <Box component="li" className="seneca-advice__row">
      {/* Centred like the loaded row, which is a button. */}
      <Box className="seneca-advice__main" sx={{ alignItems: 'center' }}>
        <Box
          sx={{ width: 18, pt: 0.375, display: 'flex', justifyContent: 'center', flexShrink: 0 }}
        >
          <Skeleton variant="circular" width={7} height={7} sx={{ mt: 0.75 }} />
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Skeleton variant="text" width="45%" sx={{ fontSize: 15 }} />
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            <Skeleton variant="text" width="95%" />
            <Skeleton variant="text" width="60%" />
          </Typography>
          <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
            <Skeleton variant="text" width={56} />
          </Typography>
        </Box>
        <ArrowRight size={16} className="seneca-advice__arrow" aria-hidden />
      </Box>
    </Box>
  );
}

export default function AdvicePage() {
  const t = useIntlayer('insights');
  // The one place that recomputes: opening this page is the user asking for a
  // fresh read, unlike a banner that happens to render on every route.
  // Every observation, whatever its severity; the work items (unconfirmed rows,
  // categories, duplicates) are the strip above the pages and live there only.
  const {
    items: everything,
    isPending,
    dismiss,
  } = useInsights({
    severities: ['info', 'warn', 'critical'],
  });
  const items = everything.filter(item => !isWorkInsight(item)).sort(byImportance);
  const refreshInsights = useRefreshInsights();
  const triggerRefresh = refreshInsights.mutate;
  // Switching the interface language rewrites the advice in it.
  const { locale } = useLocale();
  // Waits for the workspace: without one the server answers 403 (a fresh browser).
  const workspaceId = useWorkspaceId();
  useEffect(() => {
    if (workspaceId) {
      triggerRefresh(locale);
    }
  }, [triggerRefresh, locale, workspaceId]);

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box sx={{ mb: 3 }}>
        <PageTitle path="/advice" />
      </Box>
      {isPending && (
        <Box aria-busy sx={{ maxWidth: LIST_MAX_WIDTH, display: 'grid', gap: 4 }}>
          <AdviceGroup title={t.needsAttention.value}>
            {ADVICE_SKELETON_KEYS.map(key => (
              <AdviceRowSkeleton key={key} />
            ))}
          </AdviceGroup>
        </Box>
      )}

      {!isPending && items.length === 0 && (
        <EmptyState
          fill
          icon={<BulbLineIcon />}
          title={t.adviceEmptyTitle}
          description={t.adviceEmptyHint}
          action={
            <Button variant="contained" component={Link} href="/budgets">
              {t.openBudgets}
            </Button>
          }
        />
      )}

      {/* What asks for something first, then the rest, as two quiet lists. */}
      {items.length > 0 && (
        <Box sx={{ maxWidth: LIST_MAX_WIDTH, display: 'grid', gap: 4 }}>
          {[
            { key: 'attention', title: t.needsAttention.value, rows: items.filter(needsAttention) },
            {
              key: 'info',
              title: t.forYourInfo.value,
              rows: items.filter(item => !needsAttention(item)),
            },
          ]
            .filter(group => group.rows.length > 0)
            .map(group => (
              <AdviceGroup key={group.key} title={group.title}>
                {group.rows.map(item => (
                  <AdviceRow
                    key={item.id}
                    item={item}
                    openLabel={t.openLabel.value}
                    dismissLabel={t.dismiss.value}
                    locale={locale}
                    onDismiss={dismiss}
                  />
                ))}
              </AdviceGroup>
            ))}
        </Box>
      )}
    </Box>
  );
}
