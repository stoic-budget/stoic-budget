import { CategoryType } from '@/entities/category.entity';
import type { Statement } from '@/entities/statement.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '@/entities/transaction.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  StatementRowHintsService,
  transferHint,
} from '@/modules/parsing/services/statement-row-hints.service';

const WORKSPACE = 'workspace-1';
const USER = 'user-1';
const UNCATEGORIZED_ID = 'cat-uncategorized';

interface StoredCategory {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  workspaceId: string;
}

function setup(existing: StoredCategory[] = []) {
  const categories = [...existing];
  const repository = {
    find: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
      categories.filter(category => category.workspaceId === where.workspaceId),
    ),
    create: vi.fn((data: Partial<StoredCategory>) => data),
    save: vi.fn(async (data: Partial<StoredCategory>) => {
      const saved = { ...data, id: `cat-${categories.length + 1}` } as StoredCategory;
      categories.push(saved);
      return saved;
    }),
  };
  const classificationService = {
    classifyTransaction: vi.fn(async (): Promise<Partial<Transaction>> => ({})),
    ensureCategory: vi.fn(async () => UNCATEGORIZED_ID),
    invalidateWorkspaceCategoriesCache: vi.fn(async () => undefined),
  };
  const transactionsService = {
    split: vi.fn(async (id: string, _workspaceId: string, _userId: string, body: { parts: unknown[] }) =>
      body.parts.map((_part, index) => ({ id: `${id}-part-${index}` }) as Transaction),
    ),
  };
  const transactionRepository = { update: vi.fn(async () => ({ affected: 1 })) };
  const service = new StatementRowHintsService(
    classificationService as any,
    transactionsService as any,
    {
      getRepository: (entity: unknown) =>
        entity === Transaction ? transactionRepository : repository,
    } as any,
  );
  return { service, categories, classificationService, transactionsService, transactionRepository };
}

const row = (extra: Partial<Transaction> = {}) =>
  ({
    id: 'tx-1',
    workspaceId: WORKSPACE,
    transactionType: TransactionType.EXPENSE,
    amount: 100,
    debit: 100,
    isDuplicate: false,
    categorySource: null,
    ...extra,
  }) as Transaction;

const parsedRow = (extra: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  transactionDate: new Date('2026-09-05'),
  counterpartyName: 'Example Grocer',
  paymentPurpose: 'Example Grocer',
  debit: 100,
  ...extra,
});

const statement = (manual = false) =>
  ({
    id: 'statement-1',
    userId: USER,
    workspaceId: WORKSPACE,
    parsingDetails: manual ? { manualCategorySelectionRequired: true } : {},
  }) as unknown as Statement;

describe('StatementRowHintsService.classify', () => {
  it('files the row under the category the file named, made level by level', async () => {
    const { service, categories, classificationService } = setup();
    classificationService.classifyTransaction.mockResolvedValue({
      categoryId: UNCATEGORIZED_ID,
      categorySource: TransactionCategorySource.DEFAULT,
    });

    const result = await service.classify(row(), USER, parsedRow({ categoryName: 'Food:Groceries' }), false);

    const food = categories.find(category => category.name === 'Food');
    const groceries = categories.find(category => category.name === 'Groceries');
    expect(food).toMatchObject({ parentId: null, type: CategoryType.EXPENSE, workspaceId: WORKSPACE });
    expect(groceries).toMatchObject({ parentId: food?.id, type: CategoryType.EXPENSE });
    expect(result).toMatchObject({
      categoryId: groceries?.id,
      categorySource: TransactionCategorySource.MANUAL,
      categoryReason: null,
    });
    expect(classificationService.invalidateWorkspaceCategoriesCache).toHaveBeenCalledWith(WORKSPACE);
  });

  it('reuses the category the workspace already has, whatever its case', async () => {
    const { service, categories, classificationService } = setup([
      { id: 'cat-food', name: 'food', type: CategoryType.EXPENSE, parentId: null, workspaceId: WORKSPACE },
      { id: 'cat-groc', name: 'Groceries', type: CategoryType.EXPENSE, parentId: 'cat-food', workspaceId: WORKSPACE },
      { id: 'cat-other', name: 'Food', type: CategoryType.EXPENSE, parentId: null, workspaceId: 'workspace-2' },
    ]);

    const result = await service.classify(row(), USER, parsedRow({ categoryName: 'Food:Groceries' }), false);

    expect(result.categoryId).toBe('cat-groc');
    expect(categories).toHaveLength(3);
    expect(classificationService.invalidateWorkspaceCategoriesCache).not.toHaveBeenCalled();
  });

  it('leaves the category a rule decided', async () => {
    const { service, categories, classificationService } = setup();
    classificationService.classifyTransaction.mockResolvedValue({
      categoryId: 'cat-rule',
      categorySource: TransactionCategorySource.RULE,
      categoryReason: 'ACME rule',
    });

    const result = await service.classify(row(), USER, parsedRow({ categoryName: 'Food' }), false);

    expect(result).toMatchObject({ categoryId: 'cat-rule', categorySource: TransactionCategorySource.RULE });
    expect(categories).toHaveLength(0);
  });

  it('gives no category at all when the user picks them by hand', async () => {
    const { service, categories, classificationService } = setup();
    classificationService.classifyTransaction.mockResolvedValue({
      categoryId: UNCATEGORIZED_ID,
      categorySource: TransactionCategorySource.DEFAULT,
    });

    const result = await service.classify(row(), USER, parsedRow({ categoryName: 'Food' }), true);

    expect(result.categoryId).toBeUndefined();
    expect(result.categorySource).toBeNull();
    expect(categories).toHaveLength(0);
  });
});

describe('StatementRowHintsService.applySplits', () => {
  const splits = [
    { amount: 60, categoryName: 'Food', memo: 'Weekly shop' },
    { amount: 25, categoryName: 'Household' },
    { amount: 15 },
  ];

  it('splits the row the way a person would, each part with its own category', async () => {
    const { service, categories, transactionsService } = setup();
    const log = vi.fn();
    const plain = row({ id: 'tx-0' });

    const rows = await service.applySplits(
      statement(),
      [plain, row()],
      [parsedRow(), parsedRow({ splits })],
      log,
    );

    const id = (name: string) => categories.find(category => category.name === name)?.id;
    expect(transactionsService.split).toHaveBeenCalledWith('tx-1', WORKSPACE, USER, {
      parts: [
        { amount: 60, categoryId: id('Food'), paymentPurpose: 'Weekly shop' },
        { amount: 25, categoryId: id('Household') },
        { amount: 15, categoryId: UNCATEGORIZED_ID },
      ],
    });
    expect(rows.map(item => item.id)).toEqual(['tx-0', 'tx-1-part-0', 'tx-1-part-1', 'tx-1-part-2']);
    expect(log).not.toHaveBeenCalled();
  });

  it('gives part 0 the whole row\'s fingerprint back, so a later overlapping file is a duplicate', async () => {
    const { service, transactionRepository } = setup();
    const fingerprint = 'f'.repeat(64);

    const rows = await service.applySplits(
      statement(),
      [row({ fingerprint })],
      [parsedRow({ splits })],
      vi.fn(),
    );

    expect(transactionRepository.update).toHaveBeenCalledTimes(1);
    expect(transactionRepository.update).toHaveBeenCalledWith(
      { id: 'tx-1-part-0', workspaceId: WORKSPACE },
      { fingerprint },
    );
    expect(rows.map(item => item.fingerprint)).toEqual([fingerprint, undefined, undefined]);
  });

  it('keeps the [Account] of a part the file sent to another account', async () => {
    const { service, transactionsService, transactionRepository } = setup();
    const savings = 'Rainy Day Savings';

    const rows = await service.applySplits(
      statement(),
      [row({ fingerprint: null })],
      [parsedRow({ splits: [{ amount: 20, transferAccount: savings }, { amount: 80, categoryName: 'Food' }] })],
      vi.fn(),
    );

    expect(transactionsService.split.mock.calls[0][3].parts[0]).toEqual({
      amount: 20,
      categoryId: UNCATEGORIZED_ID,
    });
    expect(transactionRepository.update).toHaveBeenCalledTimes(1);
    expect(transactionRepository.update).toHaveBeenCalledWith(
      { id: 'tx-1-part-0', workspaceId: WORKSPACE },
      { categoryHint: `[${savings}]` },
    );
    expect(rows[0].categoryHint).toBe(`[${savings}]`);
  });

  it("keeps the rule's category on every part of a row a rule categorised", async () => {
    const { service, categories, transactionsService } = setup();

    await service.applySplits(
      statement(),
      [row({ categoryId: 'cat-rule', categorySource: TransactionCategorySource.RULE })],
      [parsedRow({ splits })],
      vi.fn(),
    );

    expect(transactionsService.split).toHaveBeenCalledWith('tx-1', WORKSPACE, USER, {
      parts: [{ amount: 60, paymentPurpose: 'Weekly shop' }, { amount: 25 }, { amount: 15 }],
    });
    expect(categories).toHaveLength(0);
  });

  it('does not split a duplicate again', async () => {
    const { service, transactionsService } = setup();
    const duplicate = row({ isDuplicate: true });

    const rows = await service.applySplits(statement(), [duplicate], [parsedRow({ splits })], vi.fn());

    expect(transactionsService.split).not.toHaveBeenCalled();
    expect(rows).toEqual([duplicate]);
  });

  it('keeps a row whole and says why when the split is refused', async () => {
    const { service, transactionsService } = setup();
    transactionsService.split.mockRejectedValueOnce(new Error('not allowed'));
    const log = vi.fn();
    const whole = row();

    const rows = await service.applySplits(statement(), [whole], [parsedRow({ splits })], log);

    expect(rows).toEqual([whole]);
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('Row 1 stays whole'));
  });
});

describe('transferHint', () => {
  it("keeps the file's [Account] on the row", () => {
    expect(transferHint({ transferAccount: 'Rainy Day Savings' })).toBe('[Rainy Day Savings]');
    expect(transferHint({})).toBeNull();
  });
});
