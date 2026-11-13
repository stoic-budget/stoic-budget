'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { BalanceCheckResult } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { isDebtType } from '../account-types';
import { localToday, parseBankBalance } from '../balance-check-input';
import type { Account } from '../hooks/useAccounts';
import { useBalanceCheck } from '../hooks/useBalanceCheck';
import { formatDay, mutedStyle } from './account-detail-styles';
import { BalanceCheckReasons } from './BalanceCheckReasons';

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);

const labelStyle = { fontSize: 13, color: 'var(--text-muted)' } as const;

/**
 * "Check balance": the person types the one number their bank shows for a
 * day; we answer with ours, and either remember the match or show where the
 * difference probably is, with the choice to book it or come back later.
 */
export function BalanceCheckDialog({
  account,
  open,
  onClose,
}: {
  account: Account;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const t = useIntlayer('accountBalanceCheck');
  const tPage = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const debt = isDebtType(account.type);
  const balanceCheck = useBalanceCheck(account.id, tPage.failed.value);
  const [text, setText] = useState('');
  const [date, setDate] = useState(localToday);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<BalanceCheckResult | null>(null);

  const balance = parseBankBalance(text, debt);
  // A debt reads as what is owed, as the person typed it.
  const shown = (value: number) => formatMoney(debt ? -value : value, account.currency, locale);
  const signed = (value: number) => formatMoney(value, account.currency, locale);
  const day = formatDay(result?.date ?? date, locale);
  // Rows without a rate, in Review or set aside as duplicates are not in our balance
  // yet: booking now would count them twice once they are. The server refuses it too.
  const canBook = !result?.reasons.some(reason =>
    ['unconverted', 'in_review', 'duplicates'].includes(reason.kind),
  );

  const close = () => {
    setText('');
    setTouched(false);
    setResult(null);
    setDate(localToday());
    onClose();
  };
  const run = async () => {
    setTouched(true);
    if (balance === null || !date) {
      return;
    }
    setResult(await balanceCheck.run({ date, balance }).catch(() => null));
  };
  const book = async () => {
    if (!result) {
      return;
    }
    const booked = await balanceCheck
      .book({ date: result.date, balance: result.bankBalance })
      .catch(() => null);
    if (booked) {
      toast.success(t.booked.value);
      close();
    }
  };

  const form = (
    <div style={{ display: 'grid', gap: 16 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={labelStyle}>{debt ? t.owedLabel : t.balanceLabel}</span>
        <TextField
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && void run()}
          error={touched && balance === null}
          helperText={touched && balance === null ? t.invalidAmount.value : undefined}
          slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': t.balanceLabel.value } }}
          autoFocus
          fullWidth
          size="small"
        />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={labelStyle}>{t.dateLabel}</span>
        <TextField
          type="date"
          value={date}
          onChange={event => setDate(event.target.value)}
          slotProps={{ htmlInput: { max: localToday(), 'aria-label': t.dateLabel.value } }}
          fullWidth
          size="small"
        />
      </label>
    </div>
  );

  const matched = result?.matches && (
    <div style={{ display: 'grid', gap: 8 }} data-testid="balance-check-match">
      <strong style={{ fontSize: 15, fontWeight: 500, color: 'var(--money-up)' }}>
        {t.matchTitle}
      </strong>
      <span style={mutedStyle}>
        {fillTemplateNodes(fill(t.matchBody.value, { date: day }), {
          amount: shown(result.ourBalance),
        })}
      </span>
    </div>
  );

  const mismatched = result && !result.matches && (
    <div style={{ display: 'grid', gap: 16 }} data-testid="balance-check-mismatch">
      <div style={{ display: 'grid', gap: 4 }}>
        <strong style={{ fontSize: 15, fontWeight: 500, color: 'var(--attention)' }}>
          {fillTemplateNodes(t.mismatchTitle.value, {
            amount: signed(Math.abs(result.difference)),
          })}
        </strong>
        <span style={mutedStyle}>
          {fillTemplateNodes(t.bankBalance.value, { amount: shown(result.bankBalance) })}
        </span>
        <span style={mutedStyle}>
          {fillTemplateNodes(fill(t.ourBalance.value, { date: day }), {
            amount: shown(result.ourBalance),
          })}
        </span>
      </div>
      <BalanceCheckReasons reasons={result.reasons} date={result.date} money={signed} />
      {!canBook && <p style={{ ...mutedStyle, margin: 0 }}>{t.bookBlocked}</p>}
      {canBook && (
        <p style={{ ...mutedStyle, margin: 0 }}>
          {fillTemplateNodes(fill(t.bookHint.value, { payee: t.payee.value, date: day }), {
            amount: signed(result.difference),
          })}
        </p>
      )}
    </div>
  );

  const footer = !result ? (
    <>
      <Button variant="text" onClick={close}>
        {tPage.cancel}
      </Button>
      <Button variant="contained" onClick={() => void run()} disabled={balanceCheck.pending}>
        {t.check}
      </Button>
    </>
  ) : result.matches ? (
    <Button variant="contained" onClick={close}>
      {t.done}
    </Button>
  ) : (
    <>
      <Button variant="text" onClick={close} disabled={balanceCheck.booking}>
        {t.checkLater}
      </Button>
      {canBook && (
        <Button variant="contained" onClick={() => void book()} disabled={balanceCheck.booking}>
          {t.book}
        </Button>
      )}
    </>
  );

  return (
    <ModalShell isOpen={open} onClose={close} title={t.title} size="sm" footer={footer}>
      {matched || mismatched || form}
    </ModalShell>
  );
}
