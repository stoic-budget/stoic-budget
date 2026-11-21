import type { NavItem } from '@/app/components/navigation/helpers/navigation-config';

/**
 * Menu entries a paid edition adds after the core ones. The open-source build
 * has none; a paid build copies its own version of this file over this one.
 * `nav` is the whole navigation dictionary, so an entry can take its label
 * from there.
 */
export function extensionNavItems(_nav: object): NavItem[] {
  return [];
}
