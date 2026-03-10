import { useMemo } from 'react';
import { ENERGY_MIN, ENERGY_MAX_DEFAULT, energyColor } from '../../types/board';

interface EnergySliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Override the maximum energy value (defaults to ENERGY_MAX_DEFAULT) */
  max?: number;
  /** Allow deselecting (sets to undefined) */
  allowNone?: boolean;
  onClear?: () => void;
}

/** Range slider with an energyColor gradient track */
export function EnergySlider({ value, onChange, max, allowNone, onClear }: EnergySliderProps) {
  const eMax = max ?? ENERGY_MAX_DEFAULT;

  const gradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = ENERGY_MIN; i <= eMax; i++) {
      const pct = ((i - ENERGY_MIN) / (eMax - ENERGY_MIN)) * 100;
      stops.push(`${energyColor(i, undefined, eMax)} ${pct}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [eMax]);

  const color = energyColor(value, undefined, eMax);

  return (
    <div className="flex items-center gap-3">
      {allowNone && (
        <button
          type="button"
          onClick={onClear}
          className="font-body text-ohm-muted hover:text-ohm-text text-[10px] underline decoration-dotted"
        >
          None
        </button>
      )}
      <input
        type="range"
        min={ENERGY_MIN}
        max={eMax}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="energy-slider h-2 flex-1 cursor-pointer appearance-none rounded-full"
        style={{ background: gradient }}
        aria-label={`Energy: ${value}`}
      />
      <span className="font-display min-w-[1.5rem] text-center text-sm font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
