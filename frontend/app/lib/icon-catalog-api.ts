import type { IconNode } from './category-line-icons';
import { LUCIDE_VERSION } from './icons/lucide-version';

/**
 * The Lucide catalogue in public/icons/lucide/<version>/, written by
 * scripts/build-icon-catalog.mjs: drawings by name (about 100 kB gzip) and
 * English search words by name (about 70 kB). A static file of the app's own,
 * so a plain fetch; the version in the path lets the browser keep it.
 */
const base = `/icons/lucide/${LUCIDE_VERSION}`;

async function readJson(file: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${base}/${file}`);
  if (!response.ok) {
    throw new Error(`Icon catalogue ${file}: HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`Icon catalogue ${file}: not an object`);
  }
  return body as Record<string, unknown>;
}

/** Every drawing, by name. */
export async function fetchIconNodes(): Promise<Record<string, IconNode>> {
  const body = await readJson('nodes.json');
  const nodes: Record<string, IconNode> = {};
  for (const [name, node] of Object.entries(body)) {
    if (Array.isArray(node)) {
      nodes[name] = node as IconNode;
    }
  }
  return nodes;
}

/** Every icon's English search words, by name. */
export async function fetchIconWords(): Promise<Record<string, string[]>> {
  const body = await readJson('tags.json');
  const words: Record<string, string[]> = {};
  for (const [name, list] of Object.entries(body)) {
    words[name] = Array.isArray(list) ? list.filter(word => typeof word === 'string') : [];
  }
  return words;
}
