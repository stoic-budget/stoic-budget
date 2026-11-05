'use client';

import { CircularProgress, Typography } from '@mui/material';
import NextLink from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { BrandLockup } from '@/app/components/BrandLockup';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { syncLocaleFromUser } from '@/app/lib/locale';
import { checkContract } from '@/app/lib/query-fn-schema';
import { AuthHero } from '../AuthHero';
import AuthLayout from '../AuthLayout';

type Failure = 'busy' | 'unavailable' | 'failed';

/** Starts a guest session once and opens the app; answers why it did not, if it did not. */
function useGuestDemo(): Failure | null {
  const [failure, setFailure] = useState<Failure | null>(null);
  // Every call creates an account: React's dev double effect must not make two.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    apiClient
      .post('/auth/demo')
      .then(response => checkContract('RegisterResponse', response.data, '/auth/demo'))
      .then(({ user }) => {
        localStorage.setItem('user', JSON.stringify(user));
        syncLocaleFromUser(user);
        if (user.workspaceId) {
          localStorage.setItem('currentWorkspaceId', user.workspaceId);
        }
        window.location.href = DEFAULT_APP_ROUTE;
      })
      .catch((error: unknown) => {
        const status = getApiErrorStatus(error);
        setFailure(
          status === 503 || status === 429 ? 'busy' : status === 404 ? 'unavailable' : 'failed',
        );
      });
  }, []);

  return failure;
}

/**
 * The landing page's "Try the demo" target: asks the server for a guest
 * account with a demo workspace, then opens the app signed in as that guest.
 */
export default function TryDemoPage(): React.JSX.Element {
  const t = useIntlayer('tryDemoPage');
  const tl = useIntlayer('loginPage');
  const failure = useGuestDemo();

  return (
    <AuthLayout
      sideContent={<AuthHero tagline={tl.rightTagline} />}
      topRightAction={<AuthLanguageSwitcher />}
    >
      <BrandLockup className="seneca-auth-logo" />
      <Typography component="h1" className="seneca-auth-title">
        {t.title}
      </Typography>

      {failure === null ? (
        <p role="status" className="seneca-auth-notice seneca-auth-notice--plain">
          <CircularProgress size={16} color="inherit" />
          <span>{t.preparing}</span>
        </p>
      ) : (
        <p role="alert" className="seneca-auth-error seneca-auth-error--block">
          {t[failure]}
        </p>
      )}

      <p className="seneca-auth-footnote">
        <NextLink href="/login" className="seneca-auth-link seneca-auth-link--accent">
          {tl.submit}
        </NextLink>
      </p>
    </AuthLayout>
  );
}
