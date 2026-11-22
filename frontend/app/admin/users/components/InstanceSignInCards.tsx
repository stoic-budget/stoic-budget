'use client';

import type React from 'react';
import { McpClientRegistrationCard } from './McpClientRegistrationCard';
import { OidcSettingsCard } from './OidcSettingsCard';
import { RegistrationCard } from './RegistrationCard';

/** How people and apps get into this server: open sign-up, single sign-on, and MCP apps. */
export function InstanceSignInCards(): React.JSX.Element {
  return (
    <>
      <RegistrationCard />
      <OidcSettingsCard />
      <McpClientRegistrationCard />
    </>
  );
}
