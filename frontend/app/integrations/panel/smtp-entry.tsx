import AlternateEmailOutlinedIcon from '@mui/icons-material/AlternateEmailOutlined';
import { APP_NAME } from '@/app/lib/brand';
import type { ConfigField } from '../open-protocol-page';
import type { CatalogText, IntegrationEntry } from './integration-catalog';

/**
 * The workspace SMTP server. It also sends the saver's own password-reset
 * mail, so a save carries the caller's account password: a password field the
 * form never fills in and empties again after every save.
 */
export function smtpIntegrationEntry(t: CatalogText): IntegrationEntry {
  const smtp = t.entries.smtp;

  return {
    key: 'smtp',
    name: smtp.name.value,
    description: smtp.description.value,
    badge: 'Open protocol',
    category: 'email',
    recommended: true,
    icon: <AlternateEmailOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
    statusPath: '/settings/email/smtp',
    docsUrl: 'https://datatracker.ietf.org/doc/html/rfc5321',
    detail: {
      kind: 'protocol',
      config: {
        title: smtp.name.value,
        description: smtp.detailDescription.value,
        statusPath: '/settings/email/smtp',
        settingsPath: '/settings/email/smtp',
        settingsMethod: 'put',
        disconnectPath: '/settings/email/smtp',
        icon: <AlternateEmailOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
        workflow: `${smtp.workflow.value} ${smtp.passwordConfirm.value}`,
        fields: smtpFields(t.fields),
      },
    },
  };
}

/** The form, ending with the caller's account password. */
function smtpFields(f: CatalogText['fields']): ConfigField[] {
  return [
    { name: 'host', label: f.host.value, placeholder: 'mail.example.com', required: true },
    {
      name: 'port',
      label: f.port.value,
      type: 'number',
      placeholder: '587',
      required: true,
    },
    { name: 'secure', label: f.useTls.value, type: 'checkbox' },
    { name: 'user', label: f.username.value, placeholder: 'seneca@example.com' },
    { name: 'pass', label: f.password.value, type: 'password' },
    {
      name: 'from',
      label: f.from.value,
      placeholder: `${APP_NAME} <noreply@example.com>`,
      required: true,
    },
    { name: 'replyTo', label: f.replyTo.value, placeholder: 'support@example.com' },
    { name: 'timeoutMs', label: f.timeoutMs.value, type: 'number', placeholder: '10000' },
    {
      name: 'currentPassword',
      label: f.currentPassword.value,
      type: 'password',
      required: true,
    },
  ];
}
