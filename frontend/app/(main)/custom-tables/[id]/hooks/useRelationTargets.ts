'use client';

import { useEffect, useState } from 'react';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

/** Tables a relation column can point at, loaded when the column dialog first opens. */
export function useRelationTargets(tableId: string, columnDialogOpen: boolean) {
  const [relationTargets, setRelationTargets] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!columnDialogOpen || relationTargets.length) {
      return;
    }
    apiQueryDecoded({ url: '/custom-tables', contract: 'CustomTableList' })
      .then(({ items }) => {
        setRelationTargets(
          items.filter(item => item.id !== tableId).map(({ id, name }) => ({ id, name })),
        );
      })
      .catch(error => console.error('Failed to load relation targets:', error));
  }, [columnDialogOpen, relationTargets.length, tableId]);
  return relationTargets;
}
