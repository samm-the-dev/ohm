import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { OhmCard, OhmColumn as OhmColumnType } from '../types/board';
import { ENERGY_MIN, ENERGY_MAX, energyColor } from '../types/board';
import { Card } from './Card';

interface ColumnProps {
  column: OhmColumnType;
  cards: OhmCard[];
  onCardTap: (card: OhmCard) => void;
  onReorderCards?: (orderedIds: string[], movedId: string) => void;
  capacity?: { used: number; total: number };
  defaultExpanded?: boolean;
  flash?: boolean;
}

export function Column({
  column,
  cards,
  onCardTap,
  onReorderCards,
  capacity,
  defaultExpanded = false,
  flash,
}: ColumnProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleReorder = useCallback(
    (idx: number, cardId: string, dir: -1 | 1) => {
      if (!onReorderCards) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= cards.length) return;
      const ids = cards.map((c) => c.id);
      ids.splice(idx, 1);
      ids.splice(newIdx, 0, cardId);
      onReorderCards(ids, cardId);
    },
    [cards, onReorderCards],
  );

  return (
    <div className="flex w-full min-w-0 flex-col rounded-xl md:w-auto md:flex-1">
      {/* Column header — mobile: button toggle, desktop: static */}
      <div
        className={`bg-ohm-bg/80 sticky top-0 z-10 mb-1 flex w-full items-center rounded-lg px-3 py-2 backdrop-blur-xs transition-shadow duration-500 ${flash ? 'animate-completion-flash' : ''}`}
      >
        {/* Mobile toggle button — full width for easy tapping */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={`column-cards-${column.label}`}
          className="focus-visible:ring-ring flex w-full items-center gap-2 rounded-sm focus-visible:ring-1 focus-visible:outline-hidden md:hidden"
        >
          <span className="text-ohm-muted" aria-hidden="true">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <div className={`h-2 w-2 rounded-full bg-${column.color}`} aria-hidden="true" />
          <h2 className="font-display text-ohm-text text-xs font-bold tracking-widest uppercase">
            {column.label}
          </h2>
          <span className="font-body text-ohm-muted ml-1 text-[10px]">{cards.length}</span>
          {capacity && (
            <span
              className={`font-display ml-auto shrink-0 text-[10px] font-bold ${capacity.used > capacity.total ? 'animate-pulse' : ''}`}
              style={{
                color: energyColor(
                  ENERGY_MIN +
                    Math.min(capacity.used / capacity.total, 1) * (ENERGY_MAX - ENERGY_MIN),
                ),
              }}
            >
              {capacity.used}/{capacity.total}
            </span>
          )}
        </button>
        {/* Desktop static header */}
        <div className="hidden items-center gap-2 md:flex md:w-full">
          <div className={`h-2 w-2 rounded-full bg-${column.color}`} aria-hidden="true" />
          <h2 className="font-display text-ohm-text text-xs font-bold tracking-widest uppercase">
            {column.label}
          </h2>
          <span className="font-body text-ohm-muted ml-1 text-[10px]">{cards.length}</span>
          {capacity && (
            <span
              className={`font-display ml-auto shrink-0 text-[10px] font-bold ${capacity.used > capacity.total ? 'animate-pulse' : ''}`}
              style={{
                color: energyColor(
                  ENERGY_MIN +
                    Math.min(capacity.used / capacity.total, 1) * (ENERGY_MAX - ENERGY_MIN),
                ),
              }}
            >
              {capacity.used}/{capacity.total}
            </span>
          )}
        </div>
      </div>

      {/* Cards — hidden on mobile when collapsed, always visible on md+ */}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          id={`column-cards-${column.label}`}
          className={`flex-col gap-2 px-2 pb-4 ${expanded ? 'flex min-h-[60px]' : 'hidden'} md:flex md:min-h-[100px]`}
        >
          {cards.map((card, idx) => (
            <Card
              key={card.id}
              card={card}
              onTap={onCardTap}
              onReorder={(dir) => handleReorder(idx, card.id, dir)}
            />
          ))}
          {cards.length === 0 && (
            <div className="font-body text-ohm-muted/40 py-8 text-center text-xs italic">
              {column.description}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
