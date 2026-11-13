import { HttpException, HttpStatus } from '@nestjs/common';
import { appError, type ErrorCode } from '../../../common/errors/app-error';

/**
 * A single sign-on step that said no. Carries only our own code: the
 * provider's error text never reaches the person, the URL or the log.
 * The callback turns it into a redirect, the JSON routes into an answer.
 */
export class OidcRefusal extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(appError(code), status);
  }
}

/** The codes a redirect may carry to the login or settings page, and nothing else. */
export const refusalCode = (error: unknown): ErrorCode => {
  if (error instanceof OidcRefusal) return error.code;
  if (error instanceof HttpException) {
    const body = error.getResponse();
    const code = typeof body === 'object' && body && 'code' in body ? body.code : null;
    if (code === 'AUTH_ACCOUNT_INACTIVE') return code;
  }
  return 'OIDC_PROVIDER_UNAVAILABLE';
};

/** A callback that failed once its state was known: which page to return to, and why. */
export class OidcCallbackFailure extends Error {
  constructor(
    readonly mode: 'login' | 'link',
    readonly code: ErrorCode,
  ) {
    super(code);
  }
}
