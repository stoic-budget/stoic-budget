/**
 * SQL, for a bill aliased `p`: it is still unpaid past its due date, or it was
 * paid after it. The day it was paid is `paid_at`, the day of its last
 * payment, which is the bank row's own day when it was matched to one (so a
 * bill the bank paid on time is on time, whenever it was matched). Only the
 * facts count: a reason given earlier keeps no bill late by itself. Today is
 * the database's day (`CURRENT_DATE`). Receivables are owed to the workspace,
 * not by it: none of them is ever late in this sense.
 */
export const LATE_SQL = `p."direction" = 'payable' AND p."due_date" IS NOT NULL
  AND ((p."status" NOT IN ('paid', 'archived') AND p."skipped_at" IS NULL
        AND p."due_date" < CURRENT_DATE)
    OR (p."status" = 'paid' AND p."paid_at"::date > p."due_date"))`;
