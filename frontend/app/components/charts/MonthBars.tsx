import Skeleton from '@mui/material/Skeleton';
import clsx from 'clsx';
import { useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';

export interface MonthBar {
  /** `YYYY-MM`. */
  month: string;
  value: number;
}

/**
 * Twelve quiet bars, one a month, oldest first. With `onSelect` each bar is a
 * button: pressing one picks its month, pressing it again lets go.
 */
export function MonthBars({
  months,
  currency,
  tone,
  selected = null,
  onSelect,
}: {
  months: MonthBar[];
  currency: string;
  tone: string;
  selected?: string | null;
  onSelect?: (month: string | null) => void;
}): React.JSX.Element {
  const { locale } = useLocale();
  const highest = Math.max(...months.map(month => month.value), 0);
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const longName = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <div className={clsx('seneca-month-bars', selected && 'seneca-month-bars--picked')}>
      {months.map(({ month, value }) => {
        const date = new Date(`${month}-01T00:00:00Z`);
        const content = (
          <>
            <span
              className="seneca-month-bars__fill"
              style={{ height: highest > 0 ? `${(value / highest) * 90}%` : 0, background: tone }}
            />
            <span className="seneca-month-bars__label">{monthName.format(date)}</span>
          </>
        );
        const title = `${longName.format(date)}: ${formatMoney(value, currency, locale)}`;
        return onSelect ? (
          <button
            key={month}
            type="button"
            className={clsx(
              'seneca-month-bars__bar',
              month === selected && 'seneca-month-bars__bar--selected',
            )}
            title={title}
            aria-label={title}
            aria-pressed={month === selected}
            onClick={() => onSelect(month === selected ? null : month)}
          >
            {content}
          </button>
        ) : (
          <div key={month} className="seneca-month-bars__bar" title={title}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => `m${index}`);

/** The bars while they load: twelve empty ones of the same shape. */
export function MonthBarsSkeleton(): React.JSX.Element {
  return (
    <div className="seneca-month-bars" aria-busy="true">
      {MONTH_KEYS.map(key => (
        <div key={key} className="seneca-month-bars__bar">
          <Skeleton
            variant="rectangular"
            width="100%"
            height="60%"
            // The bar's own shape (seneca-month-bars__fill).
            sx={{ maxWidth: 28, borderRadius: '4px 4px 0 0' }}
          />
          <Skeleton variant="text" width={24} height={16} />
        </div>
      ))}
    </div>
  );
}
