import { useRef, useEffect } from 'react';
import { budgetColor } from '../types/board';

interface BudgetBarProps {
  daily: Array<{ date: string; used: number }>;
  dayLimit: number;
  total: { used: number; total: number };
  todayStr: string;
  onDayClick: (date: string) => void;
}

export function BudgetBar({ daily, dayLimit, total, todayStr, onDayClick }: BudgetBarProps) {
  const totalRatio = total.used / total.total;
  const totalColor = budgetColor(totalRatio);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--budget-bar-height', `${el.offsetHeight}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={barRef}
      className="border-ohm-border bg-ohm-bg/95 fixed right-0 bottom-0 left-0 z-[60] flex flex-col gap-1 border-t px-4 py-2 backdrop-blur-md"
    >
      {/* Daily row — day segments above total */}
      {daily.length > 0 && (
        <div className="flex gap-1">
          {daily.map(({ date, used }) => {
            const ratio = used / dayLimit;
            const color = used > 0 ? budgetColor(ratio) : undefined;
            const isToday = date === todayStr;
            const d = new Date(date + 'T00:00:00');
            const dayInitial = d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
            const dateNum = d.getDate();
            return (
              <button
                key={date}
                type="button"
                onClick={() => onDayClick(date)}
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-white/5"
                title={`${date}: ${used}/${dayLimit}`}
              >
                <span
                  className={`font-display text-[11px] leading-tight ${isToday ? 'text-ohm-text font-bold' : 'text-ohm-muted'}`}
                >
                  {dayInitial}&nbsp;{dateNum}
                </span>
                <div className="bg-ohm-border relative h-1 w-full overflow-hidden rounded-full">
                  {used > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(ratio, 1) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  )}
                </div>
                <span
                  className={`font-display text-[11px] leading-none font-bold ${used === 0 ? 'text-ohm-muted/30' : ''}`}
                  style={color ? { color } : undefined}
                >
                  {used}/{dayLimit}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Total row — full-width bar below daily */}
      <div className="flex items-center gap-3">
        <span className="font-display text-ohm-muted w-10 shrink-0 text-[11px] tracking-widest uppercase">
          Total
        </span>
        <div className="bg-ohm-border relative h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(totalRatio, 1) * 100}%`, backgroundColor: totalColor }}
          />
        </div>
        <span
          className={`font-display w-10 shrink-0 text-right text-xs font-bold ${total.used > total.total ? 'animate-pulse' : ''}`}
          style={{ color: totalColor }}
        >
          {total.used}/{total.total}
        </span>
      </div>
    </div>
  );
}
