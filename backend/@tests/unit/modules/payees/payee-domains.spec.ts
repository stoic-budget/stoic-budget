import type { EntityManager } from 'typeorm';
import { domainOfName, payeeDomains } from '@/modules/payees/payee-domains';

const WORKSPACE = 'ws-1';

describe('domainOfName', () => {
  it('takes a name that is a website as its domain', () => {
    expect(domainOfName('ACME-SMS.example')).toBe('acme-sms.example');
    expect(domainOfName(' shop.example.co.il ')).toBe('shop.example.co.il');
  });

  it('guesses nothing from a plain name, a person or a version number', () => {
    expect(domainOfName('ACME Store')).toBeNull();
    expect(domainOfName('Member One')).toBeNull();
    expect(domainOfName('acme')).toBeNull();
    expect(domainOfName('1.5')).toBeNull();
    expect(domainOfName('ACME Store - Wireless Buds')).toBeNull();
  });
});

describe('payeeDomains', () => {
  const STREAMING = { id: 'p-streaming', name: 'ACME Streaming' };
  const SMS = { id: 'p-sms', name: 'acme-sms.example' };
  const FRIEND = { id: 'p-friend', name: 'Member Two' };
  const STREAMING_DOMAIN = 'acme-streaming.example';

  function managerAnswering(rows: Array<{ payeeId: string; domain: string }>) {
    const query = vi.fn(async () => rows);
    return { manager: { query } as unknown as EntityManager, query };
  }

  it("takes a payee's subscription website first, then a name that is a domain, and nothing else", async () => {
    const { manager, query } = managerAnswering([{ payeeId: STREAMING.id, domain: STREAMING_DOMAIN }]);

    const domains = await payeeDomains(manager, WORKSPACE, [STREAMING, SMS, FRIEND]);

    expect(Object.fromEntries(domains)).toEqual({
      [STREAMING.id]: STREAMING_DOMAIN,
      [SMS.id]: SMS.name,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('sp.workspace_id = $1'), [
      WORKSPACE,
      [STREAMING.id, SMS.id, FRIEND.id],
    ]);
  });

  it('lets the subscription website win over a name that is a domain', async () => {
    const stored = 'acme-sms-app.example';
    const { manager } = managerAnswering([{ payeeId: SMS.id, domain: stored }]);

    expect((await payeeDomains(manager, WORKSPACE, [SMS])).get(SMS.id)).toBe(stored);
  });

  it('asks nothing for no payees', async () => {
    const { manager, query } = managerAnswering([]);

    expect((await payeeDomains(manager, WORKSPACE, [])).size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
