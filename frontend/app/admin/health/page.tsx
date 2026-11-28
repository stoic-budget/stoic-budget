'use client';

import { Alert, Container, Skeleton, Stack } from '@mui/material';
import { fill, formatHealthTime } from '@/app/components/system-health/health-format';
import { useSystemHealth } from '@/app/hooks/useSystemHealth';
import { useIntlayer, useLocale } from '@/app/i18n';
import { AdminHeader } from '../components/AdminGroup';
import { HealthRow, HealthSection } from './components/HealthRow';
import { checkText, queueFigures, queueText, type ReasonTexts } from './lib/health-text';

const SKELETON_KEYS = ['services', 'queues', 'config'];

/**
 * The server's health for its administrator: the services it needs, each
 * background queue, and the setup checklist, each with what to do. The banner
 * above the app's pages links here when one of them fails.
 */
export default function SystemHealthPage(): React.ReactElement {
  const t = useIntlayer('adminHealthPage');
  const adminPage = useIntlayer('adminPage');
  const { locale } = useLocale();
  const lang = String(locale);
  const { isAdmin, health, isPending, isError } = useSystemHealth();
  const r = Object.fromEntries(
    Object.entries(t.reasons).map(([key, node]) => [key, node.value]),
  ) as ReasonTexts;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4, px: { xs: 2, md: 4 } }}>
      <AdminHeader
        back={{ href: '/admin', label: adminPage.title }}
        title={t.title}
        subtitle={
          <>
            {t.subtitle}
            {health
              ? ` ${fill(t.checkedAt.value, { time: formatHealthTime(health.checkedAt, lang) })}`
              : null}
          </>
        }
      />
      {!isAdmin ? (
        <Alert severity="info">{t.notAdmin}</Alert>
      ) : isError && !health ? (
        <Alert severity="error">{t.loadFailed}</Alert>
      ) : isPending || !health ? (
        <Stack spacing={2}>
          {SKELETON_KEYS.map(key => (
            <Skeleton key={key} variant="rounded" height={140} />
          ))}
        </Stack>
      ) : (
        <>
          {isError ? (
            // The last check failed; what follows is the earlier answer, as of its time above.
            <Alert severity="error" sx={{ mb: 2 }}>
              {t.loadFailed}
            </Alert>
          ) : null}
          <HealthSection title={t.sections.services.value}>
            {health.services.map(check => (
              <HealthRow
                key={check.key}
                label={t.labels[check.key].value}
                level={check.level}
                levelText={t.levels[check.level].value}
                text={checkText(check, r, lang)}
              />
            ))}
          </HealthSection>
          <HealthSection title={t.sections.queues.value}>
            {health.queues.map(queue => (
              <HealthRow
                key={queue.name}
                label={queue.name}
                level={queue.level}
                levelText={t.levels[queue.level].value}
                text={queueText(queue, r, lang)}
                detail={queueFigures(queue, r, lang)}
              />
            ))}
          </HealthSection>
          <HealthSection title={t.sections.config.value}>
            {health.config.map(check => (
              <HealthRow
                key={check.key}
                label={t.labels[check.key].value}
                level={check.level}
                levelText={t.levels[check.level].value}
                text={checkText(check, r, lang)}
              />
            ))}
          </HealthSection>
        </>
      )}
    </Container>
  );
}
