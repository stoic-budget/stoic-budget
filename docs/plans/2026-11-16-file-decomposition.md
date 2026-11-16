# Decomposing the largest files (2026-11)

On origin/main at f889f58c1 (2026-11-16), 180 hand-written source files are over the 300-lines-of-code
limit of `scripts/check-file-size.mjs`. The ratchet stops them growing but does not shrink them, so every
feature that touches one carves a piece out ad hoc. This plan shrinks the 26 worst ones, ranked by size
× commits in the last two months, the way `statements.service.ts` (1719 → 348, #475–#481), custom tables
(#704/#705/#707) and `PayablesView` (#708) were already split.

Decisions: the dead parsing cluster is deleted rather than split; literal data tables become `*.data.ts`
and are exempt from the size guard; the other ~145 oversized files stay under the ratchet.

## How to use this plan

1. Pick the first unchecked row in the Queue whose "Blocked by" is empty. Before starting, check:
   `gh pr list --state open --search "<file name>"` and `git -C ~/Projects/lumio status --short <path>`.
   If either shows work in progress on the file, take the next row.
2. Branch from fresh origin/main in `.claude/worktrees/<short-name>` (never in the shared tree).
3. Follow the backend or frontend recipe and the file's map below. Each map line is one PR in a stack.
4. In the last PR of the stack, tick the row and write the new line count.
5. Progress check (counts files over the limit on origin/main):
   ```bash
   node --input-type=module -e "import{execFileSync as x}from'node:child_process';import{isChecked,countCodeLines}from'./scripts/check-file-size.mjs';const f=x('git',['ls-tree','-r','--name-only','origin/main'],{encoding:'utf8',maxBuffer:1<<28}).split('\n').filter(p=>p&&isChecked(p));console.log(f.filter(p=>countCodeLines(x('git',['show','origin/main:'+p],{encoding:'utf8',maxBuffer:1<<28}))>300).length)"
   ```

## Rules for every split PR

- **Behaviour-preserving only.** No renames of public methods, no bug fixes, no "while I'm here".
  A bug found on the way goes into an issue. Known traps not to "fix" in a move: dashboard `addMonths`
  clamps Jan 31 + 1 → Feb 28, subscriptions `addInterval` overflows to March; keep both as they are.
- **Facade stays.** The original class keeps every public method (and every `@Cron` decorator) and
  forwards to the new pieces, so the ~10–25 callers per service do not change. Exports used elsewhere
  are re-exported from the old path (listed per file).
- **Order inside a stack:** (1) characterization tests where the map says coverage is thin, own commit;
  (2) pure helpers (no DI) into `helpers/*.util.ts`; (3) one concern service per PR; (4) facade cleanup.
- **New collaborators are `@Injectable` services** registered in the module and injected into the facade,
  as in statements/custom-tables. In PR (2) of each backend stack, replace hand-built `new XService(...)`
  in specs with one builder, `@tests/unit/<module>/helpers/build-<x>-service.ts` (precedent:
  `@tests/unit/custom-tables/helpers/build-custom-tables-service.ts`), so later PRs touch one file.
  Add the new providers to integration specs that list `providers:` by hand.
- **Private methods spied in specs keep a delegating private wrapper** on the facade with the same name
  (dashboard has 92 such spies), unless the PR also moves the spies to the owning service.
- **Every target file ≤ ~280 code lines** so it can absorb a small change without hitting 300.
- **No new cross-module imports.** The dashboard → BudgetWithinLimit → Budgets cycle already needs
  `forwardRef`; new files must not import from dashboard.

## Backend recipe — checks per PR

```bash
npm --prefix backend run typecheck
npm --prefix backend run lint:fix
cd backend && npx vitest run @tests/unit/modules/<module> @tests/integration/<related specs listed in the map>
npm --prefix backend run test:e2e -- <e2e listed in the map>   # e2e caught lost variables SWC unit runs missed in #479
GOLDEN_ENABLED=1 npx vitest run --project golden               # parsing changes only, before and after
node scripts/check-file-size.mjs --base origin/main
```
Use `--fsModuleCache=false` on local e2e if a migration was added in between (see vitest cache note).

## Frontend recipe — checks per PR

- Data and mutations go to `hooks/useX*.ts` calling `lib/*-api.ts`; each card, list, dialog, toolbar is its
  own PascalCase file; pure logic in a sibling `*.ts`; copy stays in `*.content.ts`. Reference shape:
  `frontend/app/(main)/goals/` and `statements/components/payables/` (view ~200–240 lines).
- Pass one object (`row`, `form`, `props`) rather than re-listing 20–45 props.
- React Compiler is on (`frontend/vite.config.ts:37`, oxc). Keep hand-picked effect dependency lists
  and existing `eslint-disable react-hooks/*` lines with the code they guard.
- Characterization tests first, own commit, for files marked "no tests".
- Checks: `npm --prefix frontend run type-check`, `npm --prefix frontend run lint:fix`,
  `cd frontend && npx vitest run <folder>`, `node scripts/check-file-size.mjs --base origin/main`,
  `node scripts/check-component-requests.mjs --base origin/main`. A full local run is flaky; compare
  failures against a clean origin/main worktree by test name.

---

## Wave 0 — cheap wins (3 PRs, no splitting)

- [ ] **0.1 Delete the dead parsing cluster.** Commented out in `parsing.module.ts` (lines 22–40, 74–139),
  imported by no live code. Removes 11 files from the over-300 list, ~8,600 lines:
  `parsing/services/{quality-metrics, quality-logging, feature-flag, column-auto-fix, checksum-auto-fix,
  column-validation(.service + .util), checksum-validation, text-cleaning, universal-date-parser,
  bank-profile, statement-normalization, transaction-normalizer, profile-config, parsing-rules}`,
  `common/utils/data-quality-framework.util.ts`, their specs, the commented lines in `parsing.module.ts`,
  `intelligent-deduplication.service.example.md` reference.
  Gate: `npx knip` (root) lists each as an unused file; after deletion typecheck, unit, e2e and the whole
  golden suite are green. Anything knip says is still used stays and is listed in the PR.
  Not in the cluster (live, keep): `universal-amount-parser`, `universal-extractor`, `metadata-extraction`,
  `intelligent-deduplication` (ImportModule owns it), `common/utils/bank-profiles.util.ts`,
  `common/utils/feature-flags.util.ts` (BaseParser uses these, not the same-named services).
- [ ] **0.2 Data tables → `*.data.ts`.** In `scripts/check-file-size.mjs` replace
  `/contributed-layouts\.data\.ts$/` with `/\.data\.tsx?$/` (comment: "literal tables only; functions live
  in a sibling file"), with a case in `check-file-size.test.mjs`. Then:
  `tax/jurisdictions.seed.ts` → `jurisdictions.data.ts` (types stay in a small `jurisdictions.types.ts`);
  `tax/vat-deadlines.ts` → table (58–400) to `vat-deadlines.data.ts`, functions stay;
  `datev/datev-accounts.ts` → `DATEV_CONCEPTS` (20–348) to `datev-accounts.data.ts`, functions stay;
  `income-tax/filing-info.ts` → entries to `filing-info.data.ts`, types and override logic stay;
  `entity-imports/target-aliases.ts` → alias lists to `target-aliases.data.ts`;
  `frontend/app/lib/category-line-icons.tsx` → icon nodes to `category-line-icons.data.ts`, `lineIcon` stays.
  Imports keep their old paths (re-export).
- [x] **0.3 This plan document.**

## Queue

Rows are ordered by size × churn. "Blocked by" = open PRs or uncommitted shared-tree work on the
file as of 2026-11-16; re-check before starting.

| # | File (code lines) | Stack | Blocked by |
|---|---|---|---|
| [ ] B1 | backend `reports/reports.service.ts` (3155) | 6 PRs | — |
| [ ] B2 | `telegram/telegram.service.ts` (1241) | 4 | — |
| [ ] B3 | `storage/storage.service.ts` (1180) | 5 (tests first) | — |
| [ ] B4 | `workspaces/workspaces.service.ts` (1182) | 4 | — |
| [ ] B5 | `open-protocol-integrations/…service.ts` (1203) | 3 | — |
| [ ] B6 | `import/services/import-session.service.ts` (792) | 2 | — |
| [ ] B7 | `ledger/ledger-posting.service.ts` (842) | 3 | — |
| [ ] B8 | `custom-tables/custom-tables.controller.ts` (672) | 1 | — |
| [ ] B9 | `parsing/services/statement-processing.service.ts` (1016) | 4 | #804 |
| [ ] B10 | `receipts/receipts.service.ts` (1031) | 4 | #799 |
| [ ] B11 | `transactions/transactions.service.ts` (604) | 3 | #798, #799, #800 |
| [ ] B12 | `balance/balance.service.ts` (643) | 3 | #794 |
| [ ] B13 | `dashboard/dashboard.service.ts` (1587) | 5 | #809, shared-tree edits |
| [ ] B14 | `subscriptions/subscriptions.service.ts` (1591) | 5 | #800, #808, shared-tree edits |
| [ ] B15 | `payables/payables.service.ts` (1279) | 4 | shared-tree edits |
| [ ] B16 | `budgets/budgets.service.ts` (807) | 3 | #790, shared-tree edits |
| [ ] F1 | frontend `workspaces/components/WorkspaceMembersView.tsx` (1028) | 3 (tests first) | — |
| [ ] F2 | `storage/[id]/page.tsx` (939) | 3 (tests first) | — |
| [ ] F3 | `invoices/components/InvoiceDetailView.tsx` (764) | 3 (tests first) | — |
| [ ] F4 | `review/components/ReviewInboxView.tsx` (806) | 2 | — |
| [ ] F5 | `statements/[id]/edit/page.tsx` (650) | 2 | — |
| [ ] F6 | `subscriptions/components/SubscriptionsContent.tsx` (652) | 2 | — |
| [ ] F7 | `reports/components/BalanceSheet.tsx` (600) | 2 | — |
| [ ] F8 | `statements/components/CreateExpenseDrawer.tsx` (976) | 2 | #792 (test file only) |
| [ ] F9 | `reports/components/cash-flow/CashFlowView.tsx` (593) | 2 | #791 |
| [ ] F10 | `workspaces/components/WorkspaceOverviewView.tsx` (650) | map at start | — |

Backend and frontend rows are independent and can run in parallel worktrees; two rows touching the
same module (B9/B10 via statements, B13/B16 via forwardRef) do not run at the same time.

---

## Split maps — backend

Line numbers are origin/main at f889f58c1; re-locate by method name.

**B1 `reports.service.ts`** — 16 ctor params (4 unused: category/branch/wallet/user repos — drop in PR 1),
14 hand-built `new ReportsService(` in 5 specs → builder in PR 1. Callers: controller (18 methods),
`report-schedules.service` (`generateFromTemplate`, static `assertTemplateFormat`), telegram (`generateDailyReport`,
`generateMonthlyReport`). Naming convention in the module: `*.report.ts`.
1. Helpers + builder: `interfaces/custom-tables-report.interface.ts` (77–245), `helpers/report-values.util.ts`
   (parseNumber/parseDate/toDateKey/UTC week+month helpers), `helpers/custom-table-columns.util.ts` (score*,
   pickBestColumnKey, the column mapping copied 3×), `helpers/report-query.util.ts` (countedTransactions,
   getReportsVersion, logReportGeneration — used by every cluster).
2. Custom tables: `custom-tables-summary.report.ts`, `custom-tables-report.report.ts` +
   `helpers/custom-tables-aggregate.util.ts` (963–1094), `custom-tables-drilldown.report.ts`.
3. Periodic: `daily-custom-report.report.ts`, `monthly-report.report.ts`, `statements-summary.report.ts`,
   `report-history.report.ts`.
4. Exports: `workspace-export.report.ts`, `helpers/workspace-export-writers.util.ts` + `…-pdf-docx.util.ts`,
   `helpers/report-export-writers.util.ts`. Tests first: `exportReport`, `getReportHistory` have none.
5. Analytics: `top-categories.report.ts`, `spend-over-time.report.ts` (275, tight).
6. Templates: `report-templates.report.ts`, `template-report-rows.loader.ts`,
   `helpers/template-documents.util.ts` + `…-register.util.ts`.
Keep private wrappers for `parseNumber`, `parseDate`, `toDateKey`, `pickBestColumnKey`, `scoreAmountColumn`,
`generateWorkspaceExcel`, `loadReportRows`. Also split `report-document.util.ts` (301) on the way.
Specs: reports.service (1149), logic, custom-tables-report, confirmed-only, top-categories; integration
counted-flows, transaction-split-invariant; e2e reports-counted.

**B2 `telegram.service.ts`** — 14 params; hand-built in telegram.service.spec and telegram-inbound.service.spec.
1. `helpers/telegram-report-format.ts` (pure formatters 1322–1447) + builder.
2. `telegram-api.client.ts` (sendMessage, answerCallbackQuery, file download, TelegramApiError, resolveBot) —
   it owns the `inboundBot` AsyncLocalStorage (line 110), one instance injected everywhere; `botIdOf`
   re-exported.
3. `telegram-senders.ts` (linkChat, resolveSender, claimUpdate, find*), `telegram-reports.service.ts` (209–376).
4. `handlers/telegram-inbound-media.handler.ts` (receipt image, expense text, document upload),
   `handlers/telegram-commands.handler.ts` (report/goals/net-worth, callbacks). Facade: handleUpdate, dispatch.
Reuse `telegram-inbound.util.ts`, `telegram-connection.util.ts`. Spy on `downloadTelegramFile` ×3 → wrapper.

**B3 `storage.service.ts`** — only `storage.service.spec.ts` (507) covers it: PR 1 adds tests for versions,
bulk actions and shared links. Callers: only the two storage controllers.
2. `storage-access.service.ts` (checkFileAccess, getUserPermissionForStatement, checkActionPermission,
   findMembership) — used by every cluster, spied 4×.
3. `storage-files-query.service.ts`, `storage-folders.service.ts` (folders + views).
4. `storage-file-actions.service.ts` (category, tags, trash, bulk), `storage-versions.service.ts`
   (versions, download, stream, preview, CSV).
5. `storage-shared-links.service.ts`, `storage-permissions.service.ts`.

**B4 `workspaces.service.ts`** — 13 params; hand-built in workspaces.service.logic and .members specs.
1. `helpers/invitation-link.ts` (merge with `request-app-origin.util.ts`), `workspace-member-audit.ts`,
   `requireAdminMembership` as a shared helper, builder.
2. `workspace-members.service.ts` (246–567). 3. `workspace-invitations.service.ts` (572–914) +
   `workspace-invitation-email.service.ts` (spied 5× → wrapper). 4. `workspace-crud.service.ts` (914–1327).

**B5 `open-protocol-integrations.service.ts`** — one service per protocol: `s3-integration.service.ts`,
`webdav-integration.service.ts`, `imap-integration.service.ts` (syncImap + importImapMessage 566–672),
shared `protocol-settings.store.ts` (findProtocolIntegration, saveProtocolSettings, buildStatus,
statement-file import helpers). Facade keeps disconnect and the status trio.

**B6 `import-session.service.ts`** — `import-preview.service.ts` (processPreview 377–584),
`import-commit.service.ts` (processCommit 584–830 + createTransaction + buildSummary). Facade: create,
process, get, resolveConflicts, cancel.

**B7 `ledger-posting.service.ts`** — `ledger-entry-writer.ts` (book, insertDraft, replaceLines, promote,
reverse*, nextEntryNo), `ledger-opening-balances.service.ts` (471–710), `ledger-document-posting.service.ts`
(postInvoice, postCreditNote). Facade keeps postTransaction + planTransaction. Specs: integration
ledger-posting, ledger-posting.rules.

**B8 `custom-tables.controller.ts`** — split by sub-resource into `custom-table-sources.controller.ts`
(from-data-entry*, source-preview, from-source, refresh, source-statements) and
`custom-table-columns.controller.ts` (columns, style, reorder, relation-options). Same route prefix;
register controllers with static paths before `:id` ones and pin with the controller spec + e2e.

**B9 `statement-processing.service.ts`** — 16 params, hand-built 2× in statement-processing.service.spec (837).
Golden suite before/after every PR.
1. `helpers/statement-processing-metadata.helper.ts`, `helpers/statement-transaction-schema.helper.ts`,
   `statement-processing-metrics.ts`, builder.
2. `statement-import-commit.service.ts` (commitImport), `statement-fingerprint-duplicates.service.ts`.
3. `statement-transaction-writer.service.ts` (createTransactions 879–1092).
4. `statement-metadata-enrichment.service.ts` + `statement-parse-run.service.ts` (rest of the 420-line
   processStatementInternal; `parsingDetails`/`addLog` passed as one context object). Static `inFlight`
   map + semaphore stay on the facade. Re-export `StatementRejected`, `ProcessStatementOptions`.

**B10 `receipts.service.ts`** — Nest TestingModule, no hand-built specs.
1. `helpers/receipt-transaction-fields.ts`, `services/receipt-audit.service.ts`.
2. `receipt-intake.service.ts`, `receipt-tax.service.ts`. 3. `receipt-sync.service.ts` (update + sync trio).
4. `receipt-approval.service.ts` (approve, approveOnce, findScanTransaction, copyFileToTransaction — spied).
Specs: receipts.service (826), integration receipt-edit-sync (providers list), e2e receipt-stage.

**B11 `transactions.service.ts`** — hand-built in 3 specs → builder.
1. `helpers/transaction-split-plan.ts` + builder. 2. `transaction-split.service.ts`,
`transaction-unsplit.service.ts` (guards `ensureCanEditStatements`, `invalidateReports` stay on the facade,
passed in; they are spied). 3. `transaction-update.service.ts`.

**B12 `balance.service.ts`** — 7 caller modules, 6 integration specs list it.
1. `balance-format.ts` + builder. 2. `balance-accounts.service.ts` (286–507). 3. `balance-sheet.service.ts`
(+ its 3 private queries, spied 5× each → wrappers), `balance-series.service.ts`.
Keep exporting `CASH_ACCOUNT_CODE`, `DEBTS_ACCOUNT_CODE`.

**B13 `dashboard.service.ts`** — 92 `vi.spyOn(service as any, …)`: `getDashboard` keeps calling private
wrappers of the same names.
1. Pure: `helpers/cash-flow-buckets.util.ts`, `helpers/trend-forecast.util.ts`,
   `helpers/commitment-projection.util.ts`, `helpers/dashboard-query.util.ts`; tests for
   `convertDashboardAmount`/`getWorkspaceCurrency`.
2. `dashboard-currency.ts` (used by every cluster and by cash-flow-entries; keep `round2` export),
   `dashboard-snapshot.ts`.
3. `dashboard-health.ts`, `dashboard-lists.ts`. 4. `dashboard-cash-flow.ts`, `dashboard-trends.ts`.
5. `dashboard-commitments.ts` (forecast.service calls `getCommitments`).

**B14 `subscriptions.service.ts`** — 15 params, hand-built in 2 specs. Both `@Cron` stay on the facade.
1. `helpers/subscription-charge.util.ts` (module-level functions + advancePastCharge, normalizeToMonthly,
   addInterval) + builder; tests for getDetails, getBusinessReport, sinking funds, duplicates, upcoming,
   recordUsage (none today).
2. `subscription-crud.ts`, `subscription-lifecycle.ts`. 3. `subscription-summary.ts`, `subscription-calendar.ts`.
4. `subscription-planning.ts`. 5. `subscription-charges.ts` + `subscription-charge-linking.ts` (lock,
   chargeableTransaction, categoriseForBudget, bookCharge in one class, the other receives it).

**B15 `payables.service.ts`** — TestingModule, no hand-built specs.
1. `payment-transaction.ts` — sole owner of the `pendingEvents` WeakMap, inPaymentTransaction, queueEvent;
   pure bits into existing `payable-payments.util.ts`.
2. `payable-crud.ts`, `payables-summary.ts`, `payables-due-dates.ts`.
3. `payable-settlement.ts`, `payable-payments.ts`. 4. `payment-matching.ts`.
Keep exports `AllocationSuggestion`, `PaymentCandidate`. Specs: payables.service (943), 5 integration, e2e
webhook-events.

**B16 `budgets.service.ts`** — hand-built 3× in budgets.service.spec. `@Cron resetPeriodAlertFlags` stays.
Keep public: `categoryIdsFor`, `computeSpending`, `previousPeriodsSpent`, `rateOrNull` (BudgetWithinLimit).
1. Tests for those four + builder; `budget-crud.ts`, `budget-alerts.ts`. 2. `budget-spending.ts`.
3. `budget-subscription-reserve.ts`, `budget-impact.ts`. `getTopBudgets` has no callers: note it, don't delete.

## Split maps — frontend

**F1 WorkspaceMembersView** — 7 requests, 5 tests. 1. Tests: invite, role change, permissions, remove,
resend, revoke. 2. `lib/workspace-members-api.ts`, `hooks/useWorkspaceMembers.ts`, `useMemberFilters.ts`;
drop local `getApiMessage` for `lib/api-error`. 3. `MembersToolbar`, `InviteMemberForm`, `MemberRow` (owns
its menu anchors instead of the three `*AnchorMap` states), `PendingInvitationsList`.

**F2 storage/[id]/page** — 3 requests via `api.get` (invisible to the request check), no tests.
1. Tests. 2. `lib/storage-files-api.ts`, `hooks/useFileDetails.ts` (cancel flag, object-URL revoke,
`useEffectEvent` move together), `file-details.utils.ts`. 3. `FileDetailsHeader`, `FilePreviewCard`,
`SharedLinksTab`. Pattern: `storage/receipts/[id]/hooks/`.

**F3 InvoiceDetailView** — ~21 requests, no tests. 1. Tests. 2. `hooks/useInvoiceDetail`,
`useInvoiceActions`, `useInvoicePayments` (reuse the mark-paid branching in
`payables/hooks/usePayableActions.ts:101-127`). 3. `InvoiceHeaderActions`, `InvoiceLineItemsTable`,
`InvoiceTotals`, `InvoiceCreditNotesList`.

**F4 ReviewInboxView** — 13 tests + 15 model tests; add keyboard j/k/x/a/c and group-by-payee tests.
1. `review-inbox-columns.ts`, `useReviewInboxLabels`, `useReviewInboxList`. 2. `ReviewRow` (one `row`
model object), `ReviewRowActions`, `ReviewListHeader`, `ReviewInboxTabs`, `ReviewInboxToolbar`.

**F5 statements/[id]/edit/page** — 1. `helpers/statement-readiness.ts` + unit tests (readiness and
closing-balance math untested today). 2. `EditStatementHeader`, `ReadinessPanel`,
`ParsingDetailsAccordion`, `ExportToTableDialog`, `BulkActionsBar`. New hooks stay above the early return.

**F6 SubscriptionsContent** — 1. Move the CSV export into `hooks/useSubscriptionsPage.ts` (+ test),
`useSubscriptionsFilters`. 2. `SubscriptionsSummaryCards`, `SubscriptionsFilters`, `SubscriptionsTable`.

**F7 BalanceSheet** — `BalanceAccountRow.tsx` and `balance-sheet-utils.ts` are orphaned duplicates of
`balance-sheet-tree.ts`: revive or delete them in PR 1, no third copy. 1. Tests (save, export, expand) +
orphan decision. 2. `hooks/useBalanceSheet.ts` (query, sync effect, save, export), `BalanceAccountTree`,
`BalanceSheetToolbar`.

**F8 CreateExpenseDrawer** — 16 tests. 1. `ExpenseFormParts`, `useReceiptDropZone`, `useInlineTaxRate`.
2. `ExpenseScanStep`, `ExpenseAmountStep`, `ExpenseDetailsStep`, `TaxRateDrawer` (pass `form`).

**F9 CashFlowView** — 1. CSV export into `useCashFlowMap.ts`, `cash-flow-period.ts` (`periodLabel`; update
`period-label.test.ts`), `useCategoryFilterDraft`. 2. `CashFlowCategoryTable` (+ `Delta`),
`CashFlowFilterBar`. Keep the sankey `useMemo` dependency list and its disable comment together.

**F10 WorkspaceOverviewView** — map at start with the same recipe.

## After the queue

The other ~145 files over 300 are handled by the ratchet: whoever next adds to one splits the part
they touch, using the recipes above. Re-rank once the queue is done (size × commits in the last 60 days).

Follow-up found during research, out of scope here: `check-component-requests.mjs` matches one line,
so it misses chained calls split across lines and clients not named `apiClient` (storage `api.get`).

