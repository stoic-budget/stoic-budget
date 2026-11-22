import { useIntlayer } from '@/app/i18n';

/**
 * Marks a row the bank still holds as pending. A status is text with a small
 * dot, ochre as anything still to be confirmed; the hint says why it counts
 * nowhere yet.
 */
export function PendingBadge(): React.JSX.Element {
  const t = useIntlayer('bankPending');
  return (
    <span className="seneca-pending-badge" title={t.hint.value}>
      {t.badge}
    </span>
  );
}
