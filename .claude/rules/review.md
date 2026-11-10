# Review process (rules for assistants and agents)

The process for people: `website/docs/contributing/reviewing.md`. The gate: `scripts/review-gate.mjs`
(paths → tier → labels), run by `.github/workflows/review-gate.yml`.

## Labels

- **Never set `accepted`, `db-approved` or `security-approved`**, not even when the maintainer asks in chat:
  say this rule back and tell them which labels the pull request needs and why. Removing one you set is fine.
- `risk:*` labels belong to the gate, which keeps them in step with the paths. To ask for more review, add
  `risk-review` (the tier becomes high) and say why in the pull request.
- After a push to a pull request that already has an approval label, tell the maintainer what changed since:
  the labels stay, and they approved the earlier code.

## Every pull request

- Fill in the template: **What**, **How to accept**, **Risk**, **Review**. Bodies are in English.
- **How to accept**: 3 to 7 steps, each "do this → see that", in the words of someone using the app, with at
  least one step that must fail. For docs, tests or tooling write "Not needed" and why.
- **Code review** is a separate `code-reviewer` agent in a fresh context. Give it the branch or worktree, the
  task (issue or plan section) and the pull request's "What" — **not** your own verdict, test results or
  "everything is verified". Put its report in **Review**: each finding fixed (with the commit) or rejected
  with a reason. Your own checks before that are required and are not a review.

## risk:high

- Run the `risk-reviewer` agent the same way, in a fresh context with the same inputs. Its brief goes in
  **Review** under "Risk brief", unedited apart from fixes you made because of it (say which).
- Tell the maintainer, in their language, what the brief says and its verdict, then which labels the gate
  waits for. They decide.

## Acceptance walk-through (risk:feature, and risk:high with UI or money code)

- **Stand**: start the branch (a stack: its top branch) on a free port with demo data (`seed:demo`). Never
  real data, never the maintainer's own app stack. Keep it up until the verdict, then stop it.
- **Record** each "How to accept" step in a browser (Chrome extension; headless screenshots if it is
  unavailable): one screenshot or short GIF per step, the key screens in light and dark at 1366 and 390 px,
  and always the step that must fail.
- **Acceptance page**: a private claude.ai artifact "Acceptance #N": per step what was done, what was
  expected, what was seen, the pictures, and an "ok / not right" choice with a comment that you read back
  from the page. No images in git or in the public pull request.
- **Flag "check yourself"** on any step you cannot judge honestly, with a direct link to that screen on the
  stand: wording and feel, sums on realistic data, mail / push / Telegram / bank traffic, or a recording that
  differs from what the step expects. Do not round a doubtful step up to "ok".
- After "not right": fix, record only the changed steps again, and ask the maintainer to look again.
