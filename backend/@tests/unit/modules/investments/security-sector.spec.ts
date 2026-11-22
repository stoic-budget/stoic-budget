import { EffectRuntime } from '@/common/effect/effect-runtime';
import { SecuritySectorService } from '@/modules/investments/security-sector.service';

vi.mock('@/common/utils/egress-url.util', () => ({
  assertPublicEgressUrl: vi.fn(async () => undefined),
}));

describe('SecuritySectorService.sectorOf', () => {
  const search = (quotes: Array<{ symbol: string; sector?: string | null }>) =>
    JSON.stringify({ count: quotes.length, quotes });
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: SecuritySectorService;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new SecuritySectorService(new EffectRuntime());
  });

  it('maps the exact symbol’s sector onto the GICS list', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          search([
            { symbol: 'ACMEX', sector: 'Energy' },
            { symbol: 'ACME', sector: 'Consumer Cyclical' },
          ]),
          { status: 200 },
        ),
    );
    expect(await service.sectorOf('acme')).toBe('consumer_discretionary');
    expect(String(fetchMock.mock.calls[0][0])).toContain('q=ACME&');
  });

  it('asks under the market name Yahoo uses', async () => {
    fetchMock.mockImplementation(
      async () => new Response(search([{ symbol: 'ACME.L', sector: 'Technology' }]), { status: 200 }),
    );
    expect(await service.sectorOf('ACME.UK')).toBe('information_technology');
  });

  it('answers nothing for a fund, a look-alike, an unknown sector or a failure', async () => {
    fetchMock.mockImplementationOnce(
      async () => new Response(search([{ symbol: 'ACME', sector: null }]), { status: 200 }),
    );
    expect(await service.sectorOf('ACME')).toBeNull();
    fetchMock.mockImplementationOnce(
      async () => new Response(search([{ symbol: 'ACMEX', sector: 'Energy' }]), { status: 200 }),
    );
    expect(await service.sectorOf('ACME')).toBeNull();
    fetchMock.mockImplementationOnce(
      async () => new Response(search([{ symbol: 'ACME', sector: 'Conglomerates' }]), { status: 200 }),
    );
    expect(await service.sectorOf('ACME')).toBeNull();
    fetchMock.mockImplementation(async () => new Response('nope', { status: 404 }));
    expect(await service.sectorOf('ACME')).toBeNull();
  });
});
