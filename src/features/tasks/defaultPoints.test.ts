import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDefaultPoints } from '@/features/tasks/defaultPoints';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDefaultPoints', () => {
  it('starts at 3 and remembers a choice for this user only', () => {
    const anna = renderHook(() => useDefaultPoints('anna'));
    expect(anna.result.current[0]).toBe(3);
    act(() => {
      anna.result.current[1](7);
    });
    expect(anna.result.current[0]).toBe(7);

    expect(renderHook(() => useDefaultPoints('anna')).result.current[0]).toBe(7);
    expect(renderHook(() => useDefaultPoints('ben')).result.current[0]).toBe(3);
  });

  it.each(['11', '-1', '2.5', 'many'])('ignores a stored %s', (stored) => {
    localStorage.setItem('homeflow:default-points:anna', stored);
    expect(renderHook(() => useDefaultPoints('anna')).result.current[0]).toBe(3);
  });

  it('falls back to 3 when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useDefaultPoints('anna'));
    expect(result.current[0]).toBe(3);
    act(() => {
      result.current[1](5);
    });
    expect(result.current[0]).toBe(5);
  });
});
