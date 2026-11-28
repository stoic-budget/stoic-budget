'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  closeAppPanel,
  closeAppPanelItem,
  openAppPanelItem,
  useAppPanelState,
} from '@/app/components/panels/app-panels-store';
import {
  PanelSearchField,
  PanelSectionLabel,
  PanelStatusDot,
} from '@/app/components/panels/panel-ui';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { IntegrationDetailDrawer } from '@/app/integrations/panel/IntegrationDetailDrawer';
import {
  findIntegrationEntry,
  type IntegrationCategoryKey,
  type IntegrationEntry,
  useIntegrationCatalog,
} from '@/app/integrations/panel/integration-catalog';
import { AiAssistantDrawer } from '../ai-assistant/AiAssistantDrawer';
import { PluginOffBanner } from '../components/PluginOffBanner';
import { useIntegrationStatuses } from '../hooks/useIntegrationStatuses';
import { usePluginState } from '../hooks/usePluginState';
import { type PluginItem, usePlugins } from '../hooks/usePlugins';
import { McpServerDrawer } from '../mcp-server/McpServerDrawer';
import { WebhooksDrawer } from '../webhooks/WebhooksDrawer';
import { PluginRow } from './PluginRow';

const CATEGORY_ORDER: IntegrationCategoryKey[] = ['email', 'bank', 'messaging'];

const matches = (query: string, text: string): boolean =>
  !query || text.toLowerCase().includes(query);

/** Plugins first, then the integrations by kind, all with one switch each and one search. */
export function PluginsPanel(): React.JSX.Element {
  const { panel, item } = useAppPanelState();
  const open = panel === 'plugins';
  const plugins = usePlugins();
  const catalog = useIntegrationCatalog();
  const { statuses, refresh } = useIntegrationStatuses(open);
  const { isEnabled, setEnabled, canToggle, pending } = usePluginState();
  const t = useIntlayer('pluginsPage');
  const it = useIntlayer('integrationsPage');
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const shownPlugins = plugins.filter(plugin => matches(query, plugin.name));
  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map(category => ({
        category,
        entries: catalog.filter(
          entry =>
            entry.category === category && matches(query, `${entry.name} ${entry.description}`),
        ),
      })).filter(group => group.entries.length > 0),
    [catalog, query],
  );
  const entry = open ? findIntegrationEntry(catalog, item) : undefined;

  const pluginRow = (plugin: PluginItem): React.JSX.Element => {
    const active = isEnabled(plugin.key);
    return (
      <PluginRow
        key={plugin.key}
        name={plugin.name}
        description={plugin.description}
        icon={plugin.icon}
        active={active}
        // The assistant has nothing to configure while off; the others open to set up first.
        openable={plugin.configurable && (active || plugin.key !== 'ai-assistant')}
        canToggle={canToggle}
        pending={pending === plugin.key}
        onToggle={enabled => void setEnabled(plugin.key, enabled)}
        onOpen={() => openAppPanelItem(plugin.key)}
      />
    );
  };

  const integrationRow = (integration: IntegrationEntry): React.JSX.Element => (
    <PluginRow
      key={integration.key}
      name={integration.name}
      description={integration.description}
      icon={integration.icon}
      active={isEnabled(integration.key)}
      // A paused integration still opens: its settings can be read and removed.
      openable
      status={
        integration.statusPath ? (
          <PanelStatusDot
            connected={Boolean(statuses[integration.key])}
            label={statuses[integration.key] ? it.sections.connected.value : it.setUp.value}
          />
        ) : null
      }
      canToggle={canToggle}
      pending={pending === integration.key}
      onToggle={enabled => void setEnabled(integration.key, enabled)}
      onOpen={() => openAppPanelItem(integration.key)}
      dataAttributes={{
        'data-integration-card': integration.key,
        'data-tour-id': `integration-card-${integration.key}`,
      }}
    />
  );

  return (
    <>
      <DrawerShell
        isOpen={open}
        onClose={closeAppPanel}
        position="right"
        width="md"
        title={t.title}
        zIndex={1300}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.subtitle}</Typography>
          <PanelSearchField
            value={search}
            placeholder={t.searchPlaceholder.value}
            onChange={setSearch}
            tourId="plugins-search"
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {shownPlugins.length > 0 ? (
              <Box>
                <PanelSectionLabel>{t.title}</PanelSectionLabel>
                {shownPlugins.map(pluginRow)}
              </Box>
            ) : null}
            {groups.map(group => (
              <Box key={group.category}>
                <PanelSectionLabel>{it.categories[group.category]}</PanelSectionLabel>
                {group.entries.map(integrationRow)}
              </Box>
            ))}
            {shownPlugins.length === 0 && groups.length === 0 ? (
              <Typography
                sx={{ py: 4, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}
              >
                {it.nothingMatches.value.replace('{query}', search)}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </DrawerShell>

      <AiAssistantDrawer
        isOpen={open && item === 'ai-assistant' && isEnabled('ai-assistant')}
        onClose={closeAppPanel}
        onBack={closeAppPanelItem}
        zIndex={1400}
      />
      <WebhooksDrawer
        isOpen={open && item === 'webhooks'}
        onClose={closeAppPanel}
        onBack={closeAppPanelItem}
        zIndex={1400}
      />
      <McpServerDrawer
        isOpen={open && item === 'mcp-server'}
        onClose={closeAppPanel}
        onBack={closeAppPanelItem}
        zIndex={1400}
      />
      <IntegrationDetailDrawer
        entry={entry}
        banner={
          entry ? (
            <PluginOffBanner
              plugin={entry.key}
              message={t.offBanner.integration.value.replace('{name}', entry.name)}
            />
          ) : null
        }
        onBack={closeAppPanelItem}
        onClose={closeAppPanel}
        onConnectionChange={refresh}
      />
    </>
  );
}
