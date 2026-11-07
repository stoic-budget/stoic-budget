import { type RefObject, useCallback, useEffect, useState } from 'react';

export type ScrollEdges = {
  /** Something is hidden past either edge, so the strip needs its arrows. */
  overflows: boolean;
  canBack: boolean;
  canForward: boolean;
  /** Scrolls by one visible width; snapping lands it on a whole item. */
  page: (direction: 1 | -1) => void;
};

/** Which ends of a horizontal scroller still hide items, kept current on scroll and resize. */
export function useScrollEdges(ref: RefObject<HTMLElement | null>, itemCount: number): ScrollEdges {
  const [edges, setEdges] = useState({ overflows: false, canBack: false, canForward: false });

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new item can mount the track or widen its content without resizing it
  useEffect(() => {
    const track = ref.current;
    if (!track) {
      return;
    }
    const measure = (): void => {
      const max = track.scrollWidth - track.clientWidth;
      // One pixel of slack: zoomed screens leave fractional scroll positions.
      const next = {
        overflows: max > 1,
        canBack: track.scrollLeft > 1,
        canForward: track.scrollLeft < max - 1,
      };
      setEdges(previous =>
        previous.overflows === next.overflows &&
        previous.canBack === next.canBack &&
        previous.canForward === next.canForward
          ? previous
          : next,
      );
    };
    measure();
    track.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(track);
    return () => {
      track.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [ref, itemCount]);

  const page = useCallback(
    (direction: 1 | -1): void => {
      const track = ref.current;
      track?.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
    },
    [ref],
  );

  return { ...edges, page };
}
