#!/usr/bin/env node
// Keeps requests out of React components: they belong in a hook (hooks/) or an api
// module (lib/*-api.ts), so markup stays apart from data. A new .tsx file may not make
// a request; one that already does may be changed as long as it does not make more,
// so the old ones shrink as they are touched instead of freezing work on them.
//
//   node scripts/check-component-requests.mjs --staged       pre-commit
//   node scripts/check-component-requests.mjs --base <ref>   CI
import { fileURLToPath } from 'node:url';
import { changedFiles, isCommentOnly } from './check-file-size.mjs';

const COMPONENT = /^frontend\/app\/.*\.tsx$/;
const EXEMPT = [/\.test\.tsx$/, /^frontend\/app\/test\//, /^frontend\/app\/__tests__\//];

// apiClient.get(…), apiQuery(…), apiQueryDecoded(…), fetch(…), axios(…), payablesApi.list(…)
const REQUEST =
  /\b(?:apiClient\.(?:get|post|put|patch|delete|request)|apiQuery(?:Decoded)?|fetch|axios(?:\.\w+)?|\w+Api\.\w+)\s*\(/g;

export function isChecked(file) {
  return COMPONENT.test(file) && !EXEMPT.some(pattern => pattern.test(file));
}

/** Requests the source makes, comment-only lines aside. */
export function countRequests(source) {
  return source
    .split('\n')
    .filter(line => !isCommentOnly(line))
    .reduce((total, line) => total + (line.match(REQUEST)?.length ?? 0), 0);
}

/** Components that are new with a request, or make more than before: `[{ file, requests, before }]`. */
export function findRequests(cwd, options) {
  return changedFiles(cwd, options)
    .filter(({ file }) => isChecked(file))
    .map(({ file, befores, after }) => ({
      file,
      requests: countRequests(after),
      before: befores.length === 0 ? null : Math.max(...befores.map(countRequests)),
    }))
    .filter(({ requests, before }) => requests > (before ?? 0));
}

export function report(found) {
  const rows = found.map(({ file, requests, before }) =>
    before === null
      ? `  ${file}: ${requests} (new file)`
      : `  ${file}: ${requests} (was ${before}; it must not grow)`,
  );
  return [
    '✖ Move the request out of the component.',
    '',
    ...rows,
    '',
    'Put it in a hook (hooks/) or an api module (lib/*-api.ts) and keep the markup here.',
  ].join('\n');
}

function main(argv) {
  const staged = argv.includes('--staged');
  const baseIndex = argv.indexOf('--base');
  const base = baseIndex === -1 ? null : argv[baseIndex + 1];
  if (!(staged || base)) {
    console.error('Usage: check-component-requests.mjs --staged | --base <ref>');
    return 2;
  }
  const found = findRequests(process.cwd(), { staged, base });
  if (found.length === 0) {
    return 0;
  }
  console.error(report(found));
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
