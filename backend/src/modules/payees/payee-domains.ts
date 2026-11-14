import type { EntityManager } from 'typeorm';

/** A name that is itself a website: "grizzlysms.com", "shop.example.co.il". */
const DOMAIN_NAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/** The payee's name as a domain, when that is what it is; never a guess from a word. */
export function domainOfName(name: string): string | null {
  const candidate = name.trim().toLowerCase();
  return DOMAIN_NAME.test(candidate) ? candidate : null;
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
