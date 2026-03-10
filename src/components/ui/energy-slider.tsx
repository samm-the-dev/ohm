import { useMemo } from 'react';
import { ENERGY_MIN, ENERGY_MAX, energyColor } from '../../types/board';

interface EnergySliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Allow deselecting (sets to undefined) */
  allowNone?: boolean;
  onClear?: () => void;
}

/** Range slider with an energyColor gradient track */
export function EnergySlider({ value, onChange, allowNone, onClear }: EnergySliderProps) {
  const gradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = ENERGY_MIN; i <= ENERGY_MAX; i++) {
      const pct = ((i - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN)) * 100;
      stops.push(`${energyColor(i)} ${pct}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, []);

  const color = energyColor(value);

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
        max={ENERGY_MAX}
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
