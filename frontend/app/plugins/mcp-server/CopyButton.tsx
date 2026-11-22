'use client';
import toast from 'react-hot-toast';
import { Copy } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

/** A copy icon in the corner of a code block. */
export function CopyButton({ text }: { text: string }) {
  const t = useIntlayer('mcpServerDrawer');
  const handle = () => {
    void navigator.clipboard.writeText(text).then(() => toast.success(t.copied.value));
  };
  return (
    <button
      type="button"
      onClick={handle}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
      }}
      title={t.copy.value}
    >
      <Copy size={14} />
    </button>
  );
}
