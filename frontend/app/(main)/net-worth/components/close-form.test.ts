import { describe, expect, it } from 'vitest';
import { buildClose, localToday } from './close-form';

const TODAY = '2026-03-10';

describe('buildClose', () => {
  it('sends the date and the price as typed, in either decimal style', () => {
    expect(buildClose({ date: '2026-03-09', close: '101,5' }, TODAY)).toEqual({
      date: '2026-03-09',
      close: 101.5,
    });
    expect(buildClose({ date: TODAY, close: '0.00000001' }, TODAY)).toEqual({
      date: TODAY,
      close: 0.00000001,
    });
  });

  it('refuses what the server would refuse', () => {
    expect(buildClose({ date: '2026-03-11', close: '10' }, TODAY)).toBeNull();
    expect(buildClose({ date: '', close: '10' }, TODAY)).toBeNull();
    expect(buildClose({ date: TODAY, close: '0' }, TODAY)).toBeNull();
    expect(buildClose({ date: TODAY, close: '0.000000001' }, TODAY)).toBeNull();
    expect(buildClose({ date: TODAY, close: '1000000000000' }, TODAY)).toBeNull();
    expect(buildClose({ date: TODAY, close: 'ten' }, TODAY)).toBeNull();
    expect(buildClose({ date: TODAY, close: '' }, TODAY)).toBeNull();
  });
});

describe('localToday', () => {
  it('is a date in the YYYY-MM-DD form', () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
