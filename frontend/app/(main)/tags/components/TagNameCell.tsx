import Link from 'next/link';
import { Tag } from '@/app/components/icons';

/** A tag's name on the Tags list, with its icon, linking to the tag's page. */
export function TagNameCell({ id, name }: { id: string; name: string }): React.JSX.Element {
  return (
    <span className="seneca-tags__name">
      <Tag size={16} color="var(--text-muted)" aria-hidden style={{ flexShrink: 0 }} />
      <Link href={`/tags/${id}`} className="seneca-tags__name-text">
        {name}
      </Link>
    </span>
  );
}
