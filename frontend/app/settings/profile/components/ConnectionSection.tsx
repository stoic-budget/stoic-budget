'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import type { ComponentType } from 'react';
import { ExternalLink } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { ProtocolIntegrationPage } from '@/app/integrations/open-protocol-page';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import {
  type SettingsConnectionKey,
  useConnectionConfigs,
} from '@/app/settings/profile/helpers/connection-configs';

/** One connection form (app address, S3, WebDAV) as a settings panel. */
export function ConnectionSection({
  connection,
  icon,
  defaultExpanded,
}: {
  connection: SettingsConnectionKey;
  icon: ComponentType<{ size?: number }>;
  defaultExpanded: boolean;
}): React.JSX.Element {
  const config = useConnectionConfigs()[connection];
  const t = useIntlayer('integrationsPage');
  const { summary, docsUrl, ...form } = config;

  return (
    <SettingsAccordion
      id={connection}
      title={config.title}
      description={summary}
      icon={icon}
      defaultExpanded={defaultExpanded}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ProtocolIntegrationPage {...form} embedded />
        {docsUrl ? (
          <Box
            component="a"
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              alignSelf: 'flex-start',
              fontSize: 13,
              fontWeight: 500,
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { color: 'text.primary' },
            }}
          >
            {t.docs.value}
            <ExternalLink size={14} />
          </Box>
        ) : null}
      </Box>
    </SettingsAccordion>
  );
}
