import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChartControls } from '../src/trade/use-chart-controls';

describe('useChartControls', () => {
  it('controls window, mode and layer visibility independently of tick data', () => {
    const { result } = renderHook(() => useChartControls({ initialWindowSeconds: 15 }));
    expect(result.current.windowSeconds).toBe(15);
    expect(result.current.mode).toBe('line');

    act(() => {
      result.current.setWindowSeconds(60);
      result.current.setMode('candle');
      result.current.toggleLayer('yes');
    });

    expect(result.current.windowSeconds).toBe(60);
    expect(result.current.mode).toBe('candle');
    expect(result.current.isLayerVisible('yes')).toBe(false);
    expect(result.current.isLayerVisible('no')).toBe(true);
  });
});
