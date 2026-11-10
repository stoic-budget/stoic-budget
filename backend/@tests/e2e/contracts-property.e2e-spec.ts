vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  NetWorthResponse,
  PropertyDebtOptions,
  PropertyDetails,
} from '../../src/contracts';
import { BalanceAccount } from '../../src/entities/balance-account.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Line = { id: string; code: string; children?: Line[] };
type PropertyLine = NetWorthResponse['properties'][number];

/**
 * Real estate and vehicles with their details and the debt they were bought
 * with, against a real database: the answers checked against their contracts
 * with data in them, every id a request carries looked up in the caller's own
 * workspace, and net worth counting a linked flat and its mortgage once each.
 */
describe('API contracts: property and vehicles (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `property-owner-${stamp}@example.com`, other: `property-other-${stamp}@example.com` };
  let owner: E2eAccount;
  let other: E2eAccount;
  let home: string;
  let otherHome: string;
  const ids = {} as Record<
    'realEstate' | 'vehicles' | 'mortgage' | 'otherAssets' | 'loan' | 'checking' | 'card',
    string
  >;
  const foreign = {} as Record<'loan' | 'mortgage' | 'realEstate', string>;

  const flat = 300_000;
  const mortgage = 200_000;
  const car = 20_000;
  const loanOwed = 15_000;

  const daysAgo = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };
  const call = (
    as: { token: string; workspaceId: string },
    method: Method,
    url: string,
    status: number,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${as.token}`)
      .set('x-workspace-id', as.workspaceId);
    return (body ? req.send(body) : req).expect(status);
  };
  const mine = (method: Method, url: string, status: number, body?: object) =>
    call({ token: owner.token, workspaceId: home }, method, url, status, body);
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(body);
  const property = (url: string) => `/reports/balance/accounts/${url}/property`;
  const propertiesOf = async (): Promise<PropertyLine[]> => {
    const res = await mine('get', '/reports/net-worth?range=30d', 200);
    matches(NetWorthResponse, res.body);
    return res.body.properties;
  };
  const lineIds = (body: { assets: Line[]; liabilities: Line[] }) => {
    const byCode = new Map<string, string>();
    const walk = (lines: Line[]) => {
      for (const line of lines) {
        byCode.set(line.code, line.id);
        walk(line.children ?? []);
      }
    };
    walk([...body.assets, ...body.liabilities]);
    return byCode;
  };
  const homeWorkspace = async (account: E2eAccount, name: string) => {
    const created = await call(account, 'post', '/workspaces', 201, { name, profile: 'home' });
    const workspaceId = created.body.id ?? created.body.data?.id;
    await call(account, 'patch', `/workspaces/${workspaceId}`, 200, { currency: 'USD' });
    return workspaceId as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    home = await homeWorkspace(owner, `Household ${stamp}`);
    otherHome = await homeWorkspace(other, `Other household ${stamp}`);

    const lines = lineIds((await mine('get', '/reports/balance/accounts', 200)).body);
    ids.realEstate = lines.get('ASSET_REAL_ESTATE') as string;
    ids.vehicles = lines.get('ASSET_VEHICLES') as string;
    ids.mortgage = lines.get('LIABILITY_MORTGAGE') as string;
    ids.otherAssets = lines.get('ASSET_OTHER') as string;
    const wallet = async (name: string, type: string, initialBalance = 0) =>
      (await mine('post', '/wallets', 201, { name, type, currency: 'USD', initialBalance })).body
        .id as string;
    ids.loan = await wallet('ACME Bank - Car loan', 'loan', -loanOwed);
    ids.checking = await wallet('ACME Bank - Everyday', 'checking', 100);
    ids.card = await wallet('ACME Bank - Card', 'credit_card');

    const snapshot = (accountId: string, amount: number, date: string) =>
      mine('put', '/reports/balance/snapshot', 200, { accountId, amount, currency: 'USD', date });
    await snapshot(ids.realEstate, flat, daysAgo(40));
    await snapshot(ids.mortgage, mortgage, daysAgo(40));
    await snapshot(ids.vehicles, car, daysAgo(365));

    const asOther = { token: other.token, workspaceId: otherHome };
    const otherLines = lineIds((await call(asOther, 'get', '/reports/balance/accounts', 200)).body);
    foreign.mortgage = otherLines.get('LIABILITY_MORTGAGE') as string;
    foreign.realEstate = otherLines.get('ASSET_REAL_ESTATE') as string;
    foreign.loan = (
      await call(asOther, 'post', '/wallets', 201, {
        name: 'ACME Bank - Other loan',
        type: 'loan',
        currency: 'USD',
        initialBalance: -1000,
      })
    ).body.id;
  }, 60_000);

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, emails.owner);
      await deleteUserByEmail(dataSource, emails.other);
    }
    await app.close();
  });

  it('GET /reports/balance/property-debts lists loans and typed debt lines, nothing else', async () => {
    const res = await mine('get', '/reports/balance/property-debts', 200);
    matches(PropertyDebtOptions, res.body);
    const options = res.body.options as Array<{ kind: string; id: string; linkedTo: string | null }>;
    expect(options).toContainEqual(expect.objectContaining({ kind: 'wallet', id: ids.loan, linkedTo: null }));
    expect(options).toContainEqual(
      expect.objectContaining({ kind: 'liability', id: ids.mortgage, linkedTo: null }),
    );
    const offered = options.map(option => option.id);
    expect(offered).not.toContain(ids.checking);
    expect(offered).not.toContain(ids.card);
    expect(offered).not.toContain(foreign.loan);
    expect(offered).not.toContain(foreign.mortgage);
  });

  it('PUT …/property stores a flat with its mortgage line, and net worth counts each once', async () => {
    const attributes = { area: 72.5, areaUnit: 'm2', yearBuilt: 1998, address: '1 Example Street' };
    const saved = await mine('put', property(ids.realEstate), 200, {
      attributes,
      debt: { kind: 'liability', id: ids.mortgage },
    });
    matches(PropertyDetails, saved.body);
    expect(saved.body).toEqual({
      accountId: ids.realEstate,
      kind: 'real_estate',
      attributes,
      debt: { kind: 'liability', id: ids.mortgage },
      depreciationRate: null,
    });

    const res = await mine('get', '/reports/net-worth?range=30d', 200);
    matches(NetWorthResponse, res.body);
    const flatLine = res.body.properties.find((line: PropertyLine) => line.accountId === ids.realEstate);
    expect(flatLine).toMatchObject({
      kind: 'real_estate',
      value: flat,
      estimated: false,
      valuedOn: daysAgo(40),
      attributes,
      debt: { kind: 'liability', id: ids.mortgage, amount: mortgage },
      equity: flat - mortgage,
      ltv: 0.6667,
    });
    // The flat on the asset side and the mortgage on the debt side, once each:
    // the equity is a view of them, not a third figure.
    expect(res.body.assetsTotal).toBe(flat + car + 100);
    const mortgageGroup = res.body.groups.find((group: { key: string }) => group.key === 'mortgage');
    expect(mortgageGroup.amount).toBe(mortgage);
    expect(res.body.current).toBe(
      Math.round((res.body.assetsTotal - res.body.liabilitiesTotal) * 100) / 100,
    );
  });

  it('depreciates the car from its last valuation, links it to the loan, and starts again from a new valuation', async () => {
    const vehicle = { make: 'ACME', model: 'Roadster', year: 2019, mileage: 42_000, mileageUnit: 'km' };
    const saved = await mine('put', property(ids.vehicles), 200, {
      attributes: vehicle,
      depreciationRate: 15,
      debt: { kind: 'wallet', id: ids.loan },
    });
    matches(PropertyDetails, saved.body);
    expect(saved.body).toMatchObject({ kind: 'vehicle', depreciationRate: 15, debt: { kind: 'wallet', id: ids.loan } });

    const estimated = (await propertiesOf()).find(line => line.accountId === ids.vehicles);
    expect(estimated).toMatchObject({ estimated: true, valuedOn: daysAgo(365), attributes: vehicle });
    expect(estimated?.value).toBeCloseTo(car * 0.85, 2);
    expect(estimated?.debt).toMatchObject({ kind: 'wallet', id: ids.loan, name: 'ACME Bank - Car loan', amount: loanOwed });
    expect(estimated?.equity).toBeCloseTo(car * 0.85 - loanOwed, 2);

    await mine('put', '/reports/balance/snapshot', 200, {
      accountId: ids.vehicles,
      amount: 18_000,
      currency: 'USD',
      date: daysAgo(0),
    });
    const revalued = (await propertiesOf()).find(line => line.accountId === ids.vehicles);
    expect(revalued).toMatchObject({ value: 18_000, estimated: false, valuedOn: daysAgo(0) });
    // The year before keeps the valuation it had: the history is not rewritten.
    const history = await mine('get', `/reports/balance/accounts/${ids.vehicles}/history`, 200);
    expect(history.body).toContainEqual({ date: daysAgo(365), amount: car, currency: 'USD' });
  });

  it('links a debt to one property at most', async () => {
    const taken = await mine('put', property(ids.realEstate), 409, { debt: { kind: 'wallet', id: ids.loan } });
    expect(taken.body.error?.code).toBe('BALANCE_PROPERTY_DEBT_TAKEN');
    const options = (await mine('get', '/reports/balance/property-debts', 200)).body.options;
    expect(options).toContainEqual(expect.objectContaining({ id: ids.loan, linkedTo: ids.vehicles }));
    expect(options).toContainEqual(expect.objectContaining({ id: ids.mortgage, linkedTo: ids.realEstate }));
  });

  it('looks every id up in the caller workspace', async () => {
    await mine('put', property(ids.realEstate), 404, { debt: { kind: 'wallet', id: foreign.loan } });
    await mine('put', property(ids.realEstate), 404, { debt: { kind: 'liability', id: foreign.mortgage } });
    await mine('put', property(foreign.realEstate), 404, { attributes: { area: 1 } });

    const [flatRow, otherRow] = await Promise.all([
      dataSource.getRepository(BalanceAccount).findOneByOrFail({ id: ids.realEstate }),
      dataSource.getRepository(BalanceAccount).findOneByOrFail({ id: foreign.realEstate }),
    ]);
    expect(flatRow).toMatchObject({ debtAccountId: ids.mortgage, debtWalletId: null });
    expect(otherRow).toMatchObject({ attributes: null, debtAccountId: null, debtWalletId: null });
  });

  it('refuses details that do not fit the line', async () => {
    const code = async (url: string, status: number, body: object) =>
      (await mine('put', url, status, body)).body.error?.code;
    expect(await code(property(ids.realEstate), 400, { attributes: { make: 'ACME' } })).toBe(
      'BALANCE_PROPERTY_DETAILS_INVALID',
    );
    expect(await code(property(ids.realEstate), 400, { depreciationRate: 10 })).toBe(
      'BALANCE_PROPERTY_DETAILS_INVALID',
    );
    expect(await code(property(ids.otherAssets), 400, { attributes: null })).toBe('BALANCE_NOT_PROPERTY');
    expect(await code(property(ids.mortgage), 400, { attributes: null })).toBe('BALANCE_NOT_PROPERTY');
    expect(await code(property(ids.vehicles), 400, { debt: { kind: 'wallet', id: ids.checking } })).toBe(
      'BALANCE_PROPERTY_DEBT_INVALID',
    );
    expect(await code(property(ids.vehicles), 400, { debt: { kind: 'liability', id: ids.realEstate } })).toBe(
      'BALANCE_PROPERTY_DEBT_INVALID',
    );
    await mine('put', property(ids.vehicles), 400, { attributes: { area: 1, make: 'ACME' } });
    await mine('put', property(ids.vehicles), 400, { depreciationRate: 101 });
  });

  it('unlinks a deleted loan account and keeps reading the property', async () => {
    await mine('delete', `/wallets/${ids.loan}`, 200);
    const vehicle = (await propertiesOf()).find(line => line.accountId === ids.vehicles);
    expect(vehicle).toMatchObject({ debt: null, equity: vehicle?.value, ltv: null });
  });

  it('clears what is sent as null and leaves what is left out', async () => {
    const cleared = await mine('put', property(ids.realEstate), 200, { debt: null });
    expect(cleared.body).toMatchObject({ debt: null, attributes: { area: 72.5 } });
  });
});
