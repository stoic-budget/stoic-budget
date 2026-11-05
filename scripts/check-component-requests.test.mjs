import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { countRequests, findRequests, isChecked, report } from './check-component-requests.mjs';

const OLD = 'frontend/app/components/Old.tsx';
const NEW = 'frontend/app/components/New.tsx';
const request = 'apiClient.get(`/rows`);\n';

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'component-requests-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'member-1@example.com');
  git('config', 'user.name', 'Member One');
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  write(OLD, request.repeat(2));
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  return { root, git, write };
}

test('counts every way a component reaches the server', () => {
  for (const line of [
    "apiClient.post('/rows', body)",
    'apiQuery({ url })',
    "apiQueryDecoded({ url, contract: 'Rows' })",
    'await fetch(url)',
    'axios.get(url)',
    'payablesApi.list(params)',
  ]) {
    assert.equal(countRequests(line), 1, line);
  }
});

test('does not count hooks, refetch, comments or a mention without a call', () => {
  for (const line of [
    'useRows()',
    'refetch()',
    'query.refetch()',
    '// apiClient.get(url) used to live here',
    ' * fetch(url) is not called from here',
    'import apiClient from "@/app/lib/api";',
  ]) {
    assert.equal(countRequests(line), 0, line);
  }
});

test('checks components but not tests or plain modules', () => {
  assert.equal(isChecked(OLD), true);
  assert.equal(isChecked('frontend/app/components/Old.test.tsx'), false);
  assert.equal(isChecked('frontend/app/test/query-wrapper.tsx'), false);
  assert.equal(isChecked('frontend/app/hooks/useRows.ts'), false);
  assert.equal(isChecked('website/src/pages/index.tsx'), false);
});

test('refuses a new component that makes a request, lets a clean one in', () => {
  const { root, git, write } = makeRepo();
  write(NEW, 'export const Clean = () => null;\n');
  git('add', '-A');
  assert.deepEqual(findRequests(root, { staged: true }), []);

  write(NEW, request);
  git('add', '-A');
  assert.deepEqual(findRequests(root, { staged: true }), [
    { file: NEW, requests: 1, before: null },
  ]);
});

test('lets an old component change while it makes no more requests', () => {
  const { root, git, write } = makeRepo();
  write(OLD, request.repeat(2).concat('export const label = 1;\n'));
  git('add', '-A');
  assert.deepEqual(findRequests(root, { staged: true }), []);

  write(OLD, request);
  git('add', '-A');
  assert.deepEqual(findRequests(root, { staged: true }), []);

  write(OLD, request.repeat(3));
  git('add', '-A');
  assert.deepEqual(findRequests(root, { staged: true }), [{ file: OLD, requests: 3, before: 2 }]);
});

test('a rename keeps its allowance; a request carried to a new file does not', () => {
  const { root, git, write } = makeRepo();
  git('mv', OLD, NEW);
  assert.deepEqual(findRequests(root, { staged: true }), []);
  git('mv', NEW, OLD);

  write(OLD, 'export const Empty = () => null;\n');
  write(NEW, request);
  git('add', '-A');
  assert.deepEqual(findRequests(root, { staged: true }), [
    { file: NEW, requests: 1, before: null },
  ]);
});

test('compares a branch with its merge base in CI', () => {
  const { root, git, write } = makeRepo();
  git('checkout', '-q', '-b', 'feature');
  write(OLD, request.repeat(3));
  git('add', '-A');
  git('commit', '-q', '-m', 'more requests');

  assert.deepEqual(findRequests(root, { base: 'main' }), [{ file: OLD, requests: 3, before: 2 }]);
});

test('says where the request should go', () => {
  const text = report([{ file: NEW, requests: 1, before: null }]);
  assert.match(text, /Move the request out of the component/);
  assert.match(text, /New\.tsx: 1 \(new file\)/);
  assert.match(text, /hooks\//);
});
