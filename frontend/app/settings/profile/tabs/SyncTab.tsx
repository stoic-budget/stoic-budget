'use client';

import Stack from '@mui/material/Stack';
import type React from 'react';
import { Cloud, Database, FolderOpen } from '@/app/components/icons';
import { ConnectionSection } from '@/app/settings/profile/components/ConnectionSection';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import { SyncSection } from '@/app/settings/profile/components/SyncSection';
import { resolveOpenSection } from '@/app/settings/profile/helpers/settings-url-state';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { useSync } from '@/app/settings/profile/hooks/useSync';

import type { SettingsTabProps } from './types';

/** Archive, backups and the file stores the workspace syncs with. */
export function SyncTab({ section }: SettingsTabProps): React.JSX.Element {
  const { tx } = useSettingsText();
  const openSection = resolveOpenSection('sync', section);
  const {
    bankStats,
    totalCount,
    statsLoading,
    downloading,
    errorMessage: syncError,
    handleExportZip,
  } = useSync();

  return (
    <Stack spacing={2}>
      <SettingsAccordion
        id="backup"
        title={tx(['syncCard', 'title'])}
        description={tx(['syncCard', 'description'])}
        icon={Cloud}
        defaultExpanded={openSection === 'backup'}
      >
        <SyncSection
          bankStats={bankStats}
          totalCount={totalCount}
          statsLoading={statsLoading}
          downloading={downloading}
          errorMessage={syncError}
          handleExportZip={handleExportZip}
        />
      </SettingsAccordion>

      <ConnectionSection
        connection="s3-compatible"
        icon={Database}
        defaultExpanded={openSection === 's3-compatible'}
      />
      <ConnectionSection
        connection="webdav"
        icon={FolderOpen}
        defaultExpanded={openSection === 'webdav'}
      />
    </Stack>
  );
}
