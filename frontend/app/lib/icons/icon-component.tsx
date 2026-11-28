'use client';

import type { LucideIcon, LucideProps } from '@/app/components/icons';
import { type IconNode, lineIcon, Tag } from '../category-line-icons';
import { useIconNode } from './icon-catalog';
import { BUNDLED_ICONS } from './icon-value';

const Blank = lineIcon([], 'BlankIcon');
const drawnByName = new Map<string, LucideIcon>();
const lazyByName = new Map<string, LucideIcon>();

function drawn(name: string, node: IconNode): LucideIcon {
  let Icon = drawnByName.get(name);
  if (!Icon) {
    Icon = lineIcon(node, name);
    drawnByName.set(name, Icon);
  }
  return Icon;
}

function catalogIcon(name: string): LucideIcon {
  // biome-ignore lint/correctness/noComponentHookFactories: made once per icon name and cached in lazyByName, so React always sees the same component.
  function CatalogIcon(props: LucideProps): React.JSX.Element {
    const node = useIconNode(name);
    // Same box while the catalogue loads, so nothing shifts when it arrives.
    const Icon = node === undefined ? Blank : node === null ? Tag : drawn(name, node);
    return <Icon {...props} />;
  }
  CatalogIcon.displayName = `CatalogIcon(${name})`;
  return CatalogIcon;
}

/**
 * The component for a Lucide icon by name: the bundled drawing when the app
 * ships one, otherwise one that draws from the catalogue once it is loaded.
 * One component per name, so React keeps its state between renders.
 */
export function iconComponentFor(name: string): LucideIcon {
  const bundled = BUNDLED_ICONS[name];
  if (bundled) {
    return bundled;
  }
  let Icon = lazyByName.get(name);
  if (!Icon) {
    Icon = catalogIcon(name);
    lazyByName.set(name, Icon);
  }
  return Icon;
}
