import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PayPeriodsResponse } from '@/app/lib/contracts';
import { MonthStartSection, settingOf } from './MonthStartSection';

const saveMock = vi.hoisted(() => vi.fn(async () => undefined));
const dataMock = vi.hoisted(() => ({ current: undefined as PayPeriodsResponse | undefined }));

vi.mock('@/app/settings/profile/hooks/useMonthStartSetting', () => ({
  useMonthStartSetting: () => ({
    data: dataMock.current,
    saving: false,
    error: null,
    saved: false,
    save: saveMock,
  }),
}));

const answer = (overrides: Partial<PayPeriodsResponse> = {}): PayPeriodsResponse => ({
  monthStart: { kind: 'day', day: 1 },
  salary: null,
  holidays: [],
  holidayCountry: null,
  current: { month: '2026-11', from: '2026-11-01', to: '2026-11-30' },
  next: { month: '2026-12', from: '2026-12-01', to: '2026-12-31' },
  ...overrides,
});

describe('settingOf', () => {
  it('sends exactly the choice on screen, with the contract’s day rule', () => {
    expect(settingOf({ kind: 'day', day: '15' })).toEqual({ kind: 'day', day: 15 });
    expect(settingOf({ kind: 'day', day: ' 31 ' })).toEqual({ kind: 'day', day: 31 });
    for (const day of ['0', '32', '8.2', '1e1', '', 'x', '015']) {
      expect(settingOf({ kind: 'day', day })).toBeNull();
    }
    // A day typed earlier is not sent with another kind.
    expect(settingOf({ kind: 'salary', day: '15' })).toEqual({ kind: 'salary' });
  });
});

describe('MonthStartSection', () => {
  beforeEach(() => {
    saveMock.mockClear();
    dataMock.current = answer();
  });

  it('previews the month for the day typed and saves it', async () => {
    render(<MonthStartSection />);
    const day = screen.getByLabelText('Day of the month');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(day, { target: { value: '15' } });
    expect(screen.getByText('This month')).toBeInTheDocument();
    // 15 of some month to 14 of the next, whatever today is.
    expect(screen.getAllByText(/15.*–.*14/).length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({ kind: 'day', day: 15 }));
  });

  it('refuses a day the contract refuses', () => {
    render(<MonthStartSection />);
    fireEvent.change(screen.getByLabelText('Day of the month'), { target: { value: '32' } });
    expect(screen.getByText('Enter a whole number from 1 to 31.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('says when no salary was found', () => {
    dataMock.current = answer({ monthStart: { kind: 'salary' } });
    render(<MonthStartSection />);
    expect(
      screen.getByText('No regular salary found yet, so the month starts on the 1st.'),
    ).toBeInTheDocument();
  });

  it('names the detected payday', () => {
    dataMock.current = answer({
      monthStart: { kind: 'salary' },
      salary: { dayOfMonth: 25, paydays: ['2026-10-23'] },
    });
    render(<MonthStartSection />);
    expect(screen.getByText(/usually arrives on day 25/)).toBeInTheDocument();
  });
});
