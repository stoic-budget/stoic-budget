import type { ReactNode } from 'react';

/** Under a field: the error while what is typed cannot be saved, else the usual hint. */
export function fieldHint(invalid: boolean, error: ReactNode, hint?: ReactNode): ReactNode {
  return invalid ? (
    <span role="alert" style={{ color: 'var(--money-down)' }}>
      {error}
    </span>
  ) : (
    hint
  );
}
