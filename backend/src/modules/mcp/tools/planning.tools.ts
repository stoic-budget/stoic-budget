import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import {
  BudgetList,
  CreateBudgetBody,
  ForecastResponse,
  GoalListAnswer,
  StoicBalance,
} from '../../../contracts';
import { parseDateOnly } from '../../budgets/budget-period.util';
import type { BudgetsService } from '../../budgets/budgets.service';
import type { StoicLedgerService } from '../../budgets/stoic/stoic-ledger.service';
import type { ForecastService } from '../../forecast/forecast.service';
import { canReadAccounts, withoutAccounts } from '../../goals/goal-account-visibility';
import type { GoalsService } from '../../goals/goals.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { Day, described } from './inputs';

const Month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Expected a month as YYYY-MM' }),
);

export function planningTools(deps: {
  budgets: BudgetsService;
  stoicLedger: StoicLedgerService;
  goals: GoalsService;
  forecast: ForecastService;
}): McpTool[] {
  return [
    defineTool({
      name: 'list_budgets',
      description:
        'Budgets with their limit, what was spent in the current period, what is left and the percent used. `unconvertedSpending` lists spending in currencies with no rate, left out of the sum.',
      input: Schema.Struct({
        date: Schema.optionalKey(
          described(Day, 'Show the periods that contain this day (default today)'),
        ),
      }),
      permissions: [Permission.BUDGET_VIEW],
      output: BudgetList,
      readOnly: true,
      run: (ctx, args) =>
        deps.budgets.findAll(ctx.workspaceId, args.date ? parseDateOnly(args.date) : undefined),
    }),
    defineTool({
      name: 'get_stoic_balance',
      description:
        'This month’s spending split into necessity, work, virtue and leisure, against the plan.',
      input: Schema.Struct({}),
      permissions: [Permission.BUDGET_VIEW],
      output: StoicBalance,
      readOnly: true,
      run: ctx => deps.stoicLedger.monthlyBalance(ctx.workspaceId),
    }),
    defineTool({
      name: 'create_budget',
      description:
        'Create a spending limit for a category per week, month, quarter or year. Delete it in Budgets if it was a mistake.',
      input: CreateBudgetBody,
      permissions: [Permission.BUDGET_CREATE],
      readOnly: false,
      run: (ctx, args) => deps.budgets.create(ctx.workspaceId, ctx.user.id, args),
    }),
    defineTool({
      name: 'list_goals',
      description:
        'Savings goals with target, saved so far, what remains and progress. With `month`, also what was put towards each goal in that month.',
      input: Schema.Struct({ month: Schema.optionalKey(described(Month, 'YYYY-MM')) }),
      permissions: [Permission.GOAL_VIEW],
      output: GoalListAnswer,
      readOnly: true,
      // Without `wallet.view` the followed account's name and balance stay out.
      run: async (ctx, args) => {
        const goals = await deps.goals.findAll(ctx.workspaceId, args.month);
        return canReadAccounts(ctx.subject) ? goals : withoutAccounts(goals);
      },
    }),
    defineTool({
      name: 'get_forecast',
      description:
        'Cash forecast from recurring income, bills and commitments: balance path, lowest point, the day money would run short, safe-to-spend until the next income, and runway in months.',
      input: Schema.Struct({
        days: Schema.optionalKey(
          described(Schema.Literals([30, 90, 365]), 'Horizon in days (default 90)'),
        ),
      }),
      permissions: [Permission.REPORT_VIEW],
      output: ForecastResponse,
      readOnly: true,
      run: (ctx, args) =>
        deps.forecast.getForecast(ctx.workspaceId, { days: args.days }, ctx.memberId),
    }),
  ];
}
