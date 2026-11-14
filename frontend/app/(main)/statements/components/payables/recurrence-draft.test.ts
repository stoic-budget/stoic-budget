import { describe, expect, it } from 'vitest';
import { payableRow } from '@/app/test/fixtures/contracts';
import { createEmptyState, repeatIsComplete, repeatPayload } from './payable-form-state';
import {
  emptyRepeat,
  isInLastWeek,
  shownMonthMode,
  toRecurrenceRule,
  toRepeatDraft,
} from './recurrence-draft';

const monthly = { ...emptyRepeat(), frequency: 'monthly' as const };

describe('toRecurrenceRule', () => {
  it('reads nothing from a bill that does not repeat', () => {
    expect(toRecurrenceRule(emptyRepeat(), '2026-03-31')).toBeNull();
  });

  it('anchors a new monthly bill on its due date', () => {
    expect(toRecurrenceRule(monthly, '2026-03-31')).toEqual({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-03-31',
      monthDay: 31,
    });
  });

  it('falls on the last day, or the Nth or last weekday read off the due date', () => {
    expect(toRecurrenceRule({ ...monthly, monthMode: 'last' }, '2026-03-10')).toMatchObject({
      monthDay: 'last',
    });
    // 10 March 2026 is the second Tuesday.
    expect(toRecurrenceRule({ ...monthly, monthMode: 'weekday' }, '2026-03-10')).toMatchObject({
      nthWeekday: { week: 2, weekday: 2 },
    });
    // 27 March 2026 is the last Friday.
    expect(toRecurrenceRule({ ...monthly, monthMode: 'lastWeekday' }, '2026-03-27')).toMatchObject(
      { nthWeekday: { week: -1, weekday: 5 } },
    );
    expect(isInLastWeek('2026-03-27')).toBe(true);
    expect(isInLastWeek('2026-03-10')).toBe(false);
  });

  it('sends "on day N" when the due date moved off the weekday the form held', () => {
    // 29 December 2026 is the fifth Tuesday: no "Nth weekday" option, the form shows day 29.
    expect(toRecurrenceRule({ ...monthly, monthMode: 'weekday' }, '2026-12-29')).toEqual({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-12-29',
      monthDay: 29,
    });
    // 10 December 2026 is not in the last week: no "last weekday" option.
    expect(
      toRecurrenceRule({ ...monthly, monthMode: 'lastWeekday' }, '2026-12-10'),
    ).toMatchObject({ monthDay: 10 });
    expect(shownMonthMode('weekday', '2026-12-29')).toBe('day');
    expect(shownMonthMode('lastWeekday', '2026-12-29')).toBe('lastWeekday');
  });

  it('carries the interval, the weekend shift and the end', () => {
    const rule = toRecurrenceRule(
      { ...monthly, interval: '3', shift: 'next', end: 'count', count: '4' },
      '2026-01-15',
    );
    expect(rule).toEqual({
      frequency: 'monthly',
      interval: 3,
      startDate: '2026-01-15',
      monthDay: 15,
      shift: 'next',
      count: 4,
    });
    expect(
      toRecurrenceRule({ ...monthly, end: 'until', until: '2026-12-31' }, '2026-01-15'),
    ).toMatchObject({ until: '2026-12-31' });
  });

  it('is not ready while a number or the end date is missing', () => {
    expect(toRecurrenceRule({ ...monthly, interval: '0' }, '2026-01-15')).toBeNull();
    expect(toRecurrenceRule({ ...monthly, end: 'count', count: '' }, '2026-01-15')).toBeNull();
    expect(toRecurrenceRule({ ...monthly, end: 'until', until: '' }, '2026-01-15')).toBeNull();
    expect(toRecurrenceRule(monthly, '')).toBeNull();
  });

  it('keeps an edited series on its own start and day, not on a clamped occurrence', () => {
    const original = {
      frequency: 'monthly' as const,
      interval: 1,
      startDate: '2026-01-31',
      monthDay: 31,
    };
    // The April occurrence fell on the 30th; editing it must not make the series the 30th.
    expect(toRecurrenceRule(toRepeatDraft(original), '2026-04-30')).toEqual(original);
    // Switching to the last day is a change the person asked for.
    expect(
      toRecurrenceRule({ ...toRepeatDraft(original), monthMode: 'last' }, '2026-04-30'),
    ).toMatchObject({ startDate: '2026-01-31', monthDay: 'last' });
  });
});

describe('repeatPayload', () => {
  it('sends the rule and the reminder days of a new repeating bill', () => {
    const form = { ...createEmptyState('USD'), dueDate: '2026-05-01', repeat: monthly };
    form.remindDaysBefore = '7';
    expect(repeatPayload(form, null)).toEqual({
      recurrence: { frequency: 'monthly', interval: 1, startDate: '2026-05-01', monthDay: 1 },
      remindDaysBefore: 7,
    });
  });

  it('ends the series of a bill set back to "does not repeat"', () => {
    const bill = payableRow({
      id: 'p1',
      vendor: 'ACME Power',
      seriesId: 'p1',
      occurrenceDate: '2026-05-01',
      recurrence: { frequency: 'monthly', interval: 1, startDate: '2026-05-01' },
    });
    const form = { ...createEmptyState('USD'), dueDate: '2026-05-01' };
    expect(repeatPayload(form, bill)).toEqual({ recurrence: null, remindDaysBefore: 3 });
  });

  it('holds a repeating bill back until it has a due date', () => {
    const form = { ...createEmptyState('USD'), repeat: monthly };
    expect(repeatIsComplete(form, null)).toBe(false);
    expect(repeatIsComplete({ ...form, dueDate: '2026-05-01' }, null)).toBe(true);
  });
});
