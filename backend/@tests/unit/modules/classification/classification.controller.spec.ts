import { ClassificationController } from '@/modules/classification/classification.controller';

function createRepoMock() {
  return {
    findOne: vi.fn(),
    findOneOrFail: vi.fn(async ({ where }) => ({ ...where })),
    save: vi.fn(async value => value),
  };
}

describe('ClassificationController', () => {
  it('scopes single transaction classification by workspaceId', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = {
      classifyTransaction: vi.fn(async () => ({ categoryId: 'cat-1' })),
    };
    const transaction = { id: 'tx-1', workspaceId: 'ws-1' };
    transactionRepository.findOne.mockResolvedValue(transaction);

    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    await controller.classifyTransaction({ id: 'tx-1' }, { id: 'u1' } as any, 'ws-1');

    expect(transactionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'tx-1', workspaceId: 'ws-1' },
    });
  });

  it('answers the stored row, not the one a classification left undefined keys on', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = {
      classifyTransaction: vi.fn(async () => ({ categoryId: 'cat-1', branchId: undefined })),
    };
    const transaction = { id: 'tx-1', workspaceId: 'ws-1', branchId: null };
    const stored = { id: 'tx-1', workspaceId: 'ws-1', categoryId: 'cat-1', branchId: null };
    transactionRepository.findOne.mockResolvedValue(transaction);
    transactionRepository.findOneOrFail.mockResolvedValue(stored);
    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    const result = await controller.classifyTransaction({ id: 'tx-1' }, { id: 'u1' } as any, 'ws-1');

    expect(transactionRepository.findOneOrFail).toHaveBeenCalledWith({
      where: { id: 'tx-1', workspaceId: 'ws-1' },
    });
    expect(result).toEqual(stored);
  });

  it('leaves a hand-picked category alone when one row is re-classified', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = { classifyTransaction: vi.fn() };
    const transaction = { id: 'tx-1', workspaceId: 'ws-1', categorySource: 'manual' };
    transactionRepository.findOne.mockResolvedValue(transaction);
    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    const result = await controller.classifyTransaction({ id: 'tx-1' }, { id: 'u1' } as any, 'ws-1');

    expect(result).toBe(transaction);
    expect(classificationService.classifyTransaction).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('scopes bulk classification by workspaceId', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = {
      classifyTransaction: vi.fn(async () => ({ categoryId: 'cat-1' })),
    };
    transactionRepository.findOne.mockResolvedValue({ id: 'tx-1', workspaceId: 'ws-1' });
    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    await controller.classifyBulk({ transactionIds: ['tx-1'] }, { id: 'u1' } as any, 'ws-1');

    expect(transactionRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: 'tx-1', workspaceId: 'ws-1' },
    });
    expect(classificationService.classifyTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-1' }),
      'u1',
      null,
    );
  });

  it('leaves a hand-picked category alone during bulk re-classification', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = { classifyTransaction: vi.fn() };
    transactionRepository.findOne.mockResolvedValue({
      id: 'tx-1',
      workspaceId: 'ws-1',
      categorySource: 'manual',
    });
    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    const result = await controller.classifyBulk(
      { transactionIds: ['tx-1'] },
      { id: 'u1' } as any,
      'ws-1',
    );

    expect(result).toMatchObject({ total: 1, successful: 0, keptManual: 1 });
    expect(classificationService.classifyTransaction).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });
});
