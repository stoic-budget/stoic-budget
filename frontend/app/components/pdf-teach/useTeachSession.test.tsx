import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import { useTeachSession } from './useTeachSession';

vi.mock('@/app/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const area = { page: 1, x0: 10, y0: 10, x1: 60, y1: 80 };

describe('useTeachSession', () => {
  it('arms drawing when a tag is taken, and disarms it after one area', () => {
    const { result } = renderHookWithQuery(() => useTeachSession(null));
    expect(result.current.armed).toBe(false);
    act(() => result.current.setActiveTag('description'));
    expect(result.current).toMatchObject({ armed: true, activeTag: 'description' });
    // A tap without a drag draws nothing and keeps the tag ready.
    act(() => result.current.addRegion({ page: 1, x0: 10, y0: 10, x1: 11, y1: 11 }));
    expect(result.current).toMatchObject({ armed: true, regions: [] });
    act(() => result.current.addRegion(area));
    expect(result.current.armed).toBe(false);
    expect(result.current.regions).toEqual([{ ...area, tag: 'description' }]);
  });

  it('lets the finger scroll again when the armed tag is taken again', () => {
    const { result } = renderHookWithQuery(() => useTeachSession(null));
    act(() => result.current.setActiveTag('date'));
    expect(result.current.armed).toBe(true);
    act(() => result.current.setActiveTag('date'));
    expect(result.current).toMatchObject({ armed: false, activeTag: 'date' });
    act(() => result.current.setActiveTag('credit'));
    expect(result.current).toMatchObject({ armed: true, activeTag: 'credit' });
  });
});
