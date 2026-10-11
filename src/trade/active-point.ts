export interface ActivePointStyle {
  color: string;
  background: string;
  outline: string;
  radius: number;
}

type ActivePointContext = Pick<CanvasRenderingContext2D, 'arc' | 'beginPath' | 'fill' | 'restore' | 'save' | 'stroke'> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  globalAlpha: number;
  lineWidth: number;
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
};

/** Paints a high-contrast marker centered on an inspected time-series point. */
export function drawActivePoint(
  context: ActivePointContext,
  x: number,
  y: number,
  style: ActivePointStyle,
) {
  const radius = Math.max(2, style.radius);
  context.save();
  context.globalAlpha = 1;

  context.fillStyle = style.background;
  context.beginPath();
  context.arc(x, y, radius + 2.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = style.color;
  context.strokeStyle = style.outline;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}
