import { useSyncExternalStore } from 'react';
import type { BrokerStatementTable } from '@/app/lib/contracts';

/** What the last broker PDF read into the wizard says that its rows do not. */
type BrokerChecks = BrokerStatementTable['checks'];

let current: BrokerChecks = [];
const listeners = new Set<() => void>();

export function setBrokerChecks(checks: BrokerChecks): void {
  current = checks;
  for (const listener of listeners) {
    listener();
  }
}

export function useBrokerChecks(): BrokerChecks {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
