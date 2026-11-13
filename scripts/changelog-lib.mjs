const COMMIT_TYPE_LABELS = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Improvements',
  refactor: 'Improvements',
  revert: 'Fixes',
  style: 'Improvements',
};

const IGNORED_TYPES = new Set(['build', 'chore', 'ci', 'docs', 'test']);

const SECTION_ORDER = ['Features', 'Improvements', 'Fixes', 'Other'];

const SUMMARY_ORDER = ['feature', 'improvement', 'fix', 'other update'];

const conventionalCommitPattern = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?: (?<description>.+)$/i;

const sentenceCase = value => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const formatDateLabel = isoDate => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
};

const pluralize = (count, noun) => {
  if (count === 1) {
    return `${count} ${noun}`;
  }

  if (noun.endsWith('x')) {
    return `${count} ${noun}es`;
  }

  return `${count} ${noun}s`;
};

const ignoredSubjectPatterns = [/^merge\b/i, /^revert\s+"merge\b/i];

const docsOnlyFilePattern = /^(README(?:\.[^.]+)?|docs\/|website\/|\.github\/FUNDING\.yml$)/i;

const isDocsOnlyCommit = commit => {
  if (!Array.isArray(commit.files) || commit.files.length === 0) {
    return false;
  }

  return commit.files.every(filePath => docsOnlyFilePattern.test(filePath));
};

const parseCommit = commit => {
  if (ignoredSubjectPatterns.some(pattern => pattern.test(commit.subject))) {
    return {
      description: sentenceCase(commit.subject),
      section: 'Other',
      scope: undefined,
      visible: false,
    };
  }

  const match = conventionalCommitPattern.exec(commit.subject);

  if (!match?.groups) {
    if (isDocsOnlyCommit(commit)) {
      return {
        description: sentenceCase(commit.subject),
        section: 'Other',
        scope: undefined,
        visible: false,
      };
    }

    return {
      description: sentenceCase(commit.subject),
      section: 'Other',
      scope: undefined,
      visible: true,
    };
  }

  const type = match.groups.type.toLowerCase();
  const scope = match.groups.scope?.trim();
  const description = sentenceCase(match.groups.description);

  if (IGNORED_TYPES.has(type)) {
    return {
      description,
      section: 'Other',
      scope,
      visible: false,
    };
  }

  return {
    description,
    section: COMMIT_TYPE_LABELS[type] ?? 'Other',
    scope,
    visible: true,
  };
};

const createBullet = item => {
  if (item.scope) {
    return `- **${item.scope}**: ${item.description}`;
  }

  return `- ${item.description}`;
};

const buildSummary = sectionCounts => {
  const summaryParts = [];

  for (const kind of SUMMARY_ORDER) {
    const count = sectionCounts[kind] ?? 0;
    if (count > 0) {
      summaryParts.push(pluralize(count, kind));
    }
  }

  if (summaryParts.length === 0) {
    return 'This release includes routine maintenance updates.';
  }

  if (summaryParts.length === 1) {
    return `This release includes ${summaryParts[0]}.`;
  }

  if (summaryParts.length === 2) {
    return `This release includes ${summaryParts[0]} and ${summaryParts[1]}.`;
  }

  const lastPart = summaryParts.at(-1);
  return `This release includes ${summaryParts.slice(0, -1).join(', ')}, and ${lastPart}.`;
};

const mapSectionToSummaryKey = section => {
  switch (section) {
    case 'Features':
      return 'feature';
    case 'Improvements':
      return 'improvement';
    case 'Fixes':
      return 'fix';
    default:
      return 'other update';
  }
};

const buildMarkdown = groupedEntries => {
  const sections = [];

  for (const section of SECTION_ORDER) {
    const items = groupedEntries[section] ?? [];
    if (items.length === 0) {
      continue;
    }

    sections.push(`## ${section}\n${items.map(createBullet).join('\n')}`);
  }

  if (sections.length === 0) {
    return '## Other\n- Routine maintenance updates.';
  }

  return sections.join('\n\n');
};

export const buildReleaseNotes = ({ branchName, commits, headSha, releaseDate }) => {
  const groupedEntries = {
    Features: [],
    Improvements: [],
    Fixes: [],
    Other: [],
  };
  const sectionCounts = {
    feature: 0,
    improvement: 0,
    fix: 0,
    'other update': 0,
  };

  for (const commit of commits) {
    const parsed = parseCommit(commit);
    if (!parsed.visible) {
      continue;
    }

    groupedEntries[parsed.section].push(parsed);
    sectionCounts[mapSectionToSummaryKey(parsed.section)] += 1;
  }

  const shortHeadSha = headSha.slice(0, 7);

  return {
    id: `changelog-${releaseDate.slice(0, 10)}-${shortHeadSha}`,
    version: `${branchName}-${shortHeadSha}`,
    branch: branchName,
    date: releaseDate,
    title: `Release update - ${formatDateLabel(releaseDate)}`,
    summary: buildSummary(sectionCounts),
    markdown: buildMarkdown(groupedEntries),
    commits,
  };
};

/**
 * The newest entry without its commit list, for `changelog-latest.json`: the app
 * reads that small file on every load to tell whether there is something new,
 * instead of the whole changelog with every commit's file list.
 */
export const latestEntry = entries => {
  let latest = null;
  for (const entry of entries) {
    if (!latest || Date.parse(entry.date) > Date.parse(latest.date)) {
      latest = entry;
    }
  }
  if (!latest) {
    return null;
  }
  const { commits: _commits, ...summary } = latest;
  return summary;
};
