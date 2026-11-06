---
title: Development Workflow
description: Branches, PRs, and CI expectations
---

Stoic Budget uses Conventional Commits, CI checks, and a detailed PR template to keep changes stable.

## Branching

- `main` is the production branch
- Feature work should use short-lived branches (e.g., `feat/parsing-bereke-pdf`)

## Commit messages

Conventional Commits are enforced by commitlint (`@commitlint/config-conventional`, subject case not checked) in
the husky `commit-msg` hook:

```
feat(parsing): add Bereke bank PDF parser
fix(import): handle duplicate session retries
```

The types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore` and `ci`.

- Use the present tense and the imperative mood ("Add feature", not "Added feature" or "Adds feature")
- Limit the first line to 72 characters or less
- Separate the subject from the body with a blank line, and wrap the body at 72 characters
- Reference issues and pull requests in the footer

The `pre-push` hook runs the backend unit tests when `backend/src` changed.

## Pull requests

The PR template asks for a description and type of change, the changes made, screenshots for UI work, testing
notes, a checklist, and notes on security impact, database, API, documentation, dependency, breaking, and
deployment changes.

## CI checks

CI runs policy-as-code, shell/Dockerfile/config scans, Biome, type checks, backend unit and e2e tests, frontend
tests, builds, dependency audits and license checks, a secrets scan, and a Docker image build. See
[CI/CD](../deployment/ci-cd).

On pull requests, changes to migrations, entities, or `data-source.ts` need the `db-approved` label; changes to the
auth module, `common/guards`, `common/decorators`, or permissions/roles code need `security-approved`.

## Local workflow

```bash
make lint-check
npm --prefix backend run typecheck
npm --prefix frontend run type-check
make test
make build
```

## Adding a new feature

1. **Backend:** create `backend/src/modules/my-feature/` with `my-feature.module.ts`, `my-feature.service.ts` and
   `my-feature.controller.ts`.
2. **Frontend:** create `frontend/app/my-feature/` with `page.tsx` and `components/`.
3. **Tests:** `backend/@tests/unit/.../my-feature.service.spec.ts`, and `MyFeature.test.tsx` next to the component.
4. **Documentation:** add to the relevant pages in `website/docs/`, and update the API docs if you add endpoints.

Next: [Testing](testing)
