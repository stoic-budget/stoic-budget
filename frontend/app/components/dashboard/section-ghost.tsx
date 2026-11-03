'use client';

import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

/** The preview under the pointer is shrunk to at most this width. */
const GHOST_MAX_WIDTH_PX = 420;

/**
 * What follows the pointer: a shrunken snapshot of the section being moved.
 * Dragging the card itself would carry a full-width card past the screen edge
 * and cover the very places it could be dropped; the snapshot is fixed-position
 * and small, and the card stays put, dimmed, until it is dropped.
 */
export function SectionGhost({ id }: { id: string }): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const source = document.querySelector<HTMLElement>(`[data-overview-section="${id}"]`);
    const host = hostRef.current;
    if (!(source && host)) {
      return;
    }
    const width = source.getBoundingClientRect().width;
    const clone = source.cloneNode(true) as HTMLElement;
    // Only the real section may answer to its id while the drop target is looked up.
    clone.removeAttribute('data-overview-section');
    // A picture, not a second set of controls.
    clone.setAttribute('inert', '');
    clone.className = 'seneca-overview__section';
    clone.style.width = `${width}px`;
    host.replaceChildren(clone);
    setScale(Math.min(1, GHOST_MAX_WIDTH_PX / width));
  }, [id]);

  return (
    <div
      ref={hostRef}
      className="seneca-overview__ghost"
      style={{ transform: `scale(${scale})` }}
      aria-hidden
    />
  );
}
