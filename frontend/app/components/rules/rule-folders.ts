import type { RuleGroup } from '@/app/lib/contracts';
import type { Rule } from './types';

/** A part of the rules page: a folder and its rules, or the rules in none (`folder: null`). */
export interface RuleSection {
  folder: RuleGroup | null;
  rules: Rule[];
}

/**
 * The rules split by folder, each part keeping the list's order (the order
 * they are tried in). Rules in no folder come first; a folder whose id no
 * folder has (deleted meanwhile) counts as none. Empty folders stay, so a new
 * one can be seen and filled.
 */
export function sectionsOf(rules: readonly Rule[], folders: readonly RuleGroup[]): RuleSection[] {
  const known = new Set(folders.map(folder => folder.id));
  const inFolder = (rule: Rule) => (rule.groupId && known.has(rule.groupId) ? rule.groupId : null);
  return [
    { folder: null, rules: rules.filter(rule => inFolder(rule) === null) },
    ...folders.map(folder => ({
      folder,
      rules: rules.filter(rule => inFolder(rule) === folder.id),
    })),
  ];
}

/**
 * The whole list after one part was reordered: the part's rules take the
 * places they held among all rules, in their new order, and every other rule
 * keeps its place. Folders never change which rule wins; only this order does.
 */
export function withPartReordered(all: readonly Rule[], part: readonly Rule[]): Rule[] {
  const ids = new Set(part.map(rule => rule.id));
  const next = [...part];
  return all.map(rule => (ids.has(rule.id) ? (next.shift() as Rule) : rule));
}
