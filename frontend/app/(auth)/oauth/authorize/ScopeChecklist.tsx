'use client';

import { Box } from '@mui/material';
import { tokens } from '@/lib/theme-tokens';
import type { ConsentDecision } from './useOAuthConsent';

type Scope = ConsentDecision['scopes'][number];

const chipStyle = (on: boolean) => ({
  padding: '4px 10px',
  borderRadius: tokens.radius.full,
  border: '1px solid var(--border)',
  background: on ? 'var(--primary-fill)' : 'transparent',
  color: on ? 'var(--primary-foreground)' : 'var(--text-muted)',
  fontSize: 12,
  fontFamily: 'monospace',
  cursor: 'pointer',
});

/** One toggle per permission the role allows in the picked workspace. */
export function ScopeChecklist({
  available,
  checked,
  onChange,
}: {
  available: readonly Scope[];
  checked: readonly Scope[];
  onChange: (next: Scope[]) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
      {available.map(scope => {
        const on = checked.includes(scope);
        return (
          <button
            key={scope}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() =>
              onChange(on ? checked.filter(item => item !== scope) : [...checked, scope])
            }
            style={chipStyle(on)}
          >
            {scope}
          </button>
        );
      })}
    </Box>
  );
}
