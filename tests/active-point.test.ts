import { describe, expect, it, vi } from 'vitest';
import { drawActivePoint } from '../src/trade/active-point';

describe('drawActivePoint', () => {
  it('draws a background halo and a high-contrast dot at the inspected coordinate', () => {
    const context = {
      arc: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      globalAlpha: 0.4,
      lineWidth: 0,
      restore: vi.fn(),
      save: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
    };

    drawActivePoint(context, 120, 48, {
      color: '#1d9bf0',
      background: '#ffffff',
      outline: '#0f172a',
      radius: 5,
    });

    expect(context.arc.mock.calls).toEqual([
      [120, 48, 7.5, 0, Math.PI * 2],
      [120, 48, 5, 0, Math.PI * 2],
    ]);
    expect(context.fill).toHaveBeenCalledTimes(2);
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.save).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
    expect(context.globalAlpha).toBe(1);
    expect(context.fillStyle).toBe('#1d9bf0');
    expect(context.strokeStyle).toBe('#0f172a');
    expect(context.lineWidth).toBe(1.5);
  });

  it('keeps the marker visible when a too-small radius is requested', () => {
    const context = {
      arc: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), fillStyle: '', globalAlpha: 1,
      lineWidth: 0, restore: vi.fn(), save: vi.fn(), stroke: vi.fn(), strokeStyle: '',
    };
    drawActivePoint(context, 10, 20, { color: '#fff', background: '#000', outline: '#fff', radius: 0 });
    expect(context.arc.mock.calls.map((call) => call[2])).toEqual([4.5, 2]);
  });
});
