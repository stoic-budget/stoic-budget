'use client';

import type React from 'react';
import { cloneElement } from 'react';
import { useReadOnlyWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIsDemo } from '@/app/hooks/useDemoStatus';
import { useIntlayer } from '@/app/i18n';

/**
 * Wraps a button that changes data: inside a past version or on a demo
 * server it is disabled and says why on hover. The span carries the title,
 * since a disabled MUI button takes no pointer events.
 */
export function ReadOnlyHint({
  children,
}: {
  children: React.ReactElement<{ disabled?: boolean }>;
}): React.JSX.Element {
  const { isReadOnly } = useReadOnlyWorkspace();
  const isDemo = useIsDemo();
  const t = useIntlayer('versionBanner');
  const demo = useIntlayer('demoBanner');
  if (!(isReadOnly || isDemo)) {
    return children;
  }
  return (
    <span
      title={(isDemo ? demo.readOnlyHint : t.readOnlyHint).value}
      style={{ display: 'inline-flex' }}
    >
      {cloneElement(children, { disabled: true })}
    </span>
  );
}
