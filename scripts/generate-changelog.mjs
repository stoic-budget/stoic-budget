#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { buildReleaseNotes, latestEntry } from './changelog-lib.mjs';

const execFileAsync = promisify(execFile);

const CHANGELOG_PATH = process.env.CHANGELOG_PATH ?? 'frontend/public/changelog.json';
const LATEST_PATH = process.env.CHANGELOG_LATEST_PATH ?? 'frontend/public/changelog-latest.json';
const MIN_COMMITS = Number(process.env.CHANGELOG_MIN_COMMITS ?? '5');
const BRANCH_NAME = process.env.GITHUB_REF_NAME ?? process.env.BRANCH_NAME ?? 'local';

if (!Number.isFinite(MIN_COMMITS) || MIN_COMMITS < 1) {
  throw new Error('CHANGELOG_MIN_COMMITS must be a positive integer');
}

const DEFAULT_CHANGELOG = {
  meta: {
    lastProcessedCommitByBranch: {},
  },
  entries: [],
};

const git = async (...args) => {
  const { stdout } = await execFileAsync('git', args, {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
};

const gitCanRun = async (...args) => {
  try {
    await execFileAsync('git', args);
    return true;
  } catch {
    return false;
  }
};

const readChangelog = async () => {
  try {
    const raw = await readFile(CHANGELOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      meta: {
        ...DEFAULT_CHANGELOG.meta,
        ...(parsed.meta ?? {}),
        lastProcessedCommitByBranch: {
          ...DEFAULT_CHANGELOG.meta.lastProcessedCommitByBranch,
          ...(parsed.meta?.lastProcessedCommitByBranch ?? {}),
        },
      },
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return DEFAULT_CHANGELOG;
  }
};

const writeChangelog = async changelog => {
  await writeFile(CHANGELOG_PATH, `${JSON.stringify(changelog, null, 2)}\n`, 'utf8');
  const latest = { entry: latestEntry(changelog.entries) };
  await writeFile(LATEST_PATH, `${JSON.stringify(latest, null, 2)}\n`, 'utf8');
};

const getCommitDetails = async sha => {
  const delimiter = '\u001f';
  const output = await git(
    'show',
    '-s',
    '--date=iso-strict',
    `--format=%H${delimiter}%h${delimiter}%s${delimiter}%an${delimiter}%ad`,
    sha,
  );
  const filesOutput = await git('show', '--pretty=format:', '--name-only', sha);

  const [fullSha, shortSha, subject, author, date] = output.split(delimiter);
  return {
    sha: fullSha,
    shortSha,
    subject,
    author,
    date,
    files: filesOutput
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean),
  };
};

const main = async () => {
  const changelog = await readChangelog();
  const headSha = await git('rev-parse', 'HEAD');
  const previousSha = changelog.meta.lastProcessedCommitByBranch[BRANCH_NAME];

  if (!previousSha) {
    changelog.meta.lastProcessedCommitByBranch[BRANCH_NAME] = headSha;
    changelog.meta.initializedAt = new Date().toISOString();
    await writeChangelog(changelog);
    console.log(`Initialized changelog tracking for branch "${BRANCH_NAME}" at ${headSha}`);
    return;
  }

  const isAncestor = await gitCanRun('merge-base', '--is-ancestor', previousSha, headSha);
  if (!isAncestor) {
    changelog.meta.lastProcessedCommitByBranch[BRANCH_NAME] = headSha;
    changelog.meta.lastRecoveryAt = new Date().toISOString();
    await writeChangelog(changelog);
    console.log('Commit history was rewritten. Tracking pointer has been reset.');
    return;
  }

  const range = `${previousSha}..${headSha}`;
  const shaList = await git('rev-list', '--reverse', range);
  const pendingShas = shaList
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (pendingShas.length < MIN_COMMITS) {
    console.log(
      `Skipping changelog generation: ${pendingShas.length}/${MIN_COMMITS} commits accumulated since ${previousSha.slice(0, 7)}.`,
    );
    return;
  }

  const commits = [];
  for (const sha of pendingShas) {
    commits.push(await getCommitDetails(sha));
  }

  const now = new Date().toISOString();
  const entry = buildReleaseNotes({
    branchName: BRANCH_NAME,
    commits,
    headSha,
    releaseDate: now,
  });

  changelog.entries = [entry, ...changelog.entries];
  changelog.meta.lastProcessedCommitByBranch[BRANCH_NAME] = headSha;
  changelog.meta.lastGeneratedAt = now;
  changelog.meta.minCommits = MIN_COMMITS;

  await writeChangelog(changelog);
  console.log(`Generated changelog entry from ${commits.length} commits.`);
};

await main();
