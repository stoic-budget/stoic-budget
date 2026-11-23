import { BadRequestException } from '@nestjs/common';
import { appError } from '../../common/errors/app-error';

/**
 * A payment recorded on a bill: more than zero, with a fee below it (some
 * money must arrive), and no more than is still outstanding.
 */
export function assertPaymentFits(amount: number, fee: number, outstanding: number): void {
  if (amount <= 0) {
    throw new BadRequestException(appError('PAYABLE_PAYMENT_NOT_POSITIVE'));
  }
  if (fee >= amount) {
    throw new BadRequestException(appError('PAYABLE_FEE_NOT_BELOW_PAYMENT'));
  }
  if (amount > outstanding + 0.005) {
    throw new BadRequestException(
      appError('PAYABLE_PAYMENT_EXCEEDS_OUTSTANDING', { outstanding: outstanding.toFixed(2) }),
    );
  }
}

/** Money taken for a bill needs something still owed on it. */
export function assertSomethingOwed(outstanding: number): void {
  if (outstanding <= 0.005) {
    throw new BadRequestException(
      appError('PAYABLE_PAYMENT_EXCEEDS_OUTSTANDING', { outstanding: '0.00' }),
    );
  }
}
