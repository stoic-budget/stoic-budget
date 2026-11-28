import type { BadgeVariant } from '@/app/components/ui/badge';
import type { InvoiceStatus } from '@/app/lib/invoices-api';
import { toDate } from '@/app/lib/user-format';

export function formatInvoiceDate(value: string | null | undefined, locale = 'en'): string {
  if (!value) {
    return '—';
  }
  // An issue or due date is a calendar day: read and shown where the person is.
  const date = toDate(value);
  if (!date) {
    return '—';
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getInvoiceStatusVariant(status: InvoiceStatus): BadgeVariant {
  switch (status) {
    case 'paid':
      return 'success';
    case 'partially_paid':
      return 'warning';
    case 'overdue':
      return 'destructive';
    case 'void':
      return 'outline';
    case 'sent':
      return 'info';
    default:
      return 'secondary';
  }
}
