import { BadRequestException } from '@nestjs/common';
import { appError } from '../../common/errors/app-error';
import { formatPeppolId, LEITWEG_SCHEME, parsePeppolId } from '../e-invoices/peppol-id';
import type { XRechnungInput } from '../e-invoices/xrechnung-writer';

/**
 * The buyer's Peppol id; a public authority addressed by Leitweg-ID also
 * needs it as the buyer reference, or the federal portal rejects the invoice.
 */
export function recipientOf(input: XRechnungInput): string {
  const id = parsePeppolId(input.buyer.peppolId);
  if (!id) {
    throw new BadRequestException({
      ...appError('PEPPOL_DOCUMENT_INCOMPLETE'),
      missing: ['buyer_peppol_id'],
    });
  }
  if (
    id.scheme === LEITWEG_SCHEME &&
    input.buyerReference?.trim().toUpperCase() !== id.value.toUpperCase()
  ) {
    throw new BadRequestException(appError('PEPPOL_LEITWEG_MISMATCH', { leitweg: id.value }));
  }
  return formatPeppolId(id);
}

/**
 * A line with no VAT rate would go out as "not subject to VAT" (category E,
 * "Nicht umsatzsteuerpflichtig"): refused, as the XRechnung download is.
 */
export function assertEveryLineRated(missing: readonly string[]): void {
  if (missing.includes('line_tax_rate')) {
    throw new BadRequestException({
      ...appError('PEPPOL_DOCUMENT_INCOMPLETE'),
      missing: ['line_tax_rate'],
    });
  }
}
