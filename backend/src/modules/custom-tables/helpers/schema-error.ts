import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { appError } from '../../../common/errors/app-error';

export type DriverErrorLike = { driverError?: { code?: string } };

export function getDriverErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null
    ? (error as DriverErrorLike).driverError?.code
    : undefined;
}

export function throwHelpfulSchemaError(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const code = getDriverErrorCode(error);
    if (code === '42P01' || code === '42703') {
      throw new BadRequestException(appError('TABLE_SCHEMA_OUTDATED'));
    }
  }
  throw error;
}
