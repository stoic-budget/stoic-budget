// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GoalsPage from './page';

const base = {
  targetAmount: 1000,
  currency: 'EUR',
  targetDate: null,
  currentAmount: 400,
  remaining: 600,
  percent: 40,
  isReached: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  cover: null,
};

const goals = [
  { ...base, id: 'manual', name: 'Bike', account: null },
  {
    ...base,
    id: 'linked',
    name: 'Lisbon flat',
    account: { id: 'w1', name: 'ACME Savings', currency: 'EUR', balance: 400, status: 'following' },
  },
  {
    ...base,
    id: 'shelved',
    name: 'Old plan',
    account: { id: 'w2', name: 'ACME Old', currency: 'EUR', balance: 0, status: 'archived' },
  },
];

vi.mock('./hooks/useGoals', () => ({
  EMPTY_GOAL_FORM: { name: '', targetAmount: 0, targetDate: '', walletId: null },
  useGoals: () => ({
    goals,
    isPending: false,
    isFetching: false,
    error: null,
    saving: false,
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    addContribution: vi.fn(),
  }),
}));
vi.mock('@/app/components/ui/page-title', () => ({ PageTitle: () => null }));
vi.mock('@/app/components/versions/ReadOnlyHint', () => ({ ReadOnlyHint: () => null }));
vi.mock('@/app/components/mobile/quick-actions-store', () => ({ useQuickActions: () => {} }));
vi.mock('./components/GoalFormDrawer', () => ({ GoalFormDrawer: () => null }));
vi.mock('./components/ContributionDrawer', () => ({ ContributionDrawer: () => null }));
vi.mock('./hooks/useFollowableAccounts', () => ({ useFollowableAccounts: () => [] }));

describe('GoalsPage with a goal that follows an account', () => {
  it('offers no contribution button on it, and says where its progress comes from', () => {
    render(<GoalsPage />);

    // The manual goal and the one whose account was archived still take contributions.
    expect(screen.getAllByRole('button', { name: 'Add money' })).toHaveLength(2);
    expect(screen.getByText('Follows ACME Savings: progress is its balance')).toBeInTheDocument();
    expect(
      screen.getByText('ACME Old is archived, so this goal counts its contributions again'),
    ).toBeInTheDocument();
  });
});
