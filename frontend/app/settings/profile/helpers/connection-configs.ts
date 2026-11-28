import { useMemo } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { ProtocolIntegrationPageProps } from '@/app/integrations/open-protocol-page';

type CatalogText = ReturnType<typeof useIntlayer<'integrationCatalog'>>;

export type ConnectionConfig = Omit<
  ProtocolIntegrationPageProps,
  'embedded' | 'onConnectionStatusChange'
> & {
  /** One line for the accordion header. */
  summary: string;
  docsUrl?: string;
};

export type SettingsConnectionKey = 'app-url' | 's3-compatible' | 'webdav';

/**
 * Connections that are workspace settings rather than plugins: the public app
 * address and the two file stores. Settings shows them as accordion panels.
 */
function buildConnectionConfigs(t: CatalogText): Record<SettingsConnectionKey, ConnectionConfig> {
  const f = t.fields;
  const e = t.entries;

  return {
    'app-url': {
      title: e.appUrl.name.value,
      summary: e.appUrl.description.value,
      description: e.appUrl.detailDescription.value,
      statusPath: '/settings/app',
      settingsPath: '/settings/app',
      settingsMethod: 'put',
      disconnectPath: '/settings/app',
      workflow: e.appUrl.workflow.value,
      fields: [
        {
          name: 'publicUrl',
          label: f.publicUrl.value,
          placeholder: 'https://app.example.com',
          required: true,
        },
      ],
    },
    's3-compatible': {
      title: e.s3.name.value,
      summary: e.s3.description.value,
      description: e.s3.detailDescription.value,
      docsUrl: 'https://min.io/docs/minio/linux/developers/javascript/API.html',
      statusPath: '/integrations/s3-compatible/status',
      settingsPath: '/integrations/s3-compatible/settings',
      disconnectPath: '/integrations/s3-compatible',
      filesPath: '/integrations/s3-compatible/files',
      importPath: '/integrations/s3-compatible/import',
      syncPath: '/integrations/s3-compatible/sync',
      fields: [
        {
          name: 'endpoint',
          label: f.endpoint.value,
          placeholder: 'http://localhost:9000',
          required: true,
        },
        { name: 'region', label: f.region.value, placeholder: 'us-east-1' },
        { name: 'bucket', label: f.bucket.value, placeholder: 'seneca', required: true },
        { name: 'prefix', label: f.prefix.value, placeholder: 'statements' },
        { name: 'accessKeyId', label: f.accessKeyId.value, type: 'password' },
        { name: 'secretAccessKey', label: f.secretAccessKey.value, type: 'password' },
        { name: 'forcePathStyle', label: f.forcePathStyle.value, type: 'checkbox' },
        { name: 'autoBackup', label: f.autoBackup.value, type: 'checkbox' },
      ],
      workflow: e.s3.workflow.value,
    },
    webdav: {
      title: e.webdav.name.value,
      summary: e.webdav.description.value,
      description: e.webdav.detailDescription.value,
      docsUrl: 'https://datatracker.ietf.org/doc/html/rfc4918',
      statusPath: '/integrations/webdav/status',
      settingsPath: '/integrations/webdav/settings',
      disconnectPath: '/integrations/webdav',
      filesPath: '/integrations/webdav/files',
      importPath: '/integrations/webdav/import',
      syncPath: '/integrations/webdav/sync',
      fields: [
        {
          name: 'url',
          label: f.webdavUrl.value,
          placeholder: 'https://cloud.example.com/remote.php/dav/files/user',
          required: true,
        },
        { name: 'rootPath', label: f.rootPath.value, placeholder: '/' },
        { name: 'username', label: f.username.value },
        { name: 'password', label: f.password.value, type: 'password' },
      ],
      workflow: e.webdav.workflow.value,
    },
  };
}

/** The connection forms with their labels in the active locale. */
export function useConnectionConfigs(): Record<SettingsConnectionKey, ConnectionConfig> {
  const t = useIntlayer('integrationCatalog');
  return useMemo(() => buildConnectionConfigs(t), [t]);
}
