'use client';

import Alert from '@mui/material/Alert';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import type { Category } from '@/app/components/transactions/types';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { type CashState, IN_HAND, today, type WalletOption } from './MarkPaidFields';

/** Which account the money of a bill entered as already settled went into or left, and when. */
export function PaidNowFields({
  wallets,
  categories,
  account,
  value,
  onChange,
}: {
  wallets: WalletOption[];
  categories: Category[];
  /** The account in effect; null while the accounts load. */
  account: string | null;
  value: CashState;
  onChange: (next: CashState) => void;
}): React.JSX.Element {
  const t = useIntlayer('payableMarkPaid');
  const accountText = useIntlayer('statementsCreateExpenseDrawer');
  const unbookedText = useIntlayer('payablesUnbooked');
  return (
    <>
      <div className="seneca-payable-drawer__field-group">
        <label
          className="seneca-payable-drawer__field-label"
          id="payable-account-label"
          htmlFor="payable-account"
        >
          {accountText.account.value}
        </label>
        <Select
          fullWidth
          id="payable-account"
          labelId="payable-account-label"
          sx={FORM_CONTROL_SX}
          value={account ?? ''}
          options={[
            ...wallets.map(wallet => ({ value: wallet.id, label: wallet.name })),
            { value: IN_HAND, label: unbookedText.inHand.value },
          ]}
          onChange={walletId => onChange({ ...value, walletId })}
        />
      </div>
      <div className="seneca-payable-drawer__2col">
        <div className="seneca-payable-drawer__field-group">
          <label className="seneca-payable-drawer__field-label" htmlFor="payable-paid-on">
            {t.paidOn.value}
          </label>
          <CustomDatePicker
            id="payable-paid-on"
            large
            value={value.paidOn}
            maxDate={today()}
            onChange={paidOn => onChange({ ...value, paidOn })}
          />
        </div>
        <div className="seneca-payable-drawer__field-group">
          <label className="seneca-payable-drawer__field-label" htmlFor="payable-category">
            {t.category.value}
          </label>
          <CategoryPickerField
            id="payable-category"
            ariaLabel={t.category.value}
            value={value.categoryId}
            categories={categories}
            placeholder={t.noCategory.value}
            clearLabel={t.noCategory.value}
            onChange={categoryId => onChange({ ...value, categoryId })}
          />
        </div>
      </div>
      {account === IN_HAND && <Alert severity="info">{unbookedText.inHandHint.value}</Alert>}
    </>
  );
}
