'use client';

import { IconButton } from '@mui/material';
import { MoreHorizontal } from '@/app/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { useIntlayer } from '@/app/i18n';
import type { Rule } from './types';

interface RuleRowMenuProps {
  rule: Rule;
  onEdit?: () => void;
  onApply?: () => void;
  onDelete?: () => void;
  /** Where the rule can be moved: into another folder, or out of its own. */
  moves?: Array<{ key: string; label: string; onSelect: () => void }>;
}

/** A rule row's actions; each one appears only when the member may do it. */
export function RuleRowMenu({ rule, onEdit, onApply, onDelete, moves = [] }: RuleRowMenuProps) {
  const t = useIntlayer('categorizationRules');
  // MUI Menu walks its children for focus; a Fragment hides them, so give it an array.
  const items = [
    onEdit && (
      <DropdownMenuItem key="edit" onClick={onEdit}>
        {t.page.edit}
      </DropdownMenuItem>
    ),
    onApply && (
      <DropdownMenuItem key="apply" onClick={onApply}>
        {t.page.applyNow}
      </DropdownMenuItem>
    ),
    ...moves.map(move => (
      <DropdownMenuItem key={`move-${move.key}`} onClick={move.onSelect}>
        {move.label}
      </DropdownMenuItem>
    )),
    onDelete && (
      <DropdownMenuItem key="delete" onClick={onDelete}>
        {t.page.delete}
      </DropdownMenuItem>
    ),
  ].filter(Boolean);
  if (items.length === 0) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton size="small" aria-label={`${t.page.actions.value}: ${rule.name}`}>
          <MoreHorizontal size={18} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}
