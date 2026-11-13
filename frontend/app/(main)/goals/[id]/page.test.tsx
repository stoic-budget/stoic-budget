// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GoalDetailPage from './page';

const detail = vi.hoisted(() => ({ data: null as unknown }));

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'goal-1' }) }));
vi.mock('./hooks/useMonthParam', () => ({
  useMonthParam: () => ({ month: new Date(2026, 10, 1), changeMonth: vi.fn() }),
}));
vi.mock('./hooks/useGoalFlow', () => ({
  useGoalFlow: () => ({ data: undefined, isPending: false, error: null }),
}));
vi.mock('./hooks/useGoalPlan', () => ({ useGoalPlan: () => ({ data: undefined, isPending: false }) }));
vi.mock('./hooks/useGoalItems', () => ({
  useGoalItems: () => ({ data: undefined, isPending: false }),
}));
vi.mock('./hooks/useGoalDetail', () => ({
  useGoalDetail: () => ({ data: detail.data, removing: false, removeContribution: vi.fn() }),
}));
vi.mock('./components/GoalMovementsCard', () => ({
  GoalMovementsCard: () => <div>movements listed</div>,
}));

const contributions = [
  {
    id: 'c-1',
    amount: 120,
    contributionDate: '2026-10-01',
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    transaction: null,
  },
];

const goal = (account: unknown) => ({
  id: 'goal-1',
  name: 'New bike',
  targetAmount: 900,
  currency: 'USD',
  targetDate: null,
  currentAmount: 370,
  remaining: 530,
  percent: 41.11,
  isReached: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  cover: null,
  account,
  contributions,
});

const savings = { id: 'w-1', name: 'ACME Savings', currency: 'USD', balance: 370 };

describe('GoalDetailPage movements', () => {
  beforeEach(() => {
    detail.data = null;
  });

  it('hides the movements of a goal following an account: they are kept, not counted', () => {
    detail.data = goal({ ...savings, status: 'following' });
    render(<GoalDetailPage />);

    expect(screen.queryByText('movements listed')).toBeNull();
    expect(screen.getByText(/Contributions added before \(1\) are kept/)).toBeInTheDocument();
  });

  it('lists them for a goal counting contributions, and once its account is archived', () => {
    detail.data = goal(null);
    const { unmount } = render(<GoalDetailPage />);
    expect(screen.getByText('movements listed')).toBeInTheDocument();
    unmount();

    detail.data = goal({ ...savings, status: 'archived' });
    render(<GoalDetailPage />);
    expect(screen.getByText('movements listed')).toBeInTheDocument();
  });
});
