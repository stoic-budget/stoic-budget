'use client';

import type React from 'react';
import { useSystemHealth } from '@/app/hooks/useSystemHealth';
import { useIntlayer } from '@/app/i18n';
import type { SystemHealthLevel } from '@/app/lib/contracts';
import { useParserHealth } from '../hooks/useParserHealth';
import { parserHealthLevel } from '../lib/admin-summary';
import { AdminGroup, AdminLinkRow } from './AdminGroup';

/**
 * The server's two health pages as rows, each with its state in a word, so the
 * administrator sees at a glance whether either needs opening. Until a check
 * answers, the row shows its name alone; a check that failed says so.
 */
export function AdminStatusRows(): React.JSX.Element {
  const parsing = useIntlayer('adminParsingPage');
  const health = useIntlayer('adminHealthPage');
  const parser = useParserHealth();
  const system = useSystemHealth();
  // A failed statement is worth a look, not the server "not working": that word stays for outages.
  // A check that could not be asked is "unknown", never the last answer passed off as current.
  const parserLevel: SystemHealthLevel | undefined = parser.isError
    ? 'unknown'
    : parser.health
      ? parserHealthLevel(parser.health) === 'ok'
        ? 'ok'
        : 'warning'
      : undefined;
  const systemLevel: SystemHealthLevel | undefined = system.unanswered
    ? 'error'
    : system.isError
      ? 'unknown'
      : system.health?.level;

  return (
    <AdminGroup>
      <AdminLinkRow
        href="/admin/parsing"
        label={parsing.title}
        level={parserLevel}
        status={parserLevel ? health.levels[parserLevel] : undefined}
      />
      <AdminLinkRow
        href="/admin/health"
        label={health.title}
        level={systemLevel}
        status={systemLevel ? health.levels[systemLevel] : undefined}
      />
    </AdminGroup>
  );
}
