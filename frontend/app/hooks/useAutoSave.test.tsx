import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from './useAutoSave';

type Payload = {
  value: string;
};

function Harness({
  data,
  enabled,
  onSave,
}: {
  data: Payload;
  enabled: boolean;
  onSave: (payload: Payload) => Promise<void>;
}) {
  useAutoSave({
    data,
    enabled,
    onSave,
    debounceMs: 500,
  });

  return null;
}

describe('useAutoSave', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.useRealTimers();
  });

  it('does not save on initial render', async () => {
    const onSave = vi.fn(async () => undefined);

    await act(async () => {
      root.render(<Harness data={{ value: 'initial' }} enabled={true} onSave={onSave} />);
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves after debounce when data changes', async () => {
    const onSave = vi.fn(async () => undefined);

    await act(async () => {
      root.render(<Harness data={{ value: 'initial' }} enabled={true} onSave={onSave} />);
    });

    await act(async () => {
      root.render(<Harness data={{ value: 'updated' }} enabled={true} onSave={onSave} />);
    });

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ value: 'updated' });
  });

  it('sends the pending save when the page goes away within the debounce', async () => {
    const onSave = vi.fn(async () => undefined);

    await act(async () => {
      root.render(<Harness data={{ value: 'initial' }} enabled={true} onSave={onSave} />);
    });

    await act(async () => {
      root.render(<Harness data={{ value: 'updated' }} enabled={true} onSave={onSave} />);
    });

    await act(async () => {
      root.unmount();
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ value: 'updated' });
  });

  it('retries a value whose save failed when it is typed again', async () => {
    const onSave = vi
      .fn<(payload: Payload) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);

    await act(async () => {
      root.render(<Harness data={{ value: 'initial' }} enabled={true} onSave={onSave} />);
    });
    await act(async () => {
      root.render(<Harness data={{ value: 'updated' }} enabled={true} onSave={onSave} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      root.render(<Harness data={{ value: 'updated' }} enabled={true} onSave={onSave} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith({ value: 'updated' });
  });
  it('sends what was typed when the form is disabled for a reload', async () => {
    const onSave = vi.fn(async () => undefined);

    await act(async () => {
      root.render(<Harness data={{ value: 'initial' }} enabled={true} onSave={onSave} />);
    });
    await act(async () => {
      root.render(<Harness data={{ value: 'updated' }} enabled={true} onSave={onSave} />);
    });
    await act(async () => {
      root.render(<Harness data={{ value: 'updated' }} enabled={false} onSave={onSave} />);
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ value: 'updated' });
  });

  it('does not let an older save answering late stand in for a newer value', async () => {
    let finishFirst: () => void = () => undefined;
    const onSave = vi
      .fn<(payload: Payload) => Promise<void>>()
      .mockImplementationOnce(() => new Promise(resolve => (finishFirst = () => resolve())))
      .mockResolvedValue(undefined);
    const show = async (value: string) => {
      await act(async () => {
        root.render(<Harness data={{ value }} enabled={true} onSave={onSave} />);
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
    };

    await act(async () => {
      root.render(<Harness data={{ value: 'initial' }} enabled={true} onSave={onSave} />);
    });
    await show('100');
    await show('200');
    await act(async () => finishFirst());
    await show('100');

    expect(onSave.mock.calls.map(([payload]) => payload.value)).toEqual(['100', '200', '100']);
  });
});
