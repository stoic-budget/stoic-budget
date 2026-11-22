'use client';

import { Box, Button } from '@mui/material';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ArrowsLineIcon } from '@/app/components/ui/empty-state-icons';
import { LoadError } from '@/app/components/ui/load-error';
import { PageTitle } from '@/app/components/ui/page-title';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import type { RuleGroup } from '@/app/lib/contracts';
import { RuleFolderDeleteDialog, RuleFolderDialog } from './RuleFolderDialog';
import { RulePackExportDialog } from './RulePackExportDialog';
import { RulePackImportButton } from './RulePackImportButton';
import { RuleSuggestions } from './RuleSuggestions';
import { RulesSections } from './RulesSections';
import { RulesSkeleton } from './RulesSkeleton';
import { conditionRefs, type Rule } from './types';
import { useRuleApply } from './useRuleApply';
import { useMoveRuleToFolder, useRuleFolders } from './useRuleFolders';
import { useRuleNames } from './useRuleNames';
import { useExportRulePack } from './useRulePacks';
import {
  previewRule,
  useDeleteRule,
  useReorderRules,
  useRulesList,
  useToggleRule,
} from './useRules';

/**
 * The workspace's rules as a table, in the order they are tried, with the
 * rules worth adding above it. A rule opens on a page of its own; the old
 * `?focus=<id>` link goes there.
 */
export function RulesView() {
  const t = useIntlayer('categorizationRules');
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('category.edit');
  const canDelete = hasPermission('category.delete');
  const rules = useRulesList();
  const list = rules.data?.data ?? [];
  const payeeIds = [
    ...new Set(
      list.flatMap(rule => [
        ...(rule.result.payeeId ? [rule.result.payeeId] : []),
        ...conditionRefs(rule.conditions, 'payee'),
      ]),
    ),
  ];
  const { words, names } = useRuleNames(payeeIds);
  const toggle = useToggleRule();
  const remove = useDeleteRule();
  const reorder = useReorderRules();
  const applying = useRuleApply(names.wallet);
  const focusId = useSearchParams().get('focus');
  const folderWords = useIntlayer('ruleFolders');
  const packWords = useIntlayer('rulePacks');
  const folders = useRuleFolders().data ?? [];
  const move = useMoveRuleToFolder();
  const exportPack = useExportRulePack();
  // A folder being named (`null`: a new one), one being deleted, the export picker.
  const [naming, setNaming] = useState<RuleGroup | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<RuleGroup | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (focusId) {
      router.replace(`/rules/${focusId}`);
    }
  }, [focusId, router]);

  const handleDelete = (rule: Rule) =>
    void remove.mutateAsync(rule.id).then(
      () => toast.success(t.toast.deleted.value),
      () => toast.error(t.toast.deleteFailed.value),
    );

  // A rule that names an account moves rows between accounts: it says how many and asks.
  const handleApply = async (rule: Rule) => {
    const { walletId } = rule.result;
    const moving = walletId
      ? await previewRule({
          conditions: rule.conditions,
          matchMode: rule.matchMode,
          ruleId: rule.id,
          walletId,
        }).then(
          preview => preview.movable,
          () => 0,
        )
      : 0;
    if (moving > 0) {
      applying.offer(rule, applying.moveQuestion(rule, moving));
    } else {
      applying.run(rule);
    }
  };

  const handleReorder = (next: Rule[]) =>
    void reorder.mutateAsync(next).catch(() => toast.error(t.toast.orderFailed.value));

  const handleMove = (rule: Rule, groupId: string | null) =>
    void move
      .mutateAsync({ ruleId: rule.id, groupId })
      .catch(() => toast.error(folderWords.moveFailed.value));

  const handleExport = (rules: Rule[]) =>
    void exportPack
      .mutateAsync(rules.map(rule => rule.id))
      .catch(() => toast.error(packWords.exportFailed.value));

  const newRuleButton = (
    <Button component={NextLink} href="/rules/new" variant="contained">
      {t.page.newRule}
    </Button>
  );

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          mb: 1,
        }}
      >
        <PageTitle path="/rules" />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
          {canEdit && list.length > 0 && (
            <Button variant="outlined" onClick={() => setNaming(null)}>
              {folderWords.newFolder}
            </Button>
          )}
          {canEdit && <RulePackImportButton />}
          {list.length > 0 && (
            <Button variant="outlined" onClick={() => setExporting(true)}>
              {packWords.export}
            </Button>
          )}
          {canEdit && list.length > 0 && newRuleButton}
        </Box>
      </Box>
      <p className="seneca-rules__intro">{t.page.intro}</p>

      {canEdit && <RuleSuggestions categoryName={names.category} />}

      {rules.isError && <LoadError>{t.page.loadError}</LoadError>}

      {rules.isPending && <RulesSkeleton canEdit={canEdit} />}

      {rules.isSuccess && list.length === 0 && (
        <EmptyState
          fill
          icon={<ArrowsLineIcon />}
          title={t.page.emptyTitle}
          description={t.page.emptyHint}
          action={canEdit ? newRuleButton : undefined}
        />
      )}

      {list.length > 0 && (
        <>
          <p className="seneca-rules__order-hint">
            {canEdit ? t.page.orderHint : t.page.orderHintReadOnly}
          </p>
          {folders.length > 0 && <p className="seneca-rules__order-hint">{folderWords.hint}</p>}
          <RulesSections
            rules={list}
            folders={folders}
            onMove={handleMove}
            onRenameFolder={setNaming}
            onDeleteFolder={setDeleting}
            onExportRules={handleExport}
            words={words}
            names={names}
            canEdit={canEdit}
            canDelete={canDelete}
            onReorder={handleReorder}
            onToggle={(rule, isActive) => void toggle.mutateAsync({ id: rule.id, isActive })}
            onApply={rule => void handleApply(rule)}
            onDelete={handleDelete}
            onEdit={rule => router.push(`/rules/${rule.id}`)}
          />
        </>
      )}
      {naming !== undefined && (
        <RuleFolderDialog folder={naming} onClose={() => setNaming(undefined)} />
      )}
      {deleting && <RuleFolderDeleteDialog folder={deleting} onClose={() => setDeleting(null)} />}
      {exporting && (
        <RulePackExportDialog rules={list} folders={folders} onClose={() => setExporting(false)} />
      )}
    </Box>
  );
}
