#!/usr/bin/env node
/**
 * Writes the icon catalogue the icon picker searches and draws from: every
 * Lucide icon (ISC, lucide.dev) as its drawing and its English search words.
 * Lucide is read from the published `lucide-static` package, not installed:
 * the app only needs these two JSON files, fetched from public/ on demand.
 *
 *   node scripts/build-icon-catalog.mjs            # downloads lucide-static@VERSION
 *   node scripts/build-icon-catalog.mjs <package>  # an unpacked lucide-static folder
 *
 * Bump VERSION to take newer icons; names Lucide renames keep working only if
 * `frontend/app/lib/icons/icon-value.ts` maps the old name.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.83.0';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'frontend/public/icons/lucide');
const versionFile = join(root, 'frontend/app/lib/icons/lucide-version.ts');

function unpackedPackage() {
  if (process.argv[2]) {
    // The caller's folder is theirs to keep.
    return { dir: process.argv[2], cleanup: () => undefined };
  }
  const work = mkdtempSync(join(tmpdir(), 'lucide-static-'));
  execFileSync('npm', ['pack', `lucide-static@${VERSION}`, '--pack-destination', work], {
    stdio: 'ignore',
  });
  execFileSync('tar', ['xzf', join(work, `lucide-static-${VERSION}.tgz`), '-C', work]);
  return { dir: join(work, 'package'), cleanup: () => rmSync(work, { recursive: true }) };
}

const { dir, cleanup } = unpackedPackage();
try {
  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  const nodes = JSON.parse(readFileSync(join(dir, 'icon-nodes.json'), 'utf8'));
  const tags = JSON.parse(readFileSync(join(dir, 'tags.json'), 'utf8'));
  const names = Object.keys(nodes).sort();

  const drawings = Object.fromEntries(names.map(name => [name, nodes[name]]));
  // Search words that only repeat the name add nothing; keep the rest, lower-case.
  const words = Object.fromEntries(
    names.map(name => {
      const own = new Set(name.split('-'));
      const list = (tags[name] ?? [])
        .map(word => String(word).toLowerCase())
        .filter(word => !own.has(word));
      return [name, [...new Set(list)]];
    }),
  );

  // One folder per version: the files are cached for good, a new version is a new URL.
  rmSync(publicDir, { recursive: true, force: true });
  const outDir = join(publicDir, version);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'nodes.json'), `${JSON.stringify(drawings)}\n`);
  writeFileSync(join(outDir, 'tags.json'), `${JSON.stringify(words)}\n`);
  writeFileSync(
    join(outDir, 'LICENSE.txt'),
    `Lucide ${version}, https://lucide.dev\n\n${readFileSync(join(dir, 'LICENSE'), 'utf8')}`,
  );
  writeFileSync(
    versionFile,
    `// Written by scripts/build-icon-catalog.mjs: the Lucide release under public/icons/lucide/.\nexport const LUCIDE_VERSION = '${version}';\nexport const LUCIDE_ICON_COUNT = ${names.length};\n`,
  );
  console.log(`lucide-static ${version}: ${names.length} icons → ${outDir}`);
} finally {
  cleanup();
}
