'use client';

import { useState } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { readOpenWorkspaceId } from '../lib/open-workspace';

function readStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return readOpenWorkspaceId();
}

/**
 * Идентификатор активного воркспейса для ключей React Query.
 *
 * Фолбэк на сохранённый id несущий: request-интерцептор apiClient берёт
 * X-Workspace-Id прямо из хранилища вкладки (open-workspace.ts), а WorkspaceContext заполняет
 * currentWorkspace асинхронно. Без фолбэка первый рендер ключевал бы запросы
 * на null, хотя заголовок уже конкретный, — и после прихода стейта каждый
 * горячий запрос уходил бы на второй круг.
 */
export function useWorkspaceId(): string | null {
  const { currentWorkspace } = useWorkspace();
  const [storedId] = useState(readStoredWorkspaceId);
  return currentWorkspace?.id ?? storedId;
}
