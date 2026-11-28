'use client';

import type React from 'react';
import { useSystemHealth } from '@/app/hooks/useSystemHealth';
import { useIntlayer } from '@/app/i18n';
import { useParserHealth } from '../hooks/useParserHealth';
import { parserHealthLevel } from '../lib/admin-summary';
import { AdminGroup, AdminLinkRow } from './AdminGroup';

/**
 * The server's two health pages as rows, each with its state in a word, so the
 * administrator sees at a glance whether either needs opening. Until a check
 * answers, the row shows its name alone.
 */
export function AdminStatusRows(): React.JSX.Element {
  const parsing = useIntlayer('adminParsingPage');
  const health = useIntlayer('adminHealthPage');
  const parser = useParserHealth();
  const system = useSystemHealth();
  // A failed statement is worth a look, not the server "not working": that word stays for outages.
  const parserLevel = parser.health
    ? parserHealthLevel(parser.health) === 'ok'
      ? 'ok'
      : 'warning'
    : undefined;
  const systemLevel = system.health?.level;

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
