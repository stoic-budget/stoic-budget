'use client';

import clsx from 'clsx';
import Link from 'next/link';
import type React from 'react';
import { buildNavItems } from '@/app/components/navigation/helpers/navigation-config';
import { useIntlayer } from '@/app/i18n';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';

/** A sidebar page's name, so a crumb reads as the row it links back to. */
export function useNavLabel(path: string | undefined): React.ReactNode {
  const { nav } = useIntlayer('navigation');
  if (!path) {
    return null;
  }
  return buildNavItems((nav ?? {}) as Parameters<typeof buildNavItems>[0]).find(
    item => item.path === path,
  )?.label;
}

/**
 * Where a page sits: Home / its sidebar page / the page itself. A page inside
 * another one (an account, a statement, the trash) names its sidebar page as
 * `parent`, so the trail leads back there; a sidebar page passes none.
 */
export function Breadcrumbs({
  parent,
  current,
  className,
}: {
  /** The sidebar path the page belongs to. */
  parent?: string;
  /** The page itself; may still be loading. */
  current: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  const { breadcrumbs } = useIntlayer('navigation');
  const parentLabel = useNavLabel(parent);
  return (
    <nav className={clsx('seneca-breadcrumbs', className)} aria-label={breadcrumbs?.label?.value}>
      <Link href={DEFAULT_APP_ROUTE}>{breadcrumbs?.home}</Link>
      {parent ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href={parent}>{parentLabel}</Link>
        </>
      ) : null}
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="seneca-breadcrumbs__current">
        {current}
      </span>
    </nav>
  );
}
