import type { useIntlayer } from '@/app/i18n';
import { formatStoredDate } from '@/app/lib/user-format-store';

type McpServerText = ReturnType<typeof useIntlayer<'mcpServerDrawer'>>;

/** When a key or an app was last used: today, days ago, then the date. */
export function timeAgo(dateStr: string | null, t: McpServerText): string {
  if (!dateStr) return t.neverUsed.value;
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return t.today.value;
  if (d === 1) return t.oneDayAgo.value;
  if (d < 30) return t.daysAgo.value.replace('{count}', String(d));
  return formatStoredDate(dateStr);
}
