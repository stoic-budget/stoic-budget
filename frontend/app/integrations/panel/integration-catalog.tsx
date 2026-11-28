import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import type React from 'react';
import { useMemo } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { ProtocolIntegrationPageProps } from '../open-protocol-page';
import { smtpIntegrationEntry } from './smtp-entry';

export type IntegrationCategoryKey = 'bank' | 'email' | 'messaging';

export type CatalogText = ReturnType<typeof useIntlayer<'integrationCatalog'>>;
type PeppolText = ReturnType<typeof useIntlayer<'peppol'>>;

type ProtocolConfig = Omit<ProtocolIntegrationPageProps, 'embedded' | 'onConnectionStatusChange'>;

/**
 * What the second layer shows for an entry: the shared protocol form, or a
 * panel of its own for the one entry that is not a credentials form.
 */
export type IntegrationDetail =
  | { kind: 'protocol'; config: ProtocolConfig }
  | { kind: 'bank-sync' };

export type IntegrationEntry = {
  key: string;
  name: string;
  description: string;
  badge: string;
  category: IntegrationCategoryKey;
  recommended: boolean;
  icon: React.ReactNode;
  /** Where the list reads the connected flag from; absent means no connection state. */
  statusPath?: string;
  docsUrl?: string;
  detail: IntegrationDetail;
};

/**
 * The integrations offered in the panel, in list order. Each entry carries the
 * settings its second layer renders, so there is one place to add a service.
 */
function buildIntegrationCatalog(t: CatalogText, peppol: PeppolText): IntegrationEntry[] {
  const f = t.fields;
  const e = t.entries;

  return [
    smtpIntegrationEntry(t),
    {
      key: 'imap',
      name: e.imap.name.value,
      description: e.imap.description.value,
      badge: 'Open protocol',
      category: 'email',
      recommended: true,
      icon: <MarkEmailUnreadOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/imap/status',
      docsUrl: 'https://datatracker.ietf.org/doc/html/rfc9051',
      detail: {
        kind: 'protocol',
        config: {
          title: e.imap.name.value,
          description: e.imap.detailDescription.value,
          statusPath: '/integrations/imap/status',
          settingsPath: '/integrations/imap/settings',
          disconnectPath: '/integrations/imap',
          icon: <MarkEmailUnreadOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          syncPath: '/integrations/imap/sync',
          fields: [
            { name: 'host', label: f.host.value, placeholder: 'imap.example.com', required: true },
            { name: 'port', label: f.port.value, type: 'number', placeholder: '993' },
            {
              name: 'mailbox',
              label: f.mailbox.value,
              placeholder: 'INBOX',
              browseAction: {
                label: f.browseFolders.value,
                endpoint: '/integrations/imap/folders',
                dependsOn: ['host', 'port', 'secure', 'user', 'pass'],
              },
            },
            { name: 'user', label: f.username.value, required: true },
            { name: 'pass', label: f.password.value, type: 'password', required: true },
            { name: 'secure', label: f.useTls.value, type: 'checkbox' },
          ],
          workflow: e.imap.workflow.value,
        },
      },
    },
    {
      key: 'bank-sync',
      name: e.bankSync.name.value,
      description: e.bankSync.description.value,
      badge: 'Your own provider',
      category: 'bank',
      recommended: false,
      icon: <AccountBalanceOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/bank-sync/connections',
      detail: { kind: 'bank-sync' },
    },
    {
      key: 'peppol',
      name: peppol.integrationName.value,
      description: peppol.integrationDescription.value,
      badge: 'Peppol',
      category: 'messaging',
      recommended: false,
      icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/peppol/status',
      docsUrl: 'https://docs.recommand.eu',
      detail: {
        kind: 'protocol',
        config: {
          title: peppol.integrationName.value,
          description: peppol.integrationDetail.value,
          statusPath: '/integrations/peppol/status',
          settingsPath: '/integrations/peppol/settings',
          disconnectPath: '/integrations/peppol',
          syncPath: '/integrations/peppol/sync',
          icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          // The form shows the workflow text, not the description: the sign-up steps go first.
          workflow: `${peppol.integrationDetail.value} ${peppol.integrationWorkflow.value}`,
          fields: [
            {
              name: 'apiKeyId',
              label: peppol.apiKeyId.value,
              placeholder: 'key_…',
              required: true,
            },
            {
              name: 'apiSecret',
              label: peppol.apiSecret.value,
              type: 'password',
              placeholder: peppol.apiSecretPlaceholder.value,
            },
            { name: 'companyId', label: peppol.companyId.value, placeholder: 'c_…' },
            {
              name: 'senderPeppolId',
              label: peppol.senderPeppolId.value,
              placeholder: '9930:DE123456789',
            },
          ],
        },
      },
    },
    {
      key: 'telegram',
      name: 'Telegram',
      description: e.telegram.description.value,
      badge: 'Bot token',
      category: 'messaging',
      recommended: false,
      icon: <TelegramIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/settings/notifications/telegram',
      docsUrl: 'https://core.telegram.org/bots',
      detail: {
        kind: 'protocol',
        config: {
          title: 'Telegram',
          description: e.telegram.detailDescription.value,
          statusPath: '/settings/notifications/telegram',
          settingsPath: '/settings/notifications/telegram',
          settingsMethod: 'put',
          disconnectPath: '/settings/notifications/telegram',
          icon: <TelegramIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          workflow: e.telegram.workflow.value,
          fields: [
            {
              name: 'botToken',
              label: f.botToken.value,
              type: 'password',
              placeholder: '123456:ABC...',
            },
            { name: 'timeoutMs', label: f.timeoutMs.value, type: 'number', placeholder: '10000' },
          ],
        },
      },
    },
  ];
}

/** The catalog with its names, descriptions and field labels in the active locale. */
export function useIntegrationCatalog(): IntegrationEntry[] {
  const t = useIntlayer('integrationCatalog');
  const peppol = useIntlayer('peppol');
  return useMemo(() => buildIntegrationCatalog(t, peppol), [t, peppol]);
}

export function findIntegrationEntry(
  catalog: IntegrationEntry[],
  key: string | null,
): IntegrationEntry | undefined {
  return key ? catalog.find(entry => entry.key === key) : undefined;
}
