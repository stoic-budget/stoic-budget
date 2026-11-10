---
title: Reviewing changes
description: Risk tiers, who reviews what, and how a change is accepted
---

Every pull request is reviewed in proportion to what it can break. The maintainer accepts a change by how it
**behaves**; the code itself is checked by CI and by reviewers that start without the author's conclusions.

## Risk tiers

The [review gate](../deployment/ci-cd#review-gate) gives each pull request a tier from the files it changes.
The highest match wins. The `risk-review` label makes any pull request high; nothing lowers a tier, and a wrong
path rule is fixed in `scripts/review-gate.mjs`, which is itself high risk.

| Tier | What falls in it | Needed before merge |
|---|---|---|
| `risk:low` | only a fixed list: docs and the website, Markdown, tests, agent skills, issue templates, Dependabot's dependency updates | green CI, a code review |
| `risk:feature` | everything not on that list and not high: app code, contracts, build and Docker files, scripts, a dependency a person adds | + a "How to accept" scenario, a recorded walk-through, `accepted` |
| `risk:high` | migrations, entities and the migration runner (`db-approved`); auth, API keys, guards, permissions and roles (`security-approved`); CI workflows, repository guards, git hooks and the rules that steer coding agents (`security-approved`); the shared money code: sums, currencies, counted rows, balances, ledger, tax (`accepted`) | + a risk brief and the area's label; `accepted` too whenever app code changes |

Only the maintainer sets `accepted`, `db-approved` and `security-approved`. Assistants and agents never do,
even when asked: a label set by whoever wrote the code checks nothing.

## Who reviews

1. **The author** runs the tests, linters and guards. That is required, and it is not a review.
2. **A code reviewer** (every tier) gets the branch, the task and the pull request's "What" section, and
   nothing of the author's own verdict. It runs the tests, writes probe tests for risky claims, breaks the key
   lines on purpose to see the tests catch it, and adds a **Review** section: each finding with the command and
   its output, marked fixed or rejected with a reason.
3. **A risk reviewer** (`risk:high`) starts the same way and tries to break the change:
   - workspace isolation: another workspace's rows, read or written through the new path;
   - permissions: a role without the right, an API key, a stolen session;
   - money: rounding, currencies, double counting, transfers;
   - migrations: data of real shape, a second run, `down`, lock time on big tables;
   - secrets in logs, audit rows, backups and responses.

   Its **risk brief** fits one screen: what changes for people and their data, what can go wrong and the
   evidence it was checked, what was not checked, questions for the maintainer, and a verdict (approve,
   approve with conditions, do not approve).
4. **Copilot** reviews every push as an extra reader. Every review thread is resolved before merge: fixed, or
   answered with why not.

## Acceptance

For `risk:feature`, and `risk:high` with UI or money code:

- **Scenario.** The pull request has a "How to accept" section: 3 to 7 steps, each "do this, see that", one of
  them a step that must fail (a refused input, a missing permission).
- **Stand.** The branch runs on its own port with demo data, never real data. A stack of pull requests gets one
  stand from its top branch. It stops after the verdict.
- **Recording.** The walk-through is recorded step by step: a screenshot or short clip per step, the key
  screens in light and dark at 1366 and 390 px, and always the step that must fail. It lives on a private
  acceptance page for the maintainer, not in git.
- **Check yourself.** A step the recorder cannot judge honestly is flagged with a link to that screen on the
  stand: wording and feel, sums on realistic data, mail, push, Telegram or bank traffic, or a recording that
  differs from the expectation.
- **Verdict.** All steps fine: the maintainer sets `accepted`. Something is wrong: it is fixed, the changed
  steps are recorded again, and the maintainer looks again. The feature is not wanted: the pull request is
  closed with the reason.

## Contributors from outside

Write the "How to accept" steps in your pull request; the maintainer's tooling records the walk-through and
runs the reviewers. You do not need to set or ask for any label.
