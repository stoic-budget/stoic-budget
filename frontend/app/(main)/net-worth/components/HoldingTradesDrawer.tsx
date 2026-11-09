'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { InvestmentHolding } from '../hooks/useInvestments';
import { type InvestmentTrade, useInvestmentTrades } from '../hooks/useInvestmentTrades';
import { HoldingLotsSummary } from './HoldingLotsSummary';
import { SplitDialog } from './SplitDialog';
import { TradeFormDrawer } from './TradeFormDrawer';
import { formatUnits, KIND_KEYS, ratioText } from './trade-labels';

interface HoldingTradesDrawerProps {
  /** Read from the refreshed list on every render, so the figures follow each change. */
  holding: InvestmentHolding | null;
  locale: string;
  onClose: () => void;
}

/**
 * A holding's trades and what they add up to: the lots, the gains, the
 * dividends, and the cost-basis method they are worked out with. Trades are
 * added and corrected in a drawer of their own; a split in a dialog.
 */
export function HoldingTradesDrawer({ holding, locale, onClose }: HoldingTradesDrawerProps) {
  const t = useIntlayer('investmentTrades');
  const holdingId = holding?.id ?? null;
  const data = useInvestmentTrades(holdingId);
  const [editing, setEditing] = useState<InvestmentTrade | 'new' | null>(null);
  const [splitting, setSplitting] = useState<InvestmentTrade | 'new' | null>(null);

  const currency = data.lots?.currency ?? holding?.priceCurrency ?? 'USD';
  const money = (value: number, code: string) => formatMoney(value, code, locale);
  // The row is looked up again from the refreshed list: an edit never shows a stale copy.
  const byId = (trade: InvestmentTrade | 'new' | null) =>
    trade === 'new' || trade === null
      ? null
      : (data.trades.find(item => item.id === trade.id) ?? null);

  const detail = (trade: InvestmentTrade) => {
    switch (trade.kind) {
      case 'dividend':
        return money(trade.amount ?? 0, trade.currency);
      case 'split':
        return ratioText(trade.splitTo, trade.splitFrom, locale);
      default:
        return `${formatUnits(trade.quantity, locale)} × ${money(trade.price, trade.currency)}`;
    }
  };

  return (
    <DrawerShell isOpen={Boolean(holding)} onClose={onClose} title={holding?.name} width="lg">
      {holding && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          {data.lots && data.trades.length > 0 && (
            <HoldingLotsSummary lots={data.lots} locale={locale} />
          )}
          {/* Dividends alone leave the typed quantity: the first buy still replaces it. */}
          {!data.trades.some(trade => trade.kind !== 'dividend') && !data.isPending && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {holding.quantity > 0 ? t.fromTradesHint : t.noTrades}
            </Typography>
          )}

          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {t.basisMethod} · {t.basisMethodHint}
            </Typography>
            <Select
              size="small"
              aria-label={t.basisMethod.value}
              value={data.basisMethod}
              disabled={data.saving}
              options={[
                { value: 'fifo', label: t.methodFifo.value },
                { value: 'average', label: t.methodAverage.value },
              ]}
              onChange={value => void data.setBasisMethod(value as 'fifo' | 'average')}
              data-testid="basis-method"
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{t.trades}</Typography>
              <Button size="small" variant="text" onClick={() => setSplitting('new')}>
                {t.split}
              </Button>
              <Button size="small" variant="outlined" onClick={() => setEditing('new')}>
                <Plus size={16} aria-hidden />
                {t.addTrade}
              </Button>
            </Box>
            {data.trades.map(trade => (
              <Box
                key={trade.id}
                data-testid={`trade-${trade.id}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr auto', sm: '96px 120px 1fr auto' },
                  alignItems: 'center',
                  columnGap: 1.5,
                  py: 0.75,
                  borderTop: 1,
                  borderColor: 'divider',
                  fontSize: 14,
                }}
              >
                <Box sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {trade.date}
                </Box>
                <Box sx={{ fontWeight: 500 }}>{t[KIND_KEYS[trade.kind]]}</Box>
                <Box sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
                  <PrivateAmount>{detail(trade)}</PrivateAmount>
                  {trade.fee > 0 && (
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                      {' '}
                      · {trade.kind === 'dividend' ? t.taxWithheld : t.fee}{' '}
                      <PrivateAmount>{money(trade.fee, trade.currency)}</PrivateAmount>
                    </Typography>
                  )}
                  {trade.note && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', color: 'text.secondary' }}
                    >
                      {trade.note}
                    </Typography>
                  )}
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    gridRow: { xs: '1 / span 3', sm: 'auto' },
                    gridColumn: { xs: 2, sm: 'auto' },
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label={`${t.edit.value} ${trade.date}`}
                    onClick={() =>
                      trade.kind === 'split' ? setSplitting(trade) : setEditing(trade)
                    }
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`${t.delete.value} ${trade.date}`}
                    disabled={data.saving}
                    onClick={() => void data.deleteTrade(trade.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <TradeFormDrawer
        key={`form-${keyOf(editing)}`}
        open={editing !== null}
        trade={byId(editing)}
        currency={currency}
        saving={data.saving}
        onClose={() => setEditing(null)}
        onSave={input => {
          const current = byId(editing);
          return current ? data.updateTrade(current.id, input) : data.createTrade(input);
        }}
      />
      <SplitDialog
        key={`split-${keyOf(splitting)}`}
        open={splitting !== null}
        split={byId(splitting)}
        held={holding?.quantity ?? 0}
        locale={locale}
        saving={data.saving}
        onClose={() => setSplitting(null)}
        onSave={input => {
          const current = byId(splitting);
          return current ? data.updateTrade(current.id, input) : data.createTrade(input);
        }}
      />
    </DrawerShell>
  );
}

/** One form state per opening: closed, new, or the trade being corrected. */
function keyOf(trade: InvestmentTrade | 'new' | null): string {
  return trade === null ? 'closed' : trade === 'new' ? 'new' : trade.id;
}
