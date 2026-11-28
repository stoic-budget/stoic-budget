'use client';

import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { BrokerChecks } from './BrokerChecks';
import type { ImportChoices } from './import-choices';
import type { ImportTarget } from './import-wizard-api';
import { TransactionImportOptions } from './TransactionImportOptions';
import { useInvestmentAccountOptions } from './useInvestmentAccountOptions';

type ChoicesProps = {
  choices: ImportChoices;
  onChange: (patch: Partial<ImportChoices>) => void;
};

/**
 * Where a trades sheet goes: holdings are matched in the chosen investment
 * account (or in all of them), and ones it does not have are created only
 * when asked, and only in a chosen account.
 */
function TradeImportOptions({ choices: values, onChange }: ChoicesProps): React.JSX.Element {
  const t = useIntlayer('importWizard');
  const accounts = useInvestmentAccountOptions(true);
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
          onChange={next =>
            onChange({
              investmentAccountId: next,
              // A new holding needs an account to go to: without one there is nothing to create in.
              ...(next ? {} : { createMissingHoldings: false }),
            })
          }
          data-testid="import-wizard-investment-account"
        />
      </div>
      <div className="seneca-iw__check">
        <Checkbox
          checked={values.createMissingHoldings}
          disabled={!values.investmentAccountId}
          onCheckedChange={checked => onChange({ createMissingHoldings: checked })}
        />
        <span>{t.createMissingHoldings}</span>
      </div>
      {!values.investmentAccountId && <p className="seneca-iw__hint">{t.createMissingHint}</p>}
      <BrokerChecks />
    </>
  );
}

/** The options of the chosen target, under the column mapping. */
export function ImportTargetOptions({
  target,
  choices,
  onChange,
}: ChoicesProps & { target: ImportTarget }): React.JSX.Element | null {
  if (target === 'trades') {
    return <TradeImportOptions choices={choices} onChange={onChange} />;
  }
  if (target !== 'transactions') {
    return null;
  }
  return <TransactionImportOptions choices={choices} onChange={onChange} />;
}
