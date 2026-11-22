'use client';

import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatDate } from '@/app/lib/user-format';
import type { ImportChoices } from './import-choices';
import { fillTemplate } from './import-wizard-utils';

/**
 * What an imported bank export also needs: the account it came from (picking
 * one sets the sheet's currency to the account's) and whether rows without a
 * category are categorized. With no account picked, the server files the sheet
 * where earlier exports with the same header row went. Opened from a gap
 * between an account's statements, only the rows of the gap's dates go in,
 * unless the person unticks it.
 */
export function TransactionImportOptions({
  choices,
  onChange,
}: {
  choices: ImportChoices;
  onChange: (patch: Partial<ImportChoices>) => void;
}): React.JSX.Element {
  const { categorize, walletId, period, heldToPeriod } = choices;
  const t = useIntlayer('importWizard');
  const { locale } = useLocale();
  const expense = useIntlayer('statementsCreateExpenseDrawer');
  const workspaceId = useWorkspaceId();
  const accounts = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  const active = (accounts.data ?? []).filter(
    account => account.isActive || account.id === walletId,
  );

  return (
    <>
      {active.length > 0 && (
        <div className="seneca-iw__control">
          <span className="seneca-iw__label">{expense.account}</span>
          <Select
            size="small"
            fullWidth
            aria-label={expense.account.value}
            value={walletId}
            options={[
              { value: '', label: expense.noAccount.value },
              ...active.map(account => ({
                value: account.id,
                label: `${account.name} · ${account.currency}`,
              })),
            ]}
            onChange={next => {
              const picked = active.find(account => account.id === next);
              onChange({
                walletId: next,
                ...(picked ? { currency: picked.currency.toUpperCase() } : {}),
              });
            }}
            data-testid="import-wizard-account"
          />
        </div>
      )}
      {period && (
        <div className="seneca-iw__check">
          <Checkbox
            checked={heldToPeriod}
            onCheckedChange={value => onChange({ heldToPeriod: value })}
            id="import-wizard-period"
          />
          <span>
            {fillTemplate(t.heldToPeriod.value, {
              from: formatDate(period.from, { locale }),
              to: formatDate(period.to, { locale }),
            })}
          </span>
        </div>
      )}
      <div className="seneca-iw__check">
        <Checkbox checked={categorize} onCheckedChange={value => onChange({ categorize: value })} />
        <span>{t.categorize}</span>
      </div>
    </>
  );
}
