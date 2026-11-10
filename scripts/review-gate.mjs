// Risk tier of a pull request from the files it changes, and the labels it needs before
// it may merge. .github/workflows/review-gate.yml runs on pull_request_target, so both the
// workflow and this file always come from the base branch: a pull request cannot change
// the rules it is judged by. The process: website/docs/contributing/reviewing.md.

export const TIERS = ['low', 'feature', 'high'];

// Only the maintainer sets these; agents and assistants never do.
export const LABELS = {
  accepted: 'accepted',
  db: 'db-approved',
  security: 'security-approved',
};

// The author asks for the risk reviewer: the tier becomes high whatever the paths say.
export const RAISE_LABEL = 'risk-review';

const TEST_FILE =
  /(^|\/)(@tests|__tests__)\/|\.(test|spec|e2e-spec)\.[cm]?[jt]sx?$|^backend\/golden\//;

// Areas where a mistake costs data, money or access. Each names the label it needs. A test
// file inside one still counts: a migration named *.spec.ts is compiled and run like any other.
export const HIGH_AREAS = [
  {
    area: 'db',
    label: LABELS.db,
    pattern:
      /^backend\/(src\/migrations\/|migrations\/|src\/entities\/|src\/modules\/(.+\/)?entities\/|src\/data-source\.ts$|src\/config\/database\.config\.ts$|scripts\/run-migrations)/,
  },
  {
    area: 'auth',
    label: LABELS.security,
    pattern:
      /^backend\/src\/(modules\/(auth|api-keys)\/|common\/(guards|decorators|authz|workspaces)\/|common\/utils\/(transaction-privacy|password-hash)\.util\.ts$|common\/enums\/permissions\.enum\.ts$|modules\/users\/services\/permissions\.|(.+\/)?(permissions|roles)\/|.+\.guard\.ts$)|^frontend\/proxy\.ts$/,
  },
  {
    // What switches checks off or steers the agents that write and review code.
    area: 'process',
    label: LABELS.security,
    pattern:
      /^(\.github\/(workflows|actions)\/|\.github\/CODEOWNERS$|scripts\/(review-gate|check-[^/]+)\.(test\.)?mjs$|infra\/policy\/|\.husky\/|\.gitleaksignore$|CLAUDE\.md$|AGENTS\.md$|\.claude\/(rules|agents)\/|\.claude\/settings[^/]*\.json$)/,
  },
  {
    // Where sums, currencies and counted rows are worked out once for the whole app.
    area: 'money',
    label: LABELS.accepted,
    pattern:
      /^(backend\/src\/common\/utils\/(counted-transactions|currency|money|receipt-amount)\.util\.ts$|backend\/src\/modules\/(exchange-rates|balance|ledger|net-worth|tax|income-tax|tax-pack|datev)\/|frontend\/app\/lib\/(currency|format-money|useCurrencyConversion)\.ts$)/,
  },
];

// Low is a whitelist: anything not listed here, and not high, is at least a feature.
const LOW =
  /^(docs|website|\.agents|\.claude\/skills)\/|\.md$|^\.github\/(ISSUE_TEMPLATE\/|PULL_REQUEST_TEMPLATE\.md$|FUNDING\.yml$|dependabot\.yml$)|^(LICENSE|\.gitignore|\.env\.example|\.mcp\.json\.example|\.jscpd\.json|knip\.json|sonar-project\.properties)$/;

// Dependency updates are low only from Dependabot (dependency-review checks them); a person
// adding a package is a feature.
const MANIFEST = /(^|\/)package(-lock)?\.json$/;
const DEPENDABOT = 'dependabot[bot]';

const UI = /^frontend\/(app|components)\//;

const isLow = (file, author) =>
  TEST_FILE.test(file) || LOW.test(file) || (author === DEPENDABOT && MANIFEST.test(file));

/**
 * The tier the paths alone call for, the high areas touched, whether app code beyond the
 * review process changes, and whether there is UI.
 */
export function classify(files, { author = '' } = {}) {
  const areas = HIGH_AREAS.filter(({ pattern }) => files.some(file => pattern.test(file))).map(
    ({ area }) => area,
  );
  const process = HIGH_AREAS.find(({ area }) => area === 'process').pattern;
  const code = files.some(file => !(isLow(file, author) || process.test(file)));
  const ui = files.some(file => UI.test(file) && !TEST_FILE.test(file));
  let tier = 'low';
  if (areas.length) {
    tier = 'high';
  } else if (files.some(file => !isLow(file, author))) {
    tier = 'feature';
  }
  return { tier, areas, code, ui };
}

/** Labels the pull request needs for its tier and areas. */
export function requiredLabels(tier, areas, code) {
  const required = new Set();
  if (tier === 'feature') {
    required.add(LABELS.accepted);
  }
  if (tier === 'high') {
    for (const { label } of HIGH_AREAS.filter(({ area }) => areas.includes(area))) {
      required.add(label);
    }
    // A migration or an auth change never takes away the acceptance a behaviour change needs.
    if (code || !areas.length) {
      required.add(LABELS.accepted);
    }
  }
  return [...required].sort();
}

/** Everything the gate decides, from the changed files and the labels on the pull request. */
export function decide(files, labels, { author = '' } = {}) {
  const { tier: pathTier, areas, code, ui } = classify(files, { author });
  const tier = labels.includes(RAISE_LABEL) ? 'high' : pathTier;
  const required = requiredLabels(tier, areas, code);
  const missing = required.filter(label => !labels.includes(label));
  const riskLabel = `risk:${tier}`;
  const staleRiskLabels = labels.filter(label => label.startsWith('risk:') && label !== riskLabel);
  return { tier, pathTier, areas, code, ui, required, missing, riskLabel, staleRiskLabels };
}
