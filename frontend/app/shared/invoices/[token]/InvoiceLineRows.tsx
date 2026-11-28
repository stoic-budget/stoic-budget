import { Box } from '@mui/material';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';

export const money = (amount: string, currency: string) =>
  `${Number(amount).toFixed(2)} ${currency}`;

export interface PublicInvoiceLine {
  description: string;
  quantity: string;
  unitPrice: string;
  adjustmentPercent: string | null;
  amount: string;
}

/** The rows of the public invoice's line table, marked as the PDF marks them. */
export function InvoiceLineRows({
  lines,
  currency,
  labels: t,
}: {
  lines: PublicInvoiceLine[];
  currency: string;
  labels: Record<string, string>;
}) {
  return (
    <Box component="tbody">
      {lines.map(line => (
        <Box component="tr" key={`${line.description}-${line.amount}`}>
          <Box component="td" sx={{ fontSize: 14, py: 0.75 }}>
            {line.description}
            {line.adjustmentPercent && (
              // As the PDF marks it: "Discount 10%" under the description.
              <Box
                component="span"
                sx={{ display: 'block', fontSize: 13, color: 'var(--text-muted)' }}
              >
                {Number(line.adjustmentPercent) < 0 ? t.discount : t.surcharge}{' '}
                {Math.abs(Number(line.adjustmentPercent))}%
              </Box>
            )}
          </Box>
          <Box component="td" sx={{ fontSize: 14, py: 0.75, textAlign: 'right' }}>
            {Number(line.quantity)}
          </Box>
          <Box
            component="td"
            className={PRIVATE_CLASS}
            sx={{ fontSize: 14, py: 0.75, textAlign: 'right' }}
          >
            {money(line.unitPrice, currency)}
          </Box>
          <Box
            component="td"
            className={PRIVATE_CLASS}
            sx={{ fontSize: 14, py: 0.75, textAlign: 'right' }}
          >
            {money(line.amount, currency)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
