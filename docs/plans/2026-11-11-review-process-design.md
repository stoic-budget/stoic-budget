# Review process: design

Agreed 2026-11-11. Before this the project had no review process: CI, Copilot and an
agent reviewer ran, but no person accepted a change, and the approval labels were set by
the same assistant that wrote the code.

## Principle

The maintainer accepts changes by **behaviour**, not by reading code. Code is checked by
CI and by reviewer agents that start without the author's conclusions. The approval labels
`accepted`, `db-approved` and `security-approved` are set **only by the maintainer**,
never by an assistant or agent, even when asked in chat.

## Risk tiers

A CI job assigns one tier from the changed paths (the highest wins) and sets a
`risk:low`, `risk:feature` or `risk:high` label. The author may raise the tier; only the
maintainer may lower it.

| Tier | Paths | Needed to merge |
|---|---|---|
| `risk:low` | docs, website, tests only, dev tooling, Dependabot updates | green CI + `code-reviewer` report in the PR |
| `risk:feature` | any other code in `frontend/app` or `backend/src` | + "How to accept" scenario, recorded walk-through, `accepted` |
| `risk:high` | migrations and entities, auth/guards/permissions, `.github/workflows`, money paths (list kept in the gate) | + `risk-reviewer` brief, `db-approved` / `security-approved`; `accepted` too when the PR has UI |

## Reviewers

1. **The author's own checks** are required but are not a review.
2. **`code-reviewer`** (all tiers) starts in a fresh context with the branch, the task and
   the PR's "What" section, never the author's claims. It runs the tests, writes probe
   tests, mutation-checks the key lines, and writes a "Review" section: each finding with
   the command and its output, marked fixed or rejected with a reason.
3. **`risk-reviewer`** (`risk:high` only) starts in a fresh context and tries to break the
   change: workspace isolation, permissions (role without the right, API key, stolen
   session), money (rounding, currencies, double counting, transfers), migrations (real
   shaped data, re-run, down, lock time on big tables), secrets in logs, audit, backups and
   responses. Its brief fits one screen: what changes for users and data, what can go wrong
   and the evidence it was checked, what was **not** checked, questions for the maintainer,
   and a verdict (approve / approve with conditions / do not approve).
4. **Copilot** stays as an extra reader. The ruleset requires every review thread to be
   resolved: fixed, or answered with why not.

## Acceptance walk-through

- **Stand:** the agent starts the branch on its own port with demo data (`seed:demo`),
  never real data. It stays up until the maintainer accepts or rejects, then stops. A stack
  gets one stand from its top branch.
- **Recording:** the agent walks the "How to accept" steps in a browser (Chrome extension,
  headless screenshots as fallback): one screenshot or short GIF per step, key screens in
  light and dark at 1366 and 390 px, and the step that must fail is always recorded.
- **Where:** a private claude.ai artifact page "Acceptance #N" per PR, step by step (done,
  expected, seen, pictures). The PR holds only the steps. No images in git.
- **"Check yourself" steps:** the agent flags a step it cannot judge honestly (wording and
  feel, sums on realistic data, mail/push/Telegram/bank, a recording that differs from the
  expectation), with a direct link to that screen on the stand.
- **Accepting:** each step has "ok" / "not right" and a comment on the page; the assistant
  reads them there. All ok → the maintainer sets `accepted`. Not right → fix, re-record the
  changed steps, look again. Feature not wanted → close the PR with the reason.

## Rollout

- `website/docs/contributing/reviewing.md`: the guide, linked from `.github/CONTRIBUTING.md`.
- `.claude/rules/review.md`: rules for agents.
- `.claude/agents/risk-reviewer.md`: new agent; `code-reviewer.md` gains the "Review"
  section output.
- `.github/PULL_REQUEST_TEMPLATE.md`: short template with What, How to accept, Risk and
  Review (the risk brief goes inside Review).
- `.github/workflows/review-gate.yml`: `pull_request_target` (workflow and rules from the
  base branch, the pull request's code never run) on code, base and label changes; assigns
  the tier label and posts the `review-gate` commit status; a `review-gate` job passes in
  the merge queue. `sensitive-changes` moves here, so a label no longer needs a manual re-run.

Changed after review (both reviewers): low became a whitelist; tests inside a high area
count; `accepted` is needed on a high pull request whenever app code changes (a migration
no longer removes it); the author raises the tier with `risk-review` instead of a `risk:*`
label, so the gate's own label never holds the tier up.
- Maintainer, in GitHub settings: add `review-gate` to the required checks; require
  resolved review threads.

## Open PRs #735–#766

The code review from the build waves counts. The approval labels the assistant set are
removed. Then one wave at a time: stand, scenario and recording, `risk-reviewer` for high
PRs, maintainer acceptance, merge, next wave.
