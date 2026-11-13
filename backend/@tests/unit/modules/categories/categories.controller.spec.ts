import { CategoryType } from '@/entities/category.entity';
import { CategoriesController } from '@/modules/categories/categories.controller';

describe('CategoriesController', () => {
  it('proxies calls to CategoriesService', async () => {
    const categoriesService = {
      create: vi.fn(async () => ({ id: 'c1' })),
      findAll: vi.fn(async () => [{ id: 'c1' }]),
      getCategoryUsageCount: vi.fn(async () => ({ transactions: 1, statements: 2, total: 3 })),
      findOne: vi.fn(async () => ({ id: 'c1' })),
      update: vi.fn(async () => ({ id: 'c1', name: 'X' })),
      remove: vi.fn(async () => undefined),
    };
    const summaryService = { summary: vi.fn(async () => ({ thisMonth: 5 })) };
    const controller = new CategoriesController(categoriesService as any, summaryService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'w1';

    expect(
      await controller.create({ name: 'A', type: CategoryType.EXPENSE } as any, user, workspaceId),
    ).toEqual({ id: 'c1' });
    expect(await controller.findAll(user, workspaceId, { type: 'expense' })).toEqual([
      { id: 'c1' },
    ]);
    expect(await controller.getUsageCount({ id: 'c1' }, workspaceId)).toEqual({
      transactions: 1,
      statements: 2,
      total: 3,
    });
    expect(await controller.findOne({ id: 'c1' }, user, workspaceId)).toEqual({ id: 'c1' });
    expect(await controller.update({ id: 'c1' }, { name: 'X' } as any, user, workspaceId)).toEqual({
      id: 'c1',
    }); // read back as stored, not the saved entity
    expect(await controller.summary({ id: 'c1' }, {}, workspaceId, 'm1')).toEqual({
      thisMonth: 5,
    });
    expect(summaryService.summary).toHaveBeenCalledWith(workspaceId, 'c1', 'm1', false);
    await controller.summary({ id: 'c1' }, { netRefunds: true }, workspaceId, 'm1');
    expect(summaryService.summary).toHaveBeenLastCalledWith(workspaceId, 'c1', 'm1', true);
    expect(await controller.remove({ id: 'c1' }, user, workspaceId)).toEqual({
      message: 'Category deleted successfully',
    });
  });
});
