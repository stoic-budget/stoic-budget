import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReleaseNotes, latestEntry } from './changelog-lib.mjs';

test('buildReleaseNotes groups commits into user-facing sections', () => {
  const releaseDate = '2026-04-01T12:00:00.000Z';
  const commits = [
    {
      sha: '1111111111111111111111111111111111111111',
      shortSha: '1111111',
      subject: 'feat(auth): add passwordless sign in',
      author: 'Dev',
      date: releaseDate,
    },
    {
      sha: '2222222222222222222222222222222222222222',
      shortSha: '2222222',
      subject: 'fix(frontend): stop modal flicker',
      author: 'Dev',
      date: releaseDate,
    },
    {
      sha: '3333333333333333333333333333333333333333',
      shortSha: '3333333',
      subject: 'refactor(seed): simplify demo bootstrap',
      author: 'Dev',
      date: releaseDate,
    },
    {
      sha: '4444444444444444444444444444444444444444',
      shortSha: '4444444',
      subject: 'chore(ci): update workflow cache',
      author: 'Dev',
      date: releaseDate,
    },
    {
      sha: '5555555555555555555555555555555555555555',
      shortSha: '5555555',
      subject: 'update dashboard filters',
      author: 'Dev',
      date: releaseDate,
    },
  ];

  const entry = buildReleaseNotes({
    branchName: 'main',
    commits,
    headSha: 'abcdef0123456789',
    releaseDate,
  });

  assert.equal(entry.id, 'changelog-2026-04-01-abcdef0');
  assert.equal(entry.title, 'Release update - April 1, 2026');
  assert.equal(entry.version, 'main-abcdef0');
  assert.equal(
    entry.summary,
    'This release includes 1 feature, 1 improvement, 1 fix, and 1 other update.',
  );
  assert.match(entry.markdown, /## Features/);
  assert.match(entry.markdown, /- \*\*auth\*\*: Add passwordless sign in/);
  assert.match(entry.markdown, /## Improvements/);
  assert.match(entry.markdown, /- \*\*seed\*\*: Simplify demo bootstrap/);
  assert.match(entry.markdown, /## Fixes/);
  assert.match(entry.markdown, /- \*\*frontend\*\*: Stop modal flicker/);
  assert.match(entry.markdown, /## Other/);
  assert.match(entry.markdown, /- Update dashboard filters/);
  assert.doesNotMatch(entry.markdown, /workflow cache/);
});

test('buildReleaseNotes keeps non-conventional commits visible when they are the only updates', () => {
  const releaseDate = '2026-04-02T08:15:00.000Z';
  const commits = [
    {
      sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shortSha: 'aaaaaaa',
      subject: 'update dashboard widgets',
      author: 'Dev',
      date: releaseDate,
    },
    {
      sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      shortSha: 'bbbbbbb',
      subject: 'update login page',
      author: 'Dev',
      date: releaseDate,
    },
    {
      sha: 'cccccccccccccccccccccccccccccccccccccccc',
      shortSha: 'ccccccc',
      subject: 'docs(readme): refresh setup guide',
      author: 'Dev',
      date: releaseDate,
    },
  ];

  const entry = buildReleaseNotes({
    branchName: 'staging',
    commits,
    headSha: '1234567890abcdef',
    releaseDate,
  });

  assert.equal(entry.summary, 'This release includes 2 other updates.');
  assert.doesNotMatch(entry.markdown, /## Features/);
  assert.doesNotMatch(entry.markdown, /## Improvements/);
  assert.doesNotMatch(entry.markdown, /## Fixes/);
  assert.match(entry.markdown, /## Other/);
  assert.match(entry.markdown, /- Update dashboard widgets/);
  assert.match(entry.markdown, /- Update login page/);
  assert.doesNotMatch(entry.markdown, /setup guide/);
});

test('buildReleaseNotes skips merge and docs-only commits from user-facing output', () => {
  const releaseDate = '2026-04-03T09:30:00.000Z';
  const commits = [
    {
      sha: 'dddddddddddddddddddddddddddddddddddddddd',
      shortSha: 'ddddddd',
      subject: 'Merge branch main into staging',
      author: 'Dev',
      date: releaseDate,
      files: ['frontend/app/page.tsx'],
    },
    {
      sha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      shortSha: 'eeeeeee',
      subject: 'Update README.md',
      author: 'Dev',
      date: releaseDate,
      files: ['README.md'],
    },
    {
      sha: 'ffffffffffffffffffffffffffffffffffffffff',
      shortSha: 'fffffff',
      subject: 'feat(reports): add exports dashboard',
      author: 'Dev',
      date: releaseDate,
      files: ['frontend/app/(main)/reports/page.tsx'],
    },
    {
      sha: '9999999999999999999999999999999999999999',
      shortSha: '9999999',
      subject: 'fix(auth): resolve session refresh race',
      author: 'Dev',
      date: releaseDate,
      files: ['backend/src/modules/auth/auth.service.ts'],
    },
  ];

  const entry = buildReleaseNotes({
    branchName: 'main',
    commits,
    headSha: 'fedcba9876543210',
    releaseDate,
  });

  assert.equal(entry.summary, 'This release includes 1 feature and 1 fix.');
  assert.match(entry.markdown, /- \*\*reports\*\*: Add exports dashboard/);
  assert.match(entry.markdown, /- \*\*auth\*\*: Resolve session refresh race/);
  assert.doesNotMatch(entry.markdown, /README/);
  assert.doesNotMatch(entry.markdown, /Merge branch/);
});

test('latestEntry picks the newest entry by date and leaves its commits out', () => {
  const entry = (id, date) => ({ id, date, title: id, markdown: '', commits: [{ sha: id }] });
  const entries = [
    entry('changelog-2026-04-01-1111111', '2026-04-01T12:00:00.000Z'),
    entry('changelog-2026-04-03-3333333', '2026-04-03T08:00:00.000Z'),
    entry('changelog-2026-04-02-2222222', '2026-04-02T12:00:00.000Z'),
  ];

  const latest = latestEntry(entries);

  assert.equal(latest.id, 'changelog-2026-04-03-3333333');
  assert.equal('commits' in latest, false);
  assert.equal(latestEntry([]), null);
});
