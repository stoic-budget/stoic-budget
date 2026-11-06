'use client';

import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { usePathname, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import {
  formatMonthParam,
  parseMonthParam,
} from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { useMonthLabel } from '@/app/components/dashboard/use-month-label';
import {
  DollarSign,
  Flag,
  Landmark,
  PiggyBank,
  Repeat,
  ShieldAlert,
  TrendingUp,
  Users,
} from '@/app/components/icons';
import { PanelBackTitle } from '@/app/components/panels/panel-ui';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer, useLocale } from '@/app/i18n';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { tokens } from '@/lib/theme-tokens';
import { promptTemplates } from './prompt-templates';

const CHATGPT_URL = 'https://chatgpt.com/';
const MAX_URL_LENGTH = 6000;

interface CardDef {
  key: string;
  title: React.ReactNode;
  description: React.ReactNode;
  icon: React.ReactElement;
}

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Set when the drawer sits on top of the plugin catalogue. */
  onBack?: () => void;
  zIndex?: number;
}

/**
 * Opens ChatGPT with the prompt, in the address or, when too long for one, on
 * the clipboard. False when the browser refused: it may do that this far from
 * the click, and the user then gets a second click. Not `noopener`, which would
 * make a refused window look like an opened one.
 */
async function handOver(prompt: string, onCopied: () => void): Promise<boolean> {
  const url = `${CHATGPT_URL}?q=${encodeURIComponent(prompt)}`;
  const fits = url.length <= MAX_URL_LENGTH;
  if (!fits) {
    const copied = await navigator.clipboard.writeText(prompt).then(
      () => true,
      () => false,
    );
    if (!copied) return false;
    onCopied();
  }
  const opened = window.open(fits ? url : CHATGPT_URL, '_blank');
  if (!opened) return false;
  opened.opener = null;
  return true;
}

export function AiAssistantDrawer({ isOpen, onClose, onBack, zIndex }: AiAssistantDrawerProps) {
  const t = useIntlayer('aiAssistantDrawer');
  const { locale } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  /** A prompt built but refused by the browser, waiting for a second click. */
  const [ready, setReady] = useState<{ key: string; prompt: string } | null>(null);
  // Only the dashboard's own month counts: `?month=` means other things on other pages.
  const pickedMonth =
    pathname === DEFAULT_APP_ROUTE ? parseMonthParam(searchParams?.get('month')) : null;
  const month = pickedMonth ? formatMonthParam(pickedMonth) : null;
  const monthLabel = useMonthLabel(pickedMonth ?? new Date(0));

  const cards: CardDef[] = [
    {
      key: 'expense-summary',
      title: t.cards.expenseSummary.title,
      description: t.cards.expenseSummary.description,
      icon: <DollarSign size={20} />,
    },
    {
      key: 'cash-flow',
      title: t.cards.cashFlow.title,
      description: t.cards.cashFlow.description,
      icon: <TrendingUp size={20} />,
    },
    {
      key: 'top-counterparties',
      title: t.cards.topCounterparties.title,
      description: t.cards.topCounterparties.description,
      icon: <Users size={20} />,
    },
    {
      key: 'tax-preparation',
      title: t.cards.taxPreparation.title,
      description: t.cards.taxPreparation.description,
      icon: <Landmark size={20} />,
    },
    {
      key: 'anomaly-detection',
      title: t.cards.anomalyDetection.title,
      description: t.cards.anomalyDetection.description,
      icon: <ShieldAlert size={20} />,
    },
    {
      key: 'budget-recommendations',
      title: t.cards.budgetRecommendations.title,
      description: t.cards.budgetRecommendations.description,
      icon: <PiggyBank size={20} />,
    },
    {
      key: 'goals-runway',
      title: t.cards.goalsRunway.title,
      description: t.cards.goalsRunway.description,
      icon: <Flag size={20} />,
    },
    {
      key: 'subscriptions-review',
      title: t.cards.subscriptionsReview.title,
      description: t.cards.subscriptionsReview.description,
      icon: <Repeat size={20} />,
    },
  ];

  const handleCardClick = useCallback(
    async (key: string) => {
      const template = promptTemplates.find(pt => pt.key === key);
      if (!template) return;

      setLoadingKey(key);
      setReady(null);

      await (async () => {
        const prompt = await template.buildPrompt({
          month,
          locale: String(locale),
        });
        const handedOver = await handOver(prompt, () => toast.success(t.copied.value));
        if (!handedOver) {
          setReady({ key, prompt });
        }
      })()
        .catch(async () => {
          toast.error(t.loadFailed.value);
        })
        .finally(async () => {
          setLoadingKey(null);
        });
    },
    [t.copied, t.loadFailed, month, locale],
  );

  /** The second click: a fresh gesture the browser will not refuse. */
  const handleReadyClick = useCallback(
    async (key: string, prompt: string) => {
      const handedOver = await handOver(prompt, () => toast.success(t.copied.value));
      setReady(handedOver ? null : { key, prompt });
    },
    [t.copied],
  );

  const closeDrawer = useCallback(() => {
    setReady(null);
    onClose();
  }, [onClose]);

  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={closeDrawer}
      title={onBack ? <PanelBackTitle title={t.title} onBack={onBack} /> : t.title}
      position="right"
      width="lg"
      zIndex={zIndex}
    >
      <Box sx={{ px: 2, pb: 2 }}>
        <Typography
          sx={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            mb: pickedMonth ? 0.5 : 2.5,
          }}
        >
          {t.subtitle}
        </Typography>
        {pickedMonth && (
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)', mb: 2.5 }}>
            {t.selectedMonth.value.replace('{month}', monthLabel)}
          </Typography>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1.5,
          }}
        >
          {cards.map(card => {
            const isLoading = loadingKey === card.key;
            const readyPrompt = ready?.key === card.key ? ready.prompt : null;
            return (
              <Box
                key={card.key}
                onClick={() => {
                  if (readyPrompt) void handleReadyClick(card.key, readyPrompt);
                  else if (!isLoading) void handleCardClick(card.key);
                }}
                sx={{
                  border: '1px solid var(--border-color)',
                  borderRadius: tokens.radius.lg,
                  p: 2,
                  cursor: isLoading ? 'wait' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  '&:hover': isLoading
                    ? {}
                    : {
                        borderColor: 'primary.main',
                      },
                }}
              >
                <Box
                  sx={theme => ({
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radius.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                  })}
                >
                  {card.icon}
                </Box>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}
                >
                  {card.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  {card.description}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'primary.main',
                    mt: 'auto',
                    pt: 0.5,
                  }}
                >
                  {isLoading ? t.loading : readyPrompt ? t.ready : t.run}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </DrawerShell>
  );
}
