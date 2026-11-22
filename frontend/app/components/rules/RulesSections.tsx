'use client';

import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { RuleGroup } from '@/app/lib/contracts';
import { RuleFolderHeader } from './RuleFolderHeader';
import { type RuleRowActions, RulesTable } from './RulesTable';
import { sectionsOf, withPartReordered } from './rule-folders';
import type { RuleNames, RuleWords } from './rule-text';
import type { Rule } from './types';

interface RulesSectionsProps extends Omit<RuleRowActions, 'folders'> {
  rules: Rule[];
  folders: RuleGroup[];
  words: RuleWords;
  names: RuleNames;
  /** The whole list in its new order, first one on top. */
  onReorder: (rules: Rule[]) => void;
  onRenameFolder: (folder: RuleGroup) => void;
  onDeleteFolder: (folder: RuleGroup) => void;
  onExportRules: (rules: Rule[]) => void;
}

/**
 * The rules, folder by folder: rules in no folder first, then each folder as
 * a section that opens and closes. Dragging within a section moves the rule
 * in the one global order (folders never change which rule wins). Without
 * folders the list is the plain table it always was.
 */
export function RulesSections({
  rules,
  folders,
  onReorder,
  onRenameFolder,
  onDeleteFolder,
  onExportRules,
  ...rest
}: RulesSectionsProps) {
  const t = useIntlayer('ruleFolders');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const table = (part: Rule[]) => (
    <RulesTable
      {...rest}
      rules={part}
      folders={folders}
      onReorder={next => onReorder(withPartReordered(rules, next))}
    />
  );

  if (folders.length === 0) {
    return table(rules);
  }
  const toggle = (id: string) =>
    setClosed(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="seneca-rule-folders">
      {sectionsOf(rules, folders).map(({ folder, rules: part }) => {
        if (!folder) {
          return part.length > 0 ? (
            <section key="unfiled" className="seneca-rule-folder">
              <h2 className="seneca-rule-folder__unfiled">{t.unfiled}</h2>
              {table(part)}
            </section>
          ) : null;
        }
        const open = !closed.has(folder.id);
        return (
          <section key={folder.id} className="seneca-rule-folder">
            <RuleFolderHeader
              folder={folder}
              count={part.length}
              open={open}
              onToggle={() => toggle(folder.id)}
              onRename={rest.canEdit ? () => onRenameFolder(folder) : undefined}
              onExport={part.length > 0 ? () => onExportRules(part) : undefined}
              onDelete={rest.canEdit ? () => onDeleteFolder(folder) : undefined}
            />
            {open &&
              (part.length > 0 ? (
                table(part)
              ) : (
                <p className="seneca-rule-folder__empty">{t.empty}</p>
              ))}
          </section>
        );
      })}
    </div>
  );
}
