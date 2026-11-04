import { useEffect, useRef } from 'react';

/**
 * Whether the component is still mounted, for work that finishes after it may
 * have left. Set on every mount: React mounts twice in development, and a flag
 * cleared by the first unmount alone dropped every payment an upload came back with.
 */
export function useAliveRef() {
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
