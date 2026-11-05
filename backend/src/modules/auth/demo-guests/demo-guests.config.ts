/**
 * Guest demo sessions: a public instance lets a visitor try the app without
 * signing up. Off unless `DEMO_GUESTS_ENABLED=true`, so an ordinary
 * self-hosted install never hands out accounts to anyone who asks.
 */

/** `.invalid` is reserved (RFC 2606): no mailbox exists, so nothing is ever sent to a guest. */
export const GUEST_EMAIL_DOMAIN = 'guest.demo.invalid';

const DEFAULT_TTL_HOURS = 24;
const DEFAULT_MAX_GUESTS = 200;

export function demoGuestsEnabled(): boolean {
  return process.env.DEMO_GUESTS_ENABLED?.trim().toLowerCase() === 'true';
}

/** How long a guest and its demo workspace live before the sweep removes them. */
export function demoGuestTtlMs(): number {
  return positiveInt(process.env.DEMO_GUEST_TTL_HOURS, DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
}

/** Guests alive at once; past it a new visitor is turned away until the sweep frees room. */
export function demoGuestsMax(): number {
  return positiveInt(process.env.DEMO_GUESTS_MAX, DEFAULT_MAX_GUESTS);
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
