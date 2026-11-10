---
title: CI/CD Pipeline
description: Continuous integration and release publishing
---

Stoic Budget's pipelines live in `.github/workflows`.

## CI pipeline

`ci.yml` runs on pull requests and on pushes to `main` and `develop`:

- `policy-as-code` - Conftest policies for the Compose files and workflows
- `shellcheck`, `hadolint`, `trivy-config` - shell script, Dockerfile, and config scanning
- `lint` - Biome for both apps
- `typecheck` - TypeScript checks for both apps
- `tests` - backend unit + e2e tests against PostgreSQL 16 and Redis 7, with migrations applied twice to check
  idempotency
- `frontend-tests` - frontend Vitest tests, when frontend code changes
- `sonarcloud` - static analysis with the backend coverage report
- `build` - frontend and backend production builds
- `dependency-scan` - npm audits and license checks for every package
- `secrets-scan` - Gitleaks
- `docker` - image build with a Trivy scan and SBOM

## Review gate

`review-gate.yml` runs on every pull request, again whenever its code, base or labels change. It gives the pull
request a risk tier from the files it changes (`risk:low`, `risk:feature` or `risk:high`) and posts the commit
status `review-gate`, which fails until the labels that tier needs are set:

- `accepted` for a feature, and for a high-risk change that also changes app code or touches the money code
- `db-approved` for migrations, entities, the database config and the migration runner
- `security-approved` for auth, API keys, guards, decorators, permissions and roles; CI workflows, the repository
  guards and policies, git hooks, and the rules and settings that steer coding agents

The ruleset requires `review-gate`; in the merge queue a job of that name passes, because each pull request was
checked before it joined. The rules live in `scripts/review-gate.mjs`.

The workflow runs on `pull_request_target` and checks out the default branch: the workflow and the rules always
come from `main`, so a pull request, a fork's or a parent in a stack included, cannot change the rules it is
judged by. It never checks out or runs the pull request's code. A commit status belongs to a commit, so when
several open pull requests share a head commit, each is judged and the strictest verdict is posted. What it does not stop: someone with write access to the repository can post a status of the same
name from another workflow. The gate guards against mistakes and outside pull requests, not against people who
can already push.

Only the maintainer sets the approval labels. The process behind them: [Reviewing changes](../contributing/reviewing).

## CD pipeline

Stoic Budget is self-hosted: `cd.yml` builds, scans, signs, and publishes images, then stops. There are no deployment
environments and no smoke tests. It runs on `v*.*.*` tags or manual dispatch:

1. Conftest policies
2. Waits for CI to succeed on the commit
3. Builds multi-arch (amd64, arm64) backend, frontend, and combined images and pushes them to GHCR, tagged
   `sha-<commit>` plus the version and `latest` on release tags
4. SLSA provenance attestation and a Trivy scan of the pushed image
5. SPDX SBOM with attestation, and a cosign attestation
6. On tags, a GitHub release with the SBOM attached

## Other workflows

- `codeql.yml` - CodeQL on pushes and pull requests to `main`/`develop`, plus weekly
- `dependency-review.yml` - dependency review on pull requests
- `scorecard.yml` - OpenSSF Scorecard, weekly
- `makefile.yml` - checks that `make build` works
- `docs.yml` - builds this site and deploys it to GitHub Pages when `website/` changes on `main`
- `release-please.yml` - semantic versioning and releases
- `changelog.yml` - regenerates the in-app changelog data (`frontend/public/changelog.json`) on `main`

Next: [Makefile Reference](../reference/makefile)
