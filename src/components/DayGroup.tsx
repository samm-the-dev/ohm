import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DayGroup as DayGroupType } from '../utils/board-utils';
import type { OhmCard } from '../types/board';
import { budgetColor } from '../types/board';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card } from './Card';

interface DayGroupProps {
  group: DayGroupType;
  onCardTap: (card: OhmCard) => void;
  onReorder?: (idx: number, cardId: string, dir: -1 | 1) => void;
  /** Index offset — position of this group's first card in the flat column card list */
  indexOffset: number;
  energyMax?: number;
  /** Day energy limit for budget coloring (matches BudgetBar logic) */
  dayLimit?: number;
}

export function DayGroup({
  group,
  onCardTap,
  onReorder,
  indexOffset,
  energyMax,
  dayLimit,
}: DayGroupProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls={`day-group-${group.key}`}
        className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-white/5 ${
          group.isToday ? 'border-ohm-spark/40 border-l-2 pl-1' : ''
        }`}
      >
        <span className="text-ohm-muted" aria-hidden="true">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span
          className={`font-display text-xs tracking-wide uppercase ${
            group.isToday ? 'text-ohm-text font-bold' : 'text-ohm-muted'
          }`}
        >
          {group.label}
        </span>
        <span className="text-ohm-muted/50 font-body ml-1 text-xs">{group.cards.length}</span>
        <span
          className="font-display ml-auto text-xs font-bold"
          style={{ color: dayLimit ? budgetColor(group.energyTotal / dayLimit) : undefined }}
        >
          {group.energyTotal}
        </span>
      </button>

      {/* Cards */}
      {expanded && (
        <div id={`day-group-${group.key}`}>
          <SortableContext
            items={group.cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-1 flex flex-col gap-2">
              {group.cards.map((card, idx) => (
                <Card
                  key={card.id}
                  card={card}
                  onTap={onCardTap}
                  onReorder={
                    onReorder ? (dir) => onReorder(indexOffset + idx, card.id, dir) : undefined
                  }
                  energyMax={energyMax}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  );
}
