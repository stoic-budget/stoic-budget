import { describe, expect, it } from 'vitest';
import { fill, formatBytes, formatWait } from './health-format';

describe('health-format', () => {
  it('fills slots literally, even with replacement patterns in a value', () => {
    expect(fill('Links point to {{url}}.', { url: 'https://a.example.co.il/$&$1' })).toBe(
      'Links point to https://a.example.co.il/$&$1.',
    );
    expect(fill('{{missing}} stays', {})).toBe('{{missing}} stays');
  });

  it('words a wait in minutes, hours or days', () => {
    expect(formatWait(40, 'en')).toBe('1 minute');
    expect(formatWait(12 * 60, 'en')).toBe('12 minutes');
    expect(formatWait(3 * 3600, 'en')).toBe('3 hours');
    expect(formatWait(3 * 86400, 'en')).toBe('3 days');
  });

  it('words free space in GB, or MB under one', () => {
    expect(formatBytes(1.5 * 1024 ** 3, 'en')).toBe('1.5 GB');
    expect(formatBytes(512 * 1024 ** 2, 'en')).toBe('512 MB');
  });
});
