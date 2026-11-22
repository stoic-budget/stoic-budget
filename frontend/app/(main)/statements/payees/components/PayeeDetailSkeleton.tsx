import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { MonthBarsSkeleton } from '@/app/components/charts/MonthBars';
import { useIntlayer } from '@/app/i18n';
import { PayeePeersSkeleton } from './PayeePeersSection';
import { PayeeTransactions } from './PayeeTransactions';

const FIGURE_KEYS = ['a', 'b', 'c'];

/** The payee's figures while the summary loads: a label and a value each. */
export function PayeeFiguresSkeleton(): React.JSX.Element {
  return (
    <div className="seneca-payees__figures" aria-busy="true">
      {FIGURE_KEYS.map(key => (
        <div key={key}>
          <Skeleton variant="text" width={110} height={20} />
          <Skeleton variant="text" width={90} height={28} />
        </div>
      ))}
    </div>
  );
}

/** The months card while the summary loads: its title over twelve empty bars. */
export function PayeeMonthsSkeleton(): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  return (
    <section className="seneca-all-tx__card seneca-payees__section" aria-busy="true">
      <h2 className="seneca-all-tx__card-title">{t.monthsTitle}</h2>
      <MonthBarsSkeleton />
    </section>
  );
}

/**
 * The payee page while the payee loads: the header with its buttons, the
 * cards with their titles, and the transactions, which load on their own, for real.
 */
export function PayeeDetailSkeleton({ payeeId }: { payeeId: string }): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  const tPayees = useIntlayer('payees');
  return (
    <>
      <header
        aria-busy="true"
        style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      >
        <Skeleton variant="circular" width={44} height={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="text" width={240} height={30} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outlined" disabled>
            {t.rename}
          </Button>
          <Button variant="outlined" disabled>
            {t.mergeWith}
          </Button>
        </div>
      </header>

      <PayeeFiguresSkeleton />

      <div className="seneca-all-tx__body" style={{ alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <PayeeMonthsSkeleton />
          <PayeePeersSkeleton />
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="seneca-all-tx__card seneca-payees__section">
            <h2 className="seneca-all-tx__card-title">{t.categoryTitle}</h2>
            <Skeleton variant="rounded" height={40} />
            <span className="seneca-all-tx__muted" style={{ fontSize: 13 }}>
              {tPayees.hint}
            </span>
          </section>
          <section className="seneca-all-tx__card seneca-payees__section">
            <h2 className="seneca-all-tx__card-title">{t.aliasesTitle}</h2>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </section>
        </div>
      </div>

      <PayeeTransactions payeeId={payeeId} />
    </>
  );
}
