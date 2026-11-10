import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, decide, effectiveTier, requiredLabels } from './review-gate.mjs';

test('docs, tests and tooling are low', () => {
  const files = [
    'website/docs/guides/mcp.md',
    'README.md',
    'backend/@tests/unit/modules/auth/auth.service.spec.ts',
    'frontend/app/lib/format-money.test.ts',
    'package-lock.json',
    'scripts/check-file-size.mjs',
  ];
  assert.deepEqual(classify(files), { tier: 'low', areas: [], ui: false });
  assert.deepEqual(decide(files, []).required, []);
});

test('app code is a feature and needs acceptance', () => {
  const backendOnly = decide(['backend/src/modules/goals/goals.service.ts'], []);
  assert.equal(backendOnly.tier, 'feature');
  assert.equal(backendOnly.ui, false);
  assert.deepEqual(backendOnly.missing, ['accepted']);

  const ui = decide(
    ['frontend/app/(main)/goals/page.tsx', 'packages/contracts/src/goals.ts'],
    ['accepted'],
  );
  assert.equal(ui.tier, 'feature');
  assert.equal(ui.ui, true);
  assert.deepEqual(ui.missing, []);
  assert.equal(classify(['Dockerfile']).tier, 'feature');
  assert.equal(classify(['docker-compose.dev.yml']).tier, 'feature');
});

test('each high area asks for its own label', () => {
  const cases = [
    ['backend/src/migrations/1788440000000-AddSmtpAccountMailUser.ts', 'db', 'db-approved'],
    ['backend/src/modules/payees/entities/payee.entity.ts', 'db', 'db-approved'],
    ['backend/src/data-source.ts', 'db', 'db-approved'],
    ['backend/src/modules/auth/auth.service.ts', 'auth', 'security-approved'],
    ['backend/src/common/guards/jwt-auth.guard.ts', 'auth', 'security-approved'],
    ['backend/src/common/authz/workspace-permissions.ts', 'auth', 'security-approved'],
    ['backend/src/modules/workspaces/roles/role.service.ts', 'auth', 'security-approved'],
    ['backend/src/common/utils/transaction-privacy.util.ts', 'auth', 'security-approved'],
    ['.github/workflows/ci.yml', 'process', 'security-approved'],
    ['scripts/review-gate.mjs', 'process', 'security-approved'],
    ['.claude/rules/review.md', 'process', 'security-approved'],
    ['.claude/agents/risk-reviewer.md', 'process', 'security-approved'],
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

test('a high change with UI also needs acceptance, one without does not', () => {
  const migration = 'backend/src/migrations/1788440000000-AddSmtpAccountMailUser.ts';
  assert.deepEqual(decide([migration], []).required, ['db-approved']);
  assert.deepEqual(
    decide([migration, 'frontend/app/integrations/panel/smtp-entry.tsx'], []).required,
    ['accepted', 'db-approved'],
  );
  assert.deepEqual(
    decide([migration, 'backend/src/modules/auth/auth.service.ts'], ['db-approved']).missing,
    ['security-approved'],
  );
});

test('tests inside a high area stay low', () => {
  assert.equal(classify(['backend/@tests/unit/migrations/add-smtp.migration.spec.ts']).tier, 'low');
  assert.equal(classify(['backend/src/modules/auth/auth.service.spec.ts']).tier, 'low');
});

test('look-alike paths are not high', () => {
  for (const file of [
    'backend/src/modules/authors/authors.service.ts',
    'backend/src/modules/taxonomy/taxonomy.service.ts',
    'frontend/app/lib/currency-picker.tsx',
    'docs/plans/review.md',
  ]) {
    assert.notEqual(classify([file]).tier, 'high', file);
  }
});

test('a risk label can raise the tier but never lower it', () => {
  assert.equal(effectiveTier('low', ['risk:high']), 'high');
  assert.equal(effectiveTier('high', ['risk:low']), 'high');
  assert.equal(effectiveTier('feature', ['bug', 'risk:unknown']), 'feature');

  const raised = decide(['README.md'], ['risk:high']);
  assert.equal(raised.tier, 'high');
  assert.deepEqual(raised.required, ['accepted']);

  const lowered = decide(['backend/src/data-source.ts'], ['risk:low']);
  assert.equal(lowered.riskLabel, 'risk:high');
  assert.deepEqual(lowered.staleRiskLabels, ['risk:low']);
});

test('requiredLabels has no duplicates', () => {
  assert.deepEqual(requiredLabels('high', ['auth', 'process'], false), ['security-approved']);
  assert.deepEqual(requiredLabels('high', ['money'], true), ['accepted']);
  assert.deepEqual(requiredLabels('low', [], true), []);
});
