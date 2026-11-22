'use client';

import { Box, Link, Paper, Skeleton, Typography } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useMemo, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { hasSessionCookie } from '@/app/lib/csrf';
import { tokens } from '@/lib/theme-tokens';
import { readAuthorizationRequest } from './authorization-request';
import { ConsentForm } from './ConsentForm';
import { useOAuthConsent } from './useOAuthConsent';

/**
 * The OAuth authorization endpoint of the MCP server: a signed-in person sees
 * which app asks, where the answer goes, and picks a workspace and what the
 * app may do there. Signed out, they sign in first and come back here.
 */
function AuthorizeContent() {
  const t = useIntlayer('oauthConsentPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const request = useMemo(() => readAuthorizationRequest(new URLSearchParams(search)), [search]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (hasSessionCookie()) {
      setSignedIn(true);
      return;
    }
    setSignedIn(false);
    router.replace(`/login?next=${encodeURIComponent(`/oauth/authorize?${search}`)}`);
  }, [router, search]);

  const { consent, loading, loadError, refusal, decide, deciding, decideError } = useOAuthConsent(
    signedIn ? request : null,
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
      }}
    >
      <Paper
        component="main"
        sx={{
          width: '100%',
          maxWidth: 480,
          p: { xs: 2.5, sm: 4 },
          borderRadius: tokens.radius.lg,
          bgcolor: 'var(--card-bg)',
          border: '1px solid var(--border)',
        }}
      >
        {!request ? (
          <Message title={t.invalidTitle.value} text={t.invalidText.value} />
        ) : loadError ? (
          <Message
            title={t.invalidTitle.value}
            text={getApiErrorMessage(loadError, t.invalidText.value)}
          />
        ) : refusal ? (
          <Message title={t.invalidTitle.value} text={t.invalidText.value}>
            {/* A click, never an automatic redirect: the address is the registrant's choice. */}
            {refusal.back ? (
              <Link
                href={refusal.back.href}
                rel="noreferrer"
                sx={{ fontSize: 14, color: 'var(--primary)', overflowWrap: 'anywhere' }}
              >
                {t.backTo.value.replace('{host}', () => refusal.back?.host ?? '')}
              </Link>
            ) : null}
          </Message>
        ) : loading || !consent ? (
          <Box aria-busy="true">
            <Skeleton width="70%" height={28} />
            <Skeleton width="100%" />
            <Skeleton width="90%" />
            <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
          </Box>
        ) : (
          <ConsentForm
            consent={consent}
            deciding={deciding}
            error={decideError ? getApiErrorMessage(decideError, t.sendFailed.value) : null}
            onDecide={decide}
          />
        )}
      </Paper>
    </Box>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <Box role="alert">
      <Typography component="h1" sx={{ fontSize: 18, fontWeight: 500, mb: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)', mb: children ? 2 : 0 }}>
        {text}
      </Typography>
      {children}
    </Box>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={null}>
      <AuthorizeContent />
    </Suspense>
  );
}
