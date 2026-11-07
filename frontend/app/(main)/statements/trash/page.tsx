'use client';

import { Breadcrumbs } from '@/app/components/ui/breadcrumbs';
import { useIntlayer } from '@/app/i18n';
import TrashListView from '../components/TrashListView';

export default function StatementsTrashPage() {
  const t = useIntlayer('statementsPage');
  // The trail sits above the list, which fills the rest of the height on its own.
  return (
    <div className="seneca-trash-page">
      <Breadcrumbs
        parent="/statements"
        current={t.trash.title}
        className="seneca-trash-page__crumbs"
      />
      <TrashListView />
    </div>
  );
}
