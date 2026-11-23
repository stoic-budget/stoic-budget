'use client';

import { Alert, Box, Container, Paper, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { checkContract } from '@/app/lib/query-fn-schema';
import api from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/api-error';

interface SharedColumn {
  key: string;
  title: string;
  type: string;
  position: number;
}

interface SharedTable {
  table: { id: string; name: string; description: string | null };
  columns: SharedColumn[];
}

interface SharedRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(v => String(v ?? '')).join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '—';
  }
  return String(value);
}

/** Rows a request asks for, the server's own cap. */
const PAGE = 200;

/**
 * Публичный просмотр таблицы по ссылке. Страница вне авторизации: доступ
 * определяет только токен, а сервер отдаёт исключительно данные для чтения.
 */
export default function SharedTablePage() {
  const t = useIntlayer('sharedTablePage');
  const params = useParams();
  const token = params.token as string;

  const [view, setView] = useState<SharedTable | null>(null);
  const [rows, setRows] = useState<SharedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      return await (async () => {
        // Every row, a page of 200 at a time: the link shows the whole table.
        const allRows = async (): Promise<SharedRow[]> => {
          const items: SharedRow[] = [];
          for (let cursor: number | undefined; ; ) {
            const response = await api.get(`/public/custom-tables/${token}/rows`, {
              params: { limit: PAGE, ...(cursor === undefined ? {} : { cursor }) },
            });
            const page = await checkContract(
              'SharedTableRows',
              response.data,
              '/public/custom-tables/:token/rows',
            );
            items.push(...page.items);
            const last = page.items.at(-1);
            if (!last || page.items.length < PAGE || items.length >= page.meta.total) {
              return items;
            }
            cursor = last.rowNumber;
          }
        };
        const [tableResponse, rows] = await Promise.all([
          api.get(`/public/custom-tables/${token}`),
          allRows(),
        ]);
        const view = await checkContract(
          'SharedTableView',
          tableResponse.data,
          '/public/custom-tables/:token',
        );
        if (cancelled) {
          return;
        }
        setView(view);
        setRows(rows);
      })()
        .catch(async err => {
          if (!cancelled) {
            // Отозванная и истёкшая ссылка приходят сюда же — показываем причину.
            setError(getApiErrorMessage(err, t.linkUnavailable.value));
          }
        })
        .finally(async () => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, t.linkUnavailable.value]);

  if (loading) {
    return (
      <Container sx={{ py: 6 }}>
        <Typography>{t.loading.value}</Typography>
      </Container>
    );
  }

  if (error || !view) {
    return (
      <Container sx={{ py: 6, maxWidth: 600 }}>
        <Alert severity="error">{error ?? t.linkUnavailable.value}</Alert>
      </Container>
    );
  }

  const columns = [...view.columns].sort((a, b) => a.position - b.position);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
        {view.table.name}
      </Typography>
      {view.table.description && (
        <Typography sx={{ color: 'var(--muted-foreground)', mb: 2 }}>
          {view.table.description}
        </Typography>
      )}

      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Box
                component="th"
                sx={{ p: 1.5, textAlign: 'left', fontSize: 12, bgcolor: 'var(--muted)' }}
              >
                #
              </Box>
              {columns.map(col => (
                <Box
                  key={col.key}
                  component="th"
                  sx={{
                    p: 1.5,
                    textAlign: 'left',
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    bgcolor: 'var(--muted)',
                  }}
                >
                  {col.title}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.rowNumber}>
                <Box
                  component="td"
                  sx={{ p: 1.5, fontSize: 13, borderTop: '1px solid var(--border-color)' }}
                >
                  {row.rowNumber}
                </Box>
                {columns.map(col => (
                  <Box
                    key={col.key}
                    component="td"
                    sx={{ p: 1.5, fontSize: 13, borderTop: '1px solid var(--border-color)' }}
                  >
                    {formatCell(row.data?.[col.key])}
                  </Box>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Paper>

      {rows.length === 0 && (
        <Typography sx={{ mt: 2, color: 'var(--muted-foreground)' }}>{t.noData.value}</Typography>
      )}
    </Container>
  );
}
