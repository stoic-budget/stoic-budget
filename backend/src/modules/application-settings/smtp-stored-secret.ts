/** The parts of an SMTP setting that name the server and the account on it. */
type SmtpServer = { host: string; port: number; user?: string };

/**
 * The stored SMTP row whose password a save may keep, or null. A save without a
 * new password keeps the stored one only for the same server and account (host,
 * port, user): the connection check authenticates with it, so keeping it for a
 * host the caller just typed would send the stored credential to that host.
 */
export function storedSmtpForSameServer<T extends { config: Record<string, unknown> }>(
  stored: T | null,
  next: SmtpServer,
): T | null {
  if (!stored) {
    return null;
  }
  const { host, port, user } = stored.config;
  const sameServer =
    typeof host === 'string' &&
    host.toLowerCase() === next.host.toLowerCase() &&
    Number(port) === next.port &&
    (typeof user === 'string' ? user : undefined) === next.user;
  return sameServer ? stored : null;
}
