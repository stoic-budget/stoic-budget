import { SetMetadata } from '@nestjs/common';

export const ROUTE_AUTHENTICATES_KEY = 'routeAuthenticates';

/**
 * The route's own guard authenticates whatever is not an API key: the MCP
 * endpoint takes OAuth access tokens, which are not session JWTs and must not
 * work anywhere else. `JwtAuthGuard` still checks API keys and leaves the rest
 * to that guard, which must refuse a request it cannot authenticate.
 */
export const RouteAuthenticates = () => SetMetadata(ROUTE_AUTHENTICATES_KEY, true);
