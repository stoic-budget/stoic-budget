import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import { ACCESS_TOKEN_COOKIE } from '../../../src/modules/auth/auth-cookies';
import { responseCookie } from './e2e-app';
import type { MockOidcProvider, TokenShape } from './mock-oidc-provider';

export const APP_ORIGIN = 'https://app.example.com';

/** Every answer the flow saw, so a test can check none of them carries a secret. */
export const seenAnswers: string[] = [];

const keep = (res: Response): Response => {
  seenAnswers.push(JSON.stringify({ body: res.body, location: res.headers.location ?? null }));
  return res;
};

/** The page a redirect lands on, with its query. */
export function landing(res: Response): URL {
  const location = res.headers.location;
  if (!location) throw new Error(`Expected a redirect, got ${res.status} ${JSON.stringify(res.body)}`);
  return new URL(location);
}

export interface StartedFlow {
  location: string;
  binding: string;
}

/** `POST /auth/oidc/start`: the authorization URL and the browser binding cookie. */
export async function startLogin(app: INestApplication, next?: string): Promise<StartedFlow> {
  const res = keep(
    await request(app.getHttpServer())
      .post('/auth/oidc/start')
      .send(next ? { next } : {}),
  );
  const binding = responseCookie(res, 'oidc_flow');
  if (res.status !== 200 || !binding) {
    throw new Error(`start failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { location: res.body.url, binding };
}

/** The password `registerAccount` gives every e2e account. */
export const ACCOUNT_PASSWORD = 'Test123!@#';

/** `POST /auth/oidc/link` as a signed-in user, with their current password. */
export async function startLink(
  app: INestApplication,
  token: string,
  password = ACCOUNT_PASSWORD,
): Promise<StartedFlow> {
  const res = keep(
    await request(app.getHttpServer())
      .post('/auth/oidc/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ password }),
  );
  const binding = responseCookie(res, 'oidc_flow');
  if (res.status !== 200 || !binding) throw new Error(`link failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { location: res.body.url, binding };
}

/** The browser comes back from the provider with `code` and the flow's state. */
export async function callback(
  app: INestApplication,
  flow: StartedFlow,
  code: string,
  options: { binding?: string | null; extra?: Record<string, string> } = {},
): Promise<Response> {
  const state = new URL(flow.location).searchParams.get('state') ?? '';
  const binding = options.binding === undefined ? flow.binding : options.binding;
  const req = request(app.getHttpServer())
    .get('/auth/oidc/callback')
    .query({ code, state, ...options.extra });
  return keep(await (binding ? req.set('Cookie', `oidc_flow=${binding}`) : req));
}

/** `POST /auth/oidc/complete` with the ticket cookie the callback set. */
export async function complete(
  app: INestApplication,
  ticket: string | undefined,
  twoFactorCode?: string,
): Promise<Response> {
  const req = request(app.getHttpServer())
    .post('/auth/oidc/complete')
    .send(twoFactorCode ? { twoFactorCode } : {});
  return keep(await (ticket ? req.set('Cookie', `oidc_ticket=${ticket}`) : req));
}

/**
 * The whole sign-in: start, the provider, the callback. Answers the callback
 * and, when it handed out a ticket, the completion and the session token.
 */
export async function signIn(
  app: INestApplication,
  provider: MockOidcProvider,
  subject: string,
  shape: TokenShape = {},
): Promise<{ callback: Response; completed: Response | null; token: string | undefined }> {
  const flow = await startLogin(app);
  const back = await callback(app, flow, provider.authorize(flow.location, subject, shape));
  const ticket = responseCookie(back, 'oidc_ticket');
  if (!ticket) return { callback: back, completed: null, token: undefined };
  const completed = await complete(app, ticket);
  return { callback: back, completed, token: responseCookie(completed, ACCESS_TOKEN_COOKIE) };
}

/** Saves the provider in instance settings as `admin`. */
export function configureProvider(
  app: INestApplication,
  adminToken: string,
  provider: MockOidcProvider,
  overrides: Record<string, unknown> = {},
) {
  return request(app.getHttpServer())
    .put('/settings/instance/oidc')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      enabled: true,
      issuer: provider.issuer,
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      buttonLabel: 'ACME Login',
      extraScopes: '',
      allowSignup: false,
      allowedDomains: [],
      ...overrides,
    })
    .then(keep);
}
