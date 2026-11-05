import { Transaction, TransactionCategorySource } from '@/entities/transaction.entity';
import { writeClassification } from '@/modules/classification/engine/rule-row-write';

const WORKSPACE = 'workspace-1';
const saved = { id: 'tx-1', workspaceId: WORKSPACE };

function build() {
  const manager = { update: vi.fn(async () => undefined), query: vi.fn(async () => undefined) };
  return manager;
}

describe('writing a classification onto a saved row', () => {
  it('files the row and adds the tags of the rule, inside the workspace', async () => {
    const manager = build();

    await writeClassification(manager as never, saved, {
      categoryId: 'cat-electronics',
      categorySource: TransactionCategorySource.RULE,
      categoryReason: 'ACME is electronics',
      tags: [{ id: 'tag-gadgets' }] as never,
    });

    expect(manager.update).toHaveBeenCalledWith(
      Transaction,
      { id: 'tx-1', workspaceId: WORKSPACE },
      {
        categoryId: 'cat-electronics',
        categorySource: TransactionCategorySource.RULE,
        categoryReason: 'ACME is electronics',
      },
    );
    const [, params] = manager.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toEqual([WORKSPACE, ['tx-1'], ['tag-gadgets']]);
  });

  it('adds the tags of a rule that names no category, and leaves the category alone', async () => {
    const manager = build();

    await writeClassification(manager as never, saved, { tags: [{ id: 'tag-gadgets' }] as never });

    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the classifier had nothing to say', async () => {
    const manager = build();

    await writeClassification(manager as never, saved, {});

    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.query).not.toHaveBeenCalled();
  });
});
