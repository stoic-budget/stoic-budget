'use client';

import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { ImportTarget } from './import-wizard-api';
import { TransactionImportOptions } from './TransactionImportOptions';
import type { useImportOptions } from './useImportOptions';
import { useInvestmentAccountOptions } from './useInvestmentAccountOptions';

type Options = ReturnType<typeof useImportOptions>;

/**
 * Where a trades sheet goes: holdings are matched in the chosen investment
 * account (or in all of them), and ones it does not have are created only
 * when asked, and only in a chosen account.
 */
function TradeImportOptions({ options }: { options: Options }): React.JSX.Element {
  const t = useIntlayer('importWizard');
  const accounts = useInvestmentAccountOptions(true);
  const { values, set } = options;
  return (
    <>
      <div className="seneca-iw__control">
        <span className="seneca-iw__label">{t.fields.account}</span>
        <Select
          size="small"
          fullWidth
          aria-label={t.fields.account.value}
          value={values.investmentAccountId}
          options={[
            { value: '', label: t.anyInvestmentAccount.value },
            ...accounts.map(account => ({ value: account.id, label: account.name })),
          ]}
          onChange={next => set('investmentAccountId', next)}
          data-testid="import-wizard-investment-account"
        />
      </div>
      <div className="seneca-iw__check">
        <Checkbox
          checked={values.createMissingHoldings}
          disabled={!values.investmentAccountId}
          onCheckedChange={checked => set('createMissingHoldings', checked)}
        />
        <span>{t.createMissingHoldings}</span>
      </div>
      {!values.investmentAccountId && <p className="seneca-iw__hint">{t.createMissingHint}</p>}
    </>
  );
}

/** The options of the chosen target, under the column mapping. */
export function ImportTargetOptions({
  target,
  options,
  onCurrencyChange,
}: {
  target: ImportTarget;
  options: Options;
  onCurrencyChange: (currency: string) => void;
}): React.JSX.Element | null {
  if (target === 'trades') {
    return <TradeImportOptions options={options} />;
  }
  if (target !== 'transactions') {
    return null;
  }
  const { values, set } = options;
  return (
    <TransactionImportOptions
      categorize={values.categorize}
      onCategorizeChange={value => set('categorize', value)}
      walletId={values.walletId}
      onWalletChange={value => set('walletId', value)}
      onCurrencyChange={onCurrencyChange}
    />
  );
}
