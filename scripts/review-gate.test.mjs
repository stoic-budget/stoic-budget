import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, decide, RAISE_LABEL, requiredLabels, trustedLabels } from './review-gate.mjs';

const MIGRATION = 'backend/src/migrations/1788440000000-AddSmtpAccountMailUser.ts';
const SERVICE = 'backend/src/modules/goals/goals.service.ts';

test('docs, tests and the low whitelist are low', () => {
  const files = [
    'website/docs/guides/mcp.md',
    'docs/plans/2026-11-11-review-process-design.md',
    'README.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    'backend/@tests/unit/modules/goals/goals.service.spec.ts',
    'frontend/app/lib/__tests__/receipt-merchant.test.ts',
    'backend/golden/expected/bank.json',
  ];
  assert.deepEqual(decide(files, []).required, []);
  assert.equal(classify(files).tier, 'low');
});

test('anything off the whitelist is at least a feature', () => {
  for (const file of [
    SERVICE,
    'frontend/app/(main)/goals/page.tsx',
    'frontend/components/ui/Button.tsx',
    'frontend/next.config.mjs',
    'frontend/public/sw.js',
    'packages/contracts/src/goals.ts',
    'backend/entrypoint.sh',
    'infra/parser-submissions/src/index.ts',
    'Makefile',
    'Dockerfile',
    'docker-compose.dev.yml',
    'scripts/sync-contracts.mjs',
    '.entire/settings.json',
    'website/sidebars.ts',
    'website/docusaurus.config.ts',
    'website/src/pages/index.tsx',
    'website/package.json',
  ]) {
    const result = decide([file], []);
    assert.equal(result.tier, 'feature', file);
    assert.deepEqual(result.missing, ['accepted'], file);
  }
});

test('deleting a test is not low', () => {
  const file = 'backend/@tests/e2e/auth.e2e-spec.ts';
  assert.equal(classify([file]).tier, 'low');
  assert.equal(classify([file], { removed: [file] }).tier, 'feature');
  assert.deepEqual(decide([file], [], { removed: [file] }).missing, ['accepted']);
});

test('dependency manifests are low only from Dependabot', () => {
  const files = ['frontend/package.json', 'frontend/package-lock.json'];
  assert.equal(classify(files, { author: 'dependabot[bot]' }).tier, 'low');
  assert.equal(classify(files, { author: 'member-1' }).tier, 'feature');
  assert.equal(classify(files).tier, 'feature');
});

test('each high area asks for its own label', () => {
  const cases = [
    [MIGRATION, 'db', 'db-approved'],
    ['backend/src/modules/payees/entities/payee.entity.ts', 'db', 'db-approved'],
    ['backend/src/modules/entities/x.entity.ts', 'db', 'db-approved'],
    ['backend/src/data-source.ts', 'db', 'db-approved'],
    ['backend/src/config/database.config.ts', 'db', 'db-approved'],
    ['backend/scripts/run-migrations.ts', 'db', 'db-approved'],
    ['backend/src/modules/auth/auth.service.ts', 'auth', 'security-approved'],
    ['backend/src/modules/api-keys/api-key-scopes.ts', 'auth', 'security-approved'],
    ['backend/src/common/guards/jwt-auth.guard.ts', 'auth', 'security-approved'],
    ['backend/src/modules/mcp/mcp-access.guard.ts', 'auth', 'security-approved'],
    ['backend/src/modules/webhooks/guards/webhook-token.guard.ts', 'auth', 'security-approved'],
    ['backend/src/common/authz/workspace-permissions.ts', 'auth', 'security-approved'],
    ['backend/src/common/enums/permissions.enum.ts', 'auth', 'security-approved'],
    ['backend/src/modules/users/services/permissions.service.ts', 'auth', 'security-approved'],
    ['backend/src/permissions/x.ts', 'auth', 'security-approved'],
    ['backend/src/modules/workspaces/roles/role.service.ts', 'auth', 'security-approved'],
    ['backend/src/common/utils/transaction-privacy.util.ts', 'auth', 'security-approved'],
    ['backend/src/common/utils/password-hash.util.ts', 'auth', 'security-approved'],
    ['frontend/proxy.ts', 'auth', 'security-approved'],
    ['.github/workflows/ci.yml', 'process', 'security-approved'],
    ['.github/actions/e2e/action.yml', 'process', 'security-approved'],
    ['scripts/review-gate.mjs', 'process', 'security-approved'],
    ['scripts/check-file-size.mjs', 'process', 'security-approved'],
    ['infra/policy/github-actions/workflows.rego', 'process', 'security-approved'],
    ['.husky/pre-commit', 'process', 'security-approved'],
    ['.gitleaksignore', 'process', 'security-approved'],
    ['CLAUDE.md', 'process', 'security-approved'],
    ['.claude/rules/security.md', 'process', 'security-approved'],
    ['.claude/agents/risk-reviewer.md', 'process', 'security-approved'],
    ['.claude/settings.json', 'process', 'security-approved'],
    ['.claude/skills/brainstorm/SKILL.md', 'process', 'security-approved'],
    ['.claude/commands/ship.md', 'process', 'security-approved'],
    ['.agents/skills/teach/SKILL.md', 'process', 'security-approved'],
    ['backend/src/common/utils/money.util.ts', 'money', 'accepted'],
    ['backend/src/modules/exchange-rates/exchange-rates.service.ts', 'money', 'accepted'],
    ['backend/src/modules/tax-pack/tax-pack.service.ts', 'money', 'accepted'],
    ['frontend/app/lib/format-money.ts', 'money', 'accepted'],
  ];
  for (const [file, area, label] of cases) {
    const result = decide([file], []);
    assert.equal(result.tier, 'high', file);
    assert.deepEqual(result.areas, [area], file);
    assert.ok(result.required.includes(label), `${file} needs ${label}`);
  }
});

test('a test file inside a high area still counts', () => {
  for (const file of [
    'backend/src/migrations/1799999999999-Drop.spec.ts',
    'backend/src/entities/__tests__/x.ts',
    'backend/src/modules/auth/auth.guard.spec.ts',
    'backend/src/common/decorators/x.e2e-spec.ts',
  ]) {
    assert.equal(classify([file]).tier, 'high', file);
  }
  assert.equal(classify(['backend/@tests/unit/migrations/add-smtp.migration.spec.ts']).tier, 'low');
});

test('app code in a high pull request always needs acceptance too', () => {
  assert.deepEqual(decide([SERVICE], []).required, ['accepted']);
  assert.deepEqual(decide([SERVICE, MIGRATION], []).required, ['accepted', 'db-approved']);
  assert.deepEqual(decide([MIGRATION], []).required, ['accepted', 'db-approved']);
  assert.deepEqual(
    decide([MIGRATION, 'backend/src/modules/auth/auth.service.ts'], ['accepted', 'db-approved'])
      .missing,
    ['security-approved'],
  );
});

test('a change to the review process alone needs only security-approved', () => {
  const files = [
    '.github/workflows/review-gate.yml',
    'scripts/review-gate.mjs',
    'scripts/review-gate.test.mjs',
    '.claude/rules/review.md',
    'CLAUDE.md',
    'website/docs/contributing/reviewing.md',
  ];
  assert.deepEqual(decide(files, []).required, ['security-approved']);
});

test('look-alike paths are not high', () => {
  for (const file of [
    'backend/src/modules/authors/authors.service.ts',
    'backend/src/modules/taxonomy/taxonomy.service.ts',
    'backend/src/modules/goals/guardrail.ts',
    'frontend/app/lib/currency-picker.tsx',
    'docs/plans/review.md',
    'scripts/checker.mjs',
  ]) {
    assert.notEqual(classify([file]).tier, 'high', file);
  }
});

test('the raise label makes any pull request high; risk labels follow the paths', () => {
  const raised = decide(['README.md'], [RAISE_LABEL]);
  assert.equal(raised.tier, 'high');
  assert.deepEqual(raised.required, ['accepted']);

  // The gate's own label never holds the tier up after the paths change.
  const reverted = decide(['README.md'], ['risk:feature']);
  assert.equal(reverted.tier, 'low');
  assert.equal(reverted.riskLabel, 'risk:low');
  assert.deepEqual(reverted.staleRiskLabels, ['risk:feature']);

  assert.equal(decide(['backend/src/data-source.ts'], ['risk:low']).tier, 'high');
});

test('requiredLabels has no duplicates', () => {
  assert.deepEqual(requiredLabels('high', ['auth', 'process'], false), ['security-approved']);
  assert.deepEqual(requiredLabels('high', ['money'], true), ['accepted']);
  assert.deepEqual(requiredLabels('low', [], true), []);
});

test('an approval label counts only when an approver added it last', () => {
  const labeled = (name, login) => ({ event: 'labeled', label: { name }, actor: { login } });
  const labels = ['accepted', 'db-approved', 'risk:high', 'enhancement'];
  const events = [
    labeled('accepted', 'symonbaikov'),
    labeled('db-approved', 'symonbaikov'),
    { event: 'unlabeled', label: { name: 'db-approved' }, actor: { login: 'symonbaikov' } },
    labeled('db-approved', 'agent-account'),
    labeled('risk:high', 'github-actions[bot]'),
  ];
  const { trusted, ignored } = trustedLabels(labels, events, ['symonbaikov']);
  assert.deepEqual(trusted, ['accepted', 'risk:high', 'enhancement']);
  assert.deepEqual(ignored, [{ label: 'db-approved', by: 'agent-account' }]);

  // No event at all (e.g. events not readable): the label is not trusted.
  assert.deepEqual(trustedLabels(['security-approved'], [], ['symonbaikov']).trusted, []);
  assert.deepEqual(
    decide(
      [MIGRATION],
      trustedLabels(
        ['accepted', 'db-approved'],
        [labeled('accepted', 'symonbaikov'), labeled('db-approved', 'agent-account')],
        ['symonbaikov'],
      ).trusted,
    ).missing,
    ['db-approved'],
  );
});
