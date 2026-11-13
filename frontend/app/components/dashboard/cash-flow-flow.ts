import { OTHER_CATEGORY_ID } from '@/app/(main)/reports/components/cash-flow/cash-flow.chart';
import type { CashFlowMapData } from '@/app/(main)/reports/components/cash-flow/useCashFlowMap';

type Sankey = CashFlowMapData['sankey'];

/** Nodes on either side of the total on the dashboard, so the card stays about one screen tall. */
export const MAX_SIDE_NODES = 5;
const OTHER_SOURCE_ID = 'source:__other__';

/** The first and last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * The Reports sankey cut to sources → total → categories for a half-width
 * card: subcategories and the bands into them go, and each category keeps the
 * value that flows into it, so the picture adds up the same.
 */
export function withoutSubcategories(sankey: Sankey): Sankey {
  const dropped = new Set(
    sankey.nodes.filter(node => node.kind === 'subcategory').map(node => node.id),
  );
  return {
    nodes: sankey.nodes.filter(node => !dropped.has(node.id)),
    links: sankey.links.filter(link => !(dropped.has(link.source) || dropped.has(link.target))),
  };
}

/**
 * At most MAX_SIDE_NODES nodes on each side of the total: past that the
 * smallest sources and categories fold into one "Other" node per side that
 * carries their sum, so the picture adds up the same. Money from the balance,
 * transfers and what is left over keep their own nodes.
 */
export function foldSmallest(sankey: Sankey, otherName: string): Sankey {
  const kindOf = new Map(sankey.nodes.map(node => [node.id, node.kind]));
  const folded = new Set<string>();
  const added: Sankey = { nodes: [], links: [] };
  const fold = (end: 'source' | 'target', kind: 'source' | 'category', otherId: string) => {
    const hub = end === 'source' ? 'target' : 'source';
    const side = sankey.links.filter(link => link[hub] === 'total');
    const foldable = side
      .filter(link => kindOf.get(link[end]) === kind)
      .sort((a, b) => b.value - a.value);
    const room = MAX_SIDE_NODES - (side.length - foldable.length);
    if (foldable.length <= room) return;
    const tail = foldable.slice(Math.max(room - 1, 0));
    for (const link of tail) folded.add(link[end]);
    const value = Math.round(tail.reduce((sum, link) => sum + link.value, 0) * 100) / 100;
    added.nodes.push({ id: otherId, name: otherName, kind });
    added.links.push(
      end === 'source'
        ? { source: otherId, target: 'total', value }
        : { source: 'total', target: otherId, value },
    );
  };
  fold('source', 'source', OTHER_SOURCE_ID);
  fold('target', 'category', OTHER_CATEGORY_ID);
  return {
    nodes: [...sankey.nodes.filter(node => !folded.has(node.id)), ...added.nodes],
    links: [
      ...sankey.links.filter(link => !(folded.has(link.source) || folded.has(link.target))),
      ...added.links,
    ],
  };
}
