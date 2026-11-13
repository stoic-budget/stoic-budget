'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { ChevronDown } from '@/app/components/icons';
import { TagDrawer } from '@/app/components/tags/TagDrawer';
import { useBulkAnnotate } from '@/app/components/transactions/hooks/useBulkAnnotate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { useIntlayer } from '@/app/i18n';
import type { CategoryList, StorageTag } from '@/app/lib/contracts';
import { BulkCommentDrawer } from './BulkCommentDrawer';

type Picking = 'category' | 'tags' | 'comment' | null;

/**
 * What can be done to the ticked rows: a category, tags, a comment. Each opens
 * the drawer the app already uses for it. On a phone the two additive actions
 * fold into a "More" menu, so the bar stays one line.
 */
export function BulkActionsBar({
  selected,
  categories,
  onSetCategory,
  onDone,
}: {
  selected: ReadonlySet<string>;
  categories: CategoryList;
  onSetCategory: (ids: string[], categoryId: string) => void;
  /** Called after tags or a comment were saved: the selection has done its job. */
  onDone: () => void;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsPage');
  const tBulk = useIntlayer('allTransactionsBulk');
  const annotate = useBulkAnnotate();
  const [picking, setPicking] = useState<Picking>(null);
  const [tags, setTags] = useState<StorageTag[]>([]);
  const close = () => setPicking(null);

  const addTags = async (): Promise<void> => {
    try {
      await annotate.mutateAsync({ txIds: [...selected], tagIds: tags.map(tag => tag.id) });
      toast.success(tBulk.tagsAdded.value);
      setTags([]);
      close();
      onDone();
    } catch {
      toast.error(tBulk.tagsFailed.value);
    }
  };

  const addComment = async (note: string): Promise<boolean> => {
    try {
      const result = await annotate.mutateAsync({ txIds: [...selected], note });
      toast.success(tBulk.commentAdded.value);
      if (result.skippedPrivate > 0) {
        toast(tBulk.skippedPrivate.value.replace('{count}', String(result.skippedPrivate)));
      }
      if (result.skippedTooLong > 0) {
        toast(tBulk.skippedTooLong.value.replace('{count}', String(result.skippedTooLong)));
      }
      close();
      onDone();
      return true;
    } catch {
      toast.error(tBulk.commentFailed.value);
      return false;
    }
  };

  return (
    <>
      {selected.size > 0 ? (
        <div className="seneca-all-tx__bulk" role="status">
          <span>{t.selected.value.replace('{count}', String(selected.size))}</span>
          {/* The category drawer every other place uses, not a menu of its own. */}
          <button
            type="button"
            className="seneca-all-tx__menu-button"
            onClick={() => setPicking('category')}
          >
            {t.setCategory}
            <ChevronDown size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="seneca-all-tx__menu-button seneca-all-tx__bulk-wide"
            onClick={() => setPicking('tags')}
          >
            {tBulk.addTags}
            <ChevronDown size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="seneca-all-tx__menu-button seneca-all-tx__bulk-wide"
            onClick={() => setPicking('comment')}
          >
            {tBulk.addComment}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="seneca-all-tx__menu-button seneca-all-tx__bulk-narrow"
              >
                {tBulk.more}
                <ChevronDown size={16} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPicking('tags')}>
                {tBulk.addTags}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPicking('comment')}>
                {tBulk.addComment}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      <StatementCategoryDrawer
        open={picking === 'category'}
        onClose={close}
        categories={categories}
        selectedCategoryId=""
        onSelect={categoryId => {
          close();
          if (categoryId) {
            onSetCategory([...selected], categoryId);
          }
        }}
      />
      <TagDrawer
        open={picking === 'tags'}
        onClose={close}
        value={tags}
        onChange={setTags}
        disabled={annotate.isPending}
        confirm={{ label: tBulk.addToSelected.value, onConfirm: () => void addTags() }}
      />
      <BulkCommentDrawer
        open={picking === 'comment'}
        onClose={close}
        onSubmit={addComment}
        saving={annotate.isPending}
      />
    </>
  );
}
