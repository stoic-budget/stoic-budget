'use client';

import { IconButton } from '@mui/material';
import { ChevronDown, ChevronRight, MoreHorizontal } from '@/app/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { useIntlayer } from '@/app/i18n';
import type { RuleGroup } from '@/app/lib/contracts';
import { fill } from './rule-text';

/** A folder's line on the rules page: open or closed, its name and size, and its actions. */
export function RuleFolderHeader({
  folder,
  count,
  open,
  onToggle,
  onRename,
  onExport,
  onDelete,
}: {
  folder: RuleGroup;
  count: number;
  open: boolean;
  onToggle: () => void;
  onRename?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}) {
  const t = useIntlayer('ruleFolders');
  const packs = useIntlayer('rulePacks');
  const rules = useIntlayer('categorizationRules');
  const items = [
    onRename && (
      <DropdownMenuItem key="rename" onClick={onRename}>
        {t.rename}
      </DropdownMenuItem>
    ),
    onExport && (
      <DropdownMenuItem key="export" onClick={onExport}>
        {packs.export}
      </DropdownMenuItem>
    ),
    onDelete && (
      <DropdownMenuItem key="delete" onClick={onDelete}>
        {t.delete}
      </DropdownMenuItem>
    ),
  ].filter(Boolean);

  return (
    <div className="seneca-rule-folder__head">
      <button
        type="button"
        className="seneca-rule-folder__toggle"
        aria-expanded={open}
        aria-label={fill(t.toggle.value, { name: folder.name })}
        onClick={onToggle}
      >
        {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
        <span className="seneca-rule-folder__name">{folder.name}</span>
        <span className="seneca-rule-folder__count">{count}</span>
      </button>
      {items.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="small" aria-label={`${rules.page.actions.value}: ${folder.name}`}>
              <MoreHorizontal size={18} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{items}</DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
