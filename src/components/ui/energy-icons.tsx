import type { SVGProps } from 'react';

interface EnergyIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  /** Number of filled bars (1-6) */
  value?: number;
}

const TOTAL_BARS = 6;
const BAR_WIDTH = 3;
const BAR_GAP = 1;
const BAR_HEIGHT = 16;
const PADDING = 1;
const VIEW_WIDTH = PADDING * 2 + TOTAL_BARS * BAR_WIDTH + (TOTAL_BARS - 1) * BAR_GAP;
const VIEW_HEIGHT = BAR_HEIGHT + PADDING * 2;

/** Parametric energy icon — renders `value` filled bars out of 6 */
export function EnergyIcon({ size = 24, value = 3, ...props }: EnergyIconProps) {
  const clamped = Math.max(1, Math.min(TOTAL_BARS, Math.round(value)));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      {...props}
    >
      {Array.from({ length: TOTAL_BARS }, (_, i) => (
        <rect
          key={i}
          x={PADDING + i * (BAR_WIDTH + BAR_GAP)}
          y={PADDING}
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
          rx={0.5}
          fill={i < clamped ? 'currentColor' : 'currentColor'}
          opacity={i < clamped ? 1 : 0.15}
        />
      ))}
    </svg>
  );
}
