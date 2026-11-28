'use client';

import Box from '@mui/material/Box';
import { visuallyHidden } from '@mui/utils';
import React, { type ComponentType, Suspense, startTransition, useEffect, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { useAuth } from '@/app/hooks/useAuth';
import { settingsSectionDomId } from '@/app/settings/profile/components/SettingsAccordion';
import {
  SettingsSkeleton,
  settingsTabSnapshotId,
} from '@/app/settings/profile/components/SettingsSkeleton';
import {
  SettingsTabs,
  type SettingsTabsLabels,
} from '@/app/settings/profile/components/SettingsTabs';
import {
  SETTINGS_TABS,
  type SettingsTabId,
} from '@/app/settings/profile/helpers/settings-url-state';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { useSettingsUrlState } from '@/app/settings/profile/hooks/useSettingsUrlState';
import { AdvancedTab } from '@/app/settings/profile/tabs/AdvancedTab';
import { DataTab } from '@/app/settings/profile/tabs/DataTab';
import { GeneralTab } from '@/app/settings/profile/tabs/GeneralTab';
import { NotificationsTab } from '@/app/settings/profile/tabs/NotificationsTab';
import { SecurityTab } from '@/app/settings/profile/tabs/SecurityTab';
import { SyncTab } from '@/app/settings/profile/tabs/SyncTab';
import type { SettingsTabProps } from '@/app/settings/profile/tabs/types';
import { VersionsTab } from '@/app/settings/profile/tabs/VersionsTab';

const TAB_COMPONENT: Record<SettingsTabId, ComponentType<SettingsTabProps>> = {
  general: GeneralTab,
  security: SecurityTab,
  notifications: NotificationsTab,
  data: DataTab,
  sync: SyncTab,
  advanced: AdvancedTab,
  versions: VersionsTab,
};

/**
 * Tabs that stay mounted. Each tab loads its own data on mount, so rendering
 * only the active one refetched and re-laid-out on every switch — the lag users
 * saw. The open tab mounts first; the rest mount once the browser is idle, and
 * from then on a switch only toggles `hidden`.
 *
 * The rest mount one per idle moment, each as a transition: React renders it in
 * slices and handles a click between them. Mounting them all in one update froze
 * the page for seconds (hundreds of sessions and the whole changelog at once).
 */
function useMountedTabs({
  activeTab,
  ready,
}: {
  activeTab: SettingsTabId;
  ready: boolean;
}): ReadonlySet<SettingsTabId> {
  const [mounted, setMounted] = useState<ReadonlySet<SettingsTabId>>(() => new Set([activeTab]));

  useEffect(() => {
    setMounted(prev => (prev.has(activeTab) ? prev : new Set([...prev, activeTab])));
  }, [activeTab]);

  useEffect(() => {
    if (!ready) return;
    const idle = typeof window.requestIdleCallback === 'function';
    const later = (run: () => void): number =>
      idle ? window.requestIdleCallback(run, { timeout: 2000 }) : window.setTimeout(run, 300);
    const queue = [...SETTINGS_TABS];
    let handle = 0;
    const mountNext = (): void => {
      const tab = queue.shift();
      if (!tab) return;
      startTransition(() => setMounted(prev => (prev.has(tab) ? prev : new Set([...prev, tab]))));
      handle = later(mountNext);
    };
    handle = later(mountNext);
    return () => (idle ? window.cancelIdleCallback(handle) : window.clearTimeout(handle));
  }, [ready]);

  return mounted;
}

function ProfileSettingsPageInner(): React.JSX.Element {
  const { user, loading, setUser, logout } = useAuth();
  const { t, tx } = useSettingsText();
  const { activeTab, section, setActiveTab } = useSettingsUrlState();
  const mountedTabs = useMountedTabs({ activeTab, ready: Boolean(user) });

  // A deep link names a panel further down the tab; bring it into view once it exists.
  useEffect(() => {
    if (!section || loading || !user) return;
    document
      .getElementById(settingsSectionDomId(section))
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [section, loading, user]);

  if (loading) {
    return <SettingsSkeleton activeTab={activeTab} />;
  }

  if (!user) {
    return (
      <Box className="container-shared" sx={{ px: { xs: 2, md: 4 }, py: 5 }}>
        <Alert style={{ maxWidth: 576 }} variant="default">
          {t.authRequired.value}
        </Alert>
      </Box>
    );
  }

  const labels: SettingsTabsLabels = {
    general: tx(['tabs', 'general']),
    security: tx(['tabs', 'security']),
    notifications: tx(['tabs', 'notifications']),
    data: tx(['tabs', 'data']),
    sync: tx(['tabs', 'sync']),
    advanced: tx(['tabs', 'advanced']),
    versions: tx(['tabs', 'versions']),
  };

  return (
    <Box
      className="container-shared"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 32px)', pb: 4 }}
    >
      <Box>
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} labels={labels} />
        {/* The selected tab already names the section on screen; the heading stays
            for screen readers only. */}
        <h1 style={visuallyHidden}>{labels[activeTab]}</h1>
        {SETTINGS_TABS.filter(tab => tab === activeTab || mountedTabs.has(tab)).map(tab => {
          const TabContent = TAB_COMPONENT[tab];
          return (
            <div key={tab} hidden={tab !== activeTab}>
              <SnapshotSkeleton
                id={settingsTabSnapshotId(tab)}
                loading={false}
                capture={tab === activeTab}
              >
                <TabContent
                  section={tab === activeTab ? section : null}
                  user={user}
                  setUser={setUser}
                  logout={logout}
                />
              </SnapshotSkeleton>
            </div>
          );
        })}
      </Box>
    </Box>
  );
}

/** `useSearchParams` needs a Suspense boundary so the static shell can prerender. */
export default function ProfileSettingsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <ProfileSettingsPageInner />
    </Suspense>
  );
}
