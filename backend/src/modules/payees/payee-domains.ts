import type { EntityManager } from 'typeorm';

/** A name shaped like a website: dot-separated labels of letters, digits and dashes. */
const DOMAIN_SHAPE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * The zones a payee's website is likely to end in. A name ending in anything
 * else is not taken for a website: bank exports write people as "J.DOE" or
 * "MR.SMITH", and ".doe" or ".smith" must never reach the icon service.
 */
const KNOWN_ZONES = new Set([
  ...['com', 'net', 'org', 'io', 'co', 'app', 'dev', 'ai', 'me', 'info', 'biz', 'shop', 'store'],
  ...['online', 'site', 'tech', 'xyz', 'cloud', 'pro', 'tv', 'gg', 'fm', 'eu', 'uk', 'de', 'fr'],
  ...['es', 'it', 'nl', 'pl', 'pt', 'ie', 'be', 'at', 'ch', 'cz', 'sk', 'se', 'no', 'fi', 'dk'],
  ...['ru', 'ua', 'by', 'kz', 'uz', 'ge', 'am', 'tr', 'il', 'us', 'ca', 'au', 'nz', 'in', 'jp'],
  ...['cn', 'kr', 'br', 'mx', 'ar'],
]);

/** Characters the first label needs, so an initial ("J.", "I.") never makes a website. */
const MIN_FIRST_LABEL = 3;

/** The payee's name as a domain, when that is what it is; never a guess from a word. */
export function domainOfName(name: string): string | null {
  const candidate = name.trim().toLowerCase();
  if (!DOMAIN_SHAPE.test(candidate)) {
    return null;
  }
  const labels = candidate.split('.');
  return labels[0].length >= MIN_FIRST_LABEL && KNOWN_ZONES.has(labels[labels.length - 1])
    ? candidate
    : null;
}

/**
 * The website of each payee, for its brand mark: the one stored with the
 * subscription it is filed under (an active one first, then the latest
 * edited), else its name when the name is a domain. Nothing is guessed from a
 * plain name: a person's name would fetch a stranger's icon. Callers pass only
 * payees of the workspace; every table is held to it.
 */
export async function payeeDomains(
  manager: EntityManager,
  workspaceId: string,
  payees: ReadonlyArray<{ id: string; name: string }>,
): Promise<Map<string, string>> {
  const domains = new Map<string, string>();
  if (payees.length === 0) {
    return domains;
  }
  const rows: Array<{ payeeId: string; domain: string }> = await manager.query(
    `SELECT DISTINCT ON (sp.payee_id) sp.payee_id AS "payeeId", s.vendor_domain AS domain
       FROM subscription_payees sp
       JOIN subscriptions s ON s.id = sp.subscription_id AND s.workspace_id = $1
      WHERE sp.workspace_id = $1
        AND sp.payee_id = ANY($2::uuid[])
        AND COALESCE(s.vendor_domain, '') <> ''
      ORDER BY sp.payee_id, (s.status = 'active') DESC, s.updated_at DESC`,
    [workspaceId, payees.map(payee => payee.id)],
  );
  for (const row of rows) {
    domains.set(row.payeeId, row.domain);
  }
  for (const payee of payees) {
    const fromName = domains.has(payee.id) ? null : domainOfName(payee.name);
    if (fromName) {
      domains.set(payee.id, fromName);
    }
  }
  return domains;
}
