'use client';

import Tooltip from '@mui/material/Tooltip';
import type React from 'react';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from '@/app/components/icons';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { readPluginSwitch } from '@/app/plugins/hooks/usePluginState';
import { usePlugins } from '@/app/plugins/hooks/usePlugins';
import { useScrollEdges } from '../hooks/useScrollEdges';

function Arrow({
  direction,
  label,
  disabled,
  onPage,
}: {
  direction: 1 | -1;
  label: string;
  disabled: boolean;
  onPage: (direction: 1 | -1) => void;
}): React.JSX.Element {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      className="seneca-plugin-shortcuts__arrow"
      aria-label={label}
      disabled={disabled}
      onClick={() => onPage(direction)}
    >
      <Icon size={16} />
    </button>
  );
}

/**
 * One icon per switched-on plugin, top right of the dashboard. Up to seven show
 * at once; more, or a narrow screen, scroll: swipe on a phone, or the small
 * arrows that appear only when something is hidden.
 */
export function PluginShortcuts(): React.JSX.Element | null {
  const { currentWorkspace } = useWorkspace();
  const t = useIntlayer('pluginsPage');
  const plugins = usePlugins();
  const trackRef = useRef<HTMLDivElement>(null);
  // Wait for the workspace, so a switched-off plugin never flashes in.
  const enabled = currentWorkspace
    ? plugins.filter(plugin => readPluginSwitch(currentWorkspace.settings, plugin.key))
    : [];
  const { overflows, canBack, canForward, page } = useScrollEdges(trackRef, enabled.length);

  if (enabled.length === 0) {
    return null;
  }

  return (
    <nav className="seneca-plugin-shortcuts" aria-label={t.title.value}>
      {overflows ? (
        <Arrow direction={-1} label={t.shortcutsBack.value} disabled={!canBack} onPage={page} />
      ) : null}
      <div ref={trackRef} className="seneca-plugin-shortcuts__track">
        {enabled.map(plugin => (
          <Tooltip key={plugin.key} title={plugin.name}>
            <button
              type="button"
              className="seneca-plugin-shortcuts__item"
              aria-label={plugin.name}
              onClick={() => openAppPanel('plugins', plugin.key)}
            >
              {plugin.icon}
            </button>
          </Tooltip>
        ))}
      </div>
      {overflows ? (
        <Arrow direction={1} label={t.shortcutsMore.value} disabled={!canForward} onPage={page} />
      ) : null}
    </nav>
  );
}
