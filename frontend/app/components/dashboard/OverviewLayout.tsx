'use client';

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import clsx from 'clsx';
import type React from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GripVertical } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { requestSnapshotRecapture } from '@/app/lib/snapshot-skeleton/recapture';
import { OverviewWidgetPicker } from './OverviewWidgetPicker';
import {
  canSitBeside,
  DEFAULT_OVERVIEW_ROWS,
  type DropZone,
  hideSection,
  isDefaultLayout,
  isLeadTile,
  isTile,
  moveSection,
  normalizeRows,
  type OverviewRows,
  type OverviewSectionId,
  rowSpans,
  showSection,
  tellsThePresent,
} from './overview-layout';
import { useShowsOtherMonth } from './overview-month';
import { SectionGhost } from './section-ghost';
import { SectionSpanProvider } from './section-span';
import { useOverviewLayoutState } from './use-overview-layout-state';

interface Drop {
  target: string;
  zone: DropZone;
}

interface Point {
  x: number;
  y: number;
}

/** How far into a card, from either side, a drop counts as "next to it". */
const SIDE_BAND_SHARE = 0.3;
const SIDE_BAND_MAX_PX = 200;

/** Page scroll follows the pointer near the top or bottom edge only, never sideways. */
const AUTO_SCROLL = { threshold: { x: 0, y: 0.15 } };

/** The card under the pointer; in the gaps between cards, the nearest one. */
const collisionDetection: CollisionDetection = args => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

function zoneFor(rows: OverviewRows, active: string, target: string, rect: DOMRect, point: Point) {
  const band = Math.min(rect.width * SIDE_BAND_SHARE, SIDE_BAND_MAX_PX);
  if (canSitBeside(rows, active, target)) {
    if (point.x < rect.left + band) {
      return 'left';
    }
    if (point.x > rect.right - band) {
      return 'right';
    }
  }
  return point.y < rect.top + rect.height / 2 ? 'above' : 'below';
}

interface OverviewSectionProps {
  id: string;
  /** Columns of the twelve it spans, given what else in its row has something to show. */
  span: number;
  /**
   * On a narrow screen, a row of its own: the lead tile, or the odd tile left
   * over when the row's tiles pair up two by two.
   */
  unpaired: boolean;
  /**
   * Where a narrow screen draws it: in its row's place, the lead tile ahead of
   * the rest, so the tiles beside it still pair up underneath.
   */
  phoneOrder: number;
  /** Its card draws nothing, so the section takes no room. */
  empty: boolean;
  drop: DropZone | null;
  handleLabel: string;
  onEmptyChange: (id: string, empty: boolean) => void;
  children: React.ReactNode;
}

function OverviewSection({
  id,
  span,
  unpaired,
  phoneOrder,
  empty,
  drop,
  handleLabel,
  onEmptyChange,
  children,
}: OverviewSectionProps): React.JSX.Element {
  const drag = useDraggable({ id });
  const { setNodeRef: setDropRef } = useDroppable({ id });
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const muted = useShowsOtherMonth() && tellsThePresent(id);
  const style = { '--overview-span': span, '--overview-phone-order': phoneOrder };
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      drag.setNodeRef(node);
      setDropRef(node);
    },
    [drag.setNodeRef, setDropRef],
  );

  // Several cards draw nothing until their data is in, or ever, when there is
  // nothing to say. Such a section must not hold half a row, so the layout is
  // told whenever the card's own markup comes or goes.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return undefined;
    }
    const report = () => onEmptyChange(id, node.childElementCount <= 1);
    report();
    const observer = new MutationObserver(report);
    observer.observe(node, { childList: true });
    return () => observer.disconnect();
  }, [id, onEmptyChange]);

  return (
    <div
      ref={setRef}
      data-overview-section={id}
      style={style as React.CSSProperties}
      className={clsx(
        'seneca-overview__section',
        isTile(id) && 'seneca-overview__section--tile',
        muted && 'seneca-overview__section--muted',
        unpaired && 'seneca-overview__section--unpaired',
        empty && 'seneca-overview__section--empty',
        drag.isDragging && 'seneca-overview__section--dragging',
        drop && `seneca-overview__section--drop-${drop}`,
      )}
    >
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        className="seneca-overview__handle"
        data-skeleton-skip=""
        {...drag.attributes}
        {...drag.listeners}
        aria-label={handleLabel}
        title={handleLabel}
      >
        <GripVertical size={16} />
      </button>
      <SectionSpanProvider value={span}>{children}</SectionSpanProvider>
    </div>
  );
}

interface OverviewLayoutProps {
  sections: Record<OverviewSectionId, React.ReactNode>;
}

/**
 * The Overview sections, each movable by its grip. Dropped on a card's side a
 * section joins that card's row and both take half the width; dropped above or
 * below it gets a row of its own. The arrangement is remembered per person and
 * workspace. Phones get no grips: there everything is one column anyway.
 */
export function OverviewLayout({ sections }: OverviewLayoutProps): React.JSX.Element {
  const t = useIntlayer('overviewTab');
  const { state, save } = useOverviewLayoutState();
  const hidden = useMemo(() => state?.hiddenSections ?? [], [state]);
  const rows = useMemo(
    () => normalizeRows(state ? { rows: state.overviewRows, hidden } : null),
    [state, hidden],
  );
  const [empty, setEmpty] = useState<ReadonlySet<string>>(() => new Set());
  const [drop, setDrop] = useState<Drop | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const pointer = useRef<Point | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // A new arrangement is what the next visit's skeleton should show, at once.
  useLayoutEffect(() => requestSnapshotRecapture(root.current), [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const onEmptyChange = useCallback((id: string, isEmpty: boolean) => {
    setEmpty(previous => {
      if (previous.has(id) === isEmpty) {
        return previous;
      }
      const next = new Set(previous);
      if (isEmpty) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const trackPointer = useCallback((event: PointerEvent) => {
    pointer.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setDragging(String(active.id));
      window.addEventListener('pointermove', trackPointer);
    },
    [trackPointer],
  );

  const stopTracking = useCallback(() => {
    window.removeEventListener('pointermove', trackPointer);
    pointer.current = null;
    setDrop(null);
    setDragging(null);
  }, [trackPointer]);

  const handleDragMove = useCallback(
    ({ active, over }: DragMoveEvent) => {
      const target = over ? String(over.id) : null;
      const node =
        target && target !== active.id
          ? document.querySelector(`[data-overview-section="${target}"]`)
          : null;
      // A keyboard drag has no pointer; the moved card's centre stands in for it.
      const moved = active.rect.current.translated;
      const point =
        pointer.current ??
        (moved ? { x: moved.left + moved.width / 2, y: moved.top + moved.height / 2 } : null);
      if (!(target && node && point)) {
        setDrop(null);
        return;
      }
      const zone = zoneFor(rows, String(active.id), target, node.getBoundingClientRect(), point);
      setDrop(previous =>
        previous?.target === target && previous.zone === zone ? previous : { target, zone },
      );
    },
    [rows],
  );

  const handleDragEnd = useCallback(
    ({ active }: DragEndEvent) => {
      if (drop) {
        const next = moveSection(rows, String(active.id), drop.target, drop.zone);
        if (next !== rows) {
          save({ overviewRows: next, hiddenSections: hidden });
        }
      }
      stopTracking();
    },
    [drop, rows, hidden, save, stopTracking],
  );

  const toggleSection = useCallback(
    (id: OverviewSectionId, shown: boolean) =>
      save(shown ? showSection(rows, hidden, id) : hideSection(rows, hidden, id)),
    [rows, hidden, save],
  );

  const shown = useMemo(() => new Set(rows.flat()), [rows]);

  const targetRow = drop ? rows.find(row => row.includes(drop.target)) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll={AUTO_SCROLL}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={stopTracking}
    >
      <div ref={root} className="seneca-dashboard__tab seneca-overview">
        <div className="seneca-overview__body">
          <div className="seneca-overview__grid">
            {/* One flat list, not a wrapper per row: a moved card keeps its place
              in the tree, so it is not remounted and keeps its own state. */}
            {rows.flatMap((row, rowIndex) => {
              const shown = row.filter(id => !empty.has(id));
              const spans = rowSpans(shown);
              // The lead tile takes a phone's whole row, so it pairs with nothing.
              const tiles = shown.filter(id => isTile(id) && !isLeadTile(id));
              const unpaired = tiles.length % 2 === 1 ? tiles[tiles.length - 1] : undefined;
              const vertical = drop && (drop.zone === 'above' || drop.zone === 'below');
              return row.map(id => (
                <OverviewSection
                  key={id}
                  id={id}
                  span={spans.get(id) ?? 0}
                  unpaired={id === unpaired || isLeadTile(id)}
                  phoneOrder={rowIndex * 2 + (isLeadTile(id) ? 0 : 1)}
                  empty={empty.has(id)}
                  drop={
                    drop?.target === id || (vertical && row === targetRow)
                      ? (drop?.zone ?? null)
                      : null
                  }
                  handleLabel={t.layoutDragHandle.value}
                  onEmptyChange={onEmptyChange}
                >
                  {sections[id as OverviewSectionId]}
                </OverviewSection>
              ));
            })}
          </div>
        </div>
        <div className="seneca-overview__footer">
          <OverviewWidgetPicker shown={shown} onToggle={toggleSection} />
          {!isDefaultLayout(rows) && (
            <button
              type="button"
              className="seneca-overview__reset"
              onClick={() => save({ overviewRows: DEFAULT_OVERVIEW_ROWS, hiddenSections: [] })}
            >
              {t.layoutReset}
            </button>
          )}
        </div>
      </div>
      <DragOverlay>{dragging ? <SectionGhost id={dragging} /> : null}</DragOverlay>
    </DndContext>
  );
}
