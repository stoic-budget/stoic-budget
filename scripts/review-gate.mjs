// Risk tier of a pull request from the files it changes, and the labels it needs before
// it may merge. The review gate (.github/workflows/review-gate.yml) runs this file from
// the base branch, so a pull request cannot loosen its own gate.
// The process: website/docs/contributing/reviewing.md.

export const TIERS = ['low', 'feature', 'high'];

// Only the maintainer sets these; agents and assistants never do.
export const LABELS = {
  accepted: 'accepted',
  db: 'db-approved',
  security: 'security-approved',
};

const TEST_FILE = /(^|\/)(@tests|__tests__|e2e)\/|\.(test|spec|e2e-spec)\.[cm]?[jt]sx?$/;

// Areas where a mistake costs data, money or access. Each names the label it needs.
export const HIGH_AREAS = [
  {
    area: 'db',
    label: LABELS.db,
    pattern:
      /^backend\/(src\/migrations\/|migrations\/|src\/entities\/|src\/modules\/.+\/entities\/|src\/data-source\.ts$)/,
  },
  {
    area: 'auth',
    label: LABELS.security,
    pattern:
      /^backend\/src\/(modules\/auth\/|common\/(guards|decorators|authz|workspaces)\/|common\/utils\/transaction-privacy\.util\.ts$|.*\/(permissions|roles)\/)/,
  },
  {
    // Whoever changes CI or the review rules can switch the checks off.
    area: 'process',
    label: LABELS.security,
    pattern:
      /^(\.github\/(workflows|actions)\/|scripts\/review-gate\.mjs$|\.claude\/rules\/review\.md$|\.claude\/agents\/)/,
  },
  {
    // Where sums, currencies and counted rows are worked out once for the whole app.
    area: 'money',
    label: LABELS.accepted,
    pattern:
      /^(backend\/src\/common\/utils\/(counted-transactions|currency|money|receipt-amount)\.util\.ts$|backend\/src\/modules\/(exchange-rates|balance|ledger|net-worth|tax|income-tax|tax-pack|datev)\/|frontend\/app\/lib\/(currency|format-money|useCurrencyConversion)\.ts$)/,
  },
];

const FEATURE =
  /^(frontend\/app\/|backend\/src\/|packages\/contracts\/src\/|scripts\/(start|docker-start)\.sh$)|(^|\/)Dockerfile$|^docker-compose[^/]*\.ya?ml$/;

const UI = /^frontend\/app\//;

const isTest = file => TEST_FILE.test(file) && !/^\.github\//.test(file);

/** The tier the paths alone call for, the high areas touched, and whether there is UI. */
export function classify(files) {
  const code = files.filter(file => !isTest(file));
  const areas = HIGH_AREAS.filter(({ pattern }) => code.some(file => pattern.test(file))).map(
    ({ area }) => area,
  );
  const feature = code.some(file => FEATURE.test(file));
  const ui = code.some(file => UI.test(file));
  let tier = 'low';
  if (areas.length) {
    tier = 'high';
  } else if (feature) {
    tier = 'feature';
  }
  return { tier, areas, ui };
}

const rank = tier => TIERS.indexOf(tier);

/**
 * The tier that applies: the paths set the floor, a `risk:*` label already on the pull
 * request may raise it. Removing that label is how a raised tier comes back down.
 */
export function effectiveTier(pathTier, labels) {
  const raised = labels.filter(label => label.startsWith('risk:')).map(label => label.slice(5));
  return [pathTier, ...raised].reduce((top, tier) => (rank(tier) > rank(top) ? tier : top));
}

/** Labels the pull request needs for its tier and areas. */
export function requiredLabels(tier, areas, ui) {
  const required = new Set();
  if (tier === 'feature') {
    required.add(LABELS.accepted);
  }
  if (tier === 'high') {
    for (const { label } of HIGH_AREAS.filter(({ area }) => areas.includes(area))) {
      required.add(label);
    }
    if (ui || !areas.length) {
      required.add(LABELS.accepted);
    }
  }
  return [...required].sort();
}

/** Everything the gate decides, from the changed files and the labels on the pull request. */
export function decide(files, labels) {
  const { tier: pathTier, areas, ui } = classify(files);
  const tier = effectiveTier(pathTier, labels);
  const required = requiredLabels(tier, areas, ui);
  const missing = required.filter(label => !labels.includes(label));
  const riskLabel = `risk:${tier}`;
  const staleRiskLabels = labels.filter(label => label.startsWith('risk:') && label !== riskLabel);
  return { tier, pathTier, areas, ui, required, missing, riskLabel, staleRiskLabels };
}
