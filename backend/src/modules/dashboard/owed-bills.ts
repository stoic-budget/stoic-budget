import { PayableStatus } from '../../entities/payable.entity';

/**
 * The "You owe" card of the dashboard, counted as on the Pay page
 * (PayablesService.getSummary): every open bill counts what is left of it, a
 * partly paid one too, and is overdue once past its due date (a bill with no
 * date never is).
 * For a query over payables aliased `p`.
 */
const LEFT = 'GREATEST(p.amount - COALESCE(p.paid_amount, 0), 0)';
const OVERDUE = 'COALESCE(p.due_date < CURRENT_DATE, false)';

export const OWED_COLUMNS = [
  `COALESCE(SUM(CASE WHEN NOT ${OVERDUE} THEN ${LEFT} ELSE 0 END), 0) AS "totalPayable"`,
  `COALESCE(SUM(CASE WHEN ${OVERDUE} THEN ${LEFT} ELSE 0 END), 0) AS "totalOverdue"`,
];

export const OPEN_BILL_SQL = 'p.status NOT IN (:...owedClosed)';

export const OPEN_BILL_PARAMS = {
  owedClosed: [PayableStatus.PAID, PayableStatus.ARCHIVED],
};
