'use client';

import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { AppImportResult } from './app-import-api';

const NEW_ACCOUNT = '__new__';

/** Each account of the files and the workspace account it goes to, or a new one. */
export function AppImportAccounts({
  accounts,
  wallets,
  choices,
  onPick,
}: {
  accounts: AppImportResult['accounts'];
  wallets: Array<{ id: string; name: string; currency: string }>;
  choices: Record<string, string | null>;
  onPick: (name: string, walletId: string | null) => void;
}): React.JSX.Element | null {
  const t = useIntlayer('appImport');
  if (accounts.length === 0) {
    return null;
  }
  return (
    <div className="seneca-ai__section">
      <p className="seneca-ai__section-title">{t.accountsTitle}</p>
      <table className="seneca-iw__table">
        <tbody>
          {accounts.map(account => (
            <tr key={account.name}>
              <td>
                <div className="seneca-iw__header">{account.name}</div>
                <div className="seneca-iw__example">{account.currency}</div>
              </td>
              <td>
                <Select
                  size="small"
                  fullWidth
                  aria-label={account.name}
                  value={choices[account.name] ?? NEW_ACCOUNT}
                  onChange={value => onPick(account.name, value === NEW_ACCOUNT ? null : value)}
                  options={[
                    { value: NEW_ACCOUNT, label: t.newAccount.value },
                    ...wallets.map(wallet => ({
                      value: wallet.id,
                      label: `${wallet.name} · ${wallet.currency}`,
                    })),
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
