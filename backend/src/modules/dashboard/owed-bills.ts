import { PayableStatus } from '../../entities/payable.entity';

/**
 * The "You owe" card of the dashboard, counted as on the Pay page
 * (PayablesService.getSummary): every open bill counts what is left of it, a
 * partly paid one too, and is overdue when marked so or past its due date.
 * For a query over payables aliased `p`.
 */
const LEFT = 'GREATEST(p.amount - COALESCE(p.paid_amount, 0), 0)';
const OVERDUE = '(p.status = :owedOverdue OR p.due_date < CURRENT_DATE)';

export const OWED_COLUMNS = [
  `COALESCE(SUM(CASE WHEN NOT ${OVERDUE} THEN ${LEFT} ELSE 0 END), 0) AS "totalPayable"`,
  `COALESCE(SUM(CASE WHEN ${OVERDUE} THEN ${LEFT} ELSE 0 END), 0) AS "totalOverdue"`,
];

export const OPEN_BILL_SQL = 'p.status NOT IN (:...owedClosed)';

export const OPEN_BILL_PARAMS = {
  owedClosed: [PayableStatus.PAID, PayableStatus.ARCHIVED],
  owedOverdue: PayableStatus.OVERDUE,
};
