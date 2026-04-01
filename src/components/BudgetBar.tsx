import { useRef, useEffect } from 'react';
import { budgetColor, energyColor } from '../types/board';

interface DayData {
  date: string;
  count: number;
  avgEnergy: number;
}

interface BudgetBarProps {
  daily: DayData[];
  dailyLimit: number;
  total: { count: number; limit: number };
  todayCount: number;
  todayStr: string;
  energyMax: number;
  onDayClick: (date: string) => void;
}

export function BudgetBar({
  daily,
  dailyLimit,
  total,
  todayCount,
  todayStr,
  energyMax,
  onDayClick,
}: BudgetBarProps) {
  const totalRatio = total.limit > 0 ? total.count / total.limit : 0;
  const totalColor = budgetColor(totalRatio);
  const barRef = useRef<HTMLDivElement>(null);
  const overflow = todayCount - dailyLimit;

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
      {/* Daily row — day segments */}
      {daily.length > 0 && (
        <div className="flex gap-1">
          {daily.map(({ date, count, avgEnergy }) => {
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
                title={`${date}: ${count}/${dailyLimit}`}
              >
                <span
                  className={`font-display text-[11px] leading-tight ${isToday ? 'text-ohm-text font-bold' : 'text-ohm-muted'}`}
                >
                  {dayInitial}&nbsp;{dateNum}
                </span>
                <div className="flex w-full justify-center gap-0.5">
                  {Array.from({ length: dailyLimit }, (_, i) => {
                    const filled = i < count;
                    const pipColor =
                      filled && avgEnergy > 0
                        ? energyColor(avgEnergy, undefined, energyMax)
                        : undefined;
                    return (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${filled ? '' : 'bg-ohm-border'}`}
                        style={
                          filled
                            ? {
                                backgroundColor: pipColor ?? budgetColor(count / dailyLimit),
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
                <span
                  className={`font-display text-[11px] leading-none font-bold ${count === 0 ? 'text-ohm-muted/30' : ''}`}
                  style={count > 0 ? { color: budgetColor(count / dailyLimit) } : undefined}
                >
                  {count}/{dailyLimit}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Total row — item count across forward window */}
      <div className="flex items-center gap-3">
        <span className="font-display text-ohm-muted w-10 shrink-0 text-[11px] tracking-widest uppercase">
          Total
        </span>
        <div className="bg-ohm-border relative h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(totalRatio, 1) * 100}%`,
              backgroundColor: totalColor,
            }}
          />
        </div>
        <span
          className={`font-display w-10 shrink-0 text-right text-xs font-bold ${total.count > total.limit ? 'animate-pulse' : ''}`}
          style={{ color: totalColor }}
        >
          {total.count}/{total.limit}
        </span>
      </div>
    </div>
  );
}
