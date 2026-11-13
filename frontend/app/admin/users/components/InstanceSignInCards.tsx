'use client';

import type React from 'react';
import { OidcSettingsCard } from './OidcSettingsCard';
import { RegistrationCard } from './RegistrationCard';

/** How people get into this server: open sign-up, and single sign-on. */
export function InstanceSignInCards(): React.JSX.Element {
  return (
    <>
      <RegistrationCard />
      <OidcSettingsCard />
    </>
  );
}
