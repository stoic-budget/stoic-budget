'use client';

import { useIntlayer } from '@/app/i18n';
import { useBrokerChecks } from './broker-checks-store';
import { fillTemplate } from './import-wizard-utils';

/** What a broker's PDF says that its rows do not: cash that does not add up, units bought before it. */
export function BrokerChecks(): React.JSX.Element | null {
  const t = useIntlayer('importWizard');
  const checks = useBrokerChecks();
  if (checks.length === 0) {
    return null;
  }
  return (
    <>
      {checks.map(check => (
        <p
          key={`${check.code}-${check.currency}-${check.symbol ?? ''}`}
          className="seneca-iw__hint"
        >
          {fillTemplate(
            check.code === 'cash_mismatch'
              ? t.brokerChecks.cash.value
              : t.brokerChecks.holding.value,
            {
              currency: check.currency,
              symbol: check.symbol ?? '',
              expected: String(check.expected),
              actual: String(check.actual),
            },
          )}
        </p>
      ))}
    </>
  );
}
