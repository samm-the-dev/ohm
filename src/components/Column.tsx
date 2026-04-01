import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { OhmCard, OhmColumn as OhmColumnType } from '../types/board';
import { budgetColor } from '../types/board';
import type { DayGroup as DayGroupType } from '../utils/board-utils';
import { toISODate } from '../utils/schedule-utils';
import { Card } from './Card';
import { DayGroup } from './DayGroup';

interface ColumnProps {
  column: OhmColumnType;
  cards: OhmCard[];
  onCardTap: (card: OhmCard) => void;
  onReorderCards?: (orderedIds: string[], movedId: string) => void;
  capacity?: { used: number; total: number };
  defaultExpanded?: boolean;
  flash?: boolean;
  energyMax?: number;
  /** When provided, renders cards grouped by date instead of flat */
  dayGroups?: DayGroupType[];
  /** Day energy limit for budget coloring in group headers */
  dayLimit?: number;
  /** Active date filter — matching day groups expand regardless of proximity */
  filterDate?: string | null;
  /** Show expanded card layout (description, full tasks) */
  expandedCards?: boolean;
}

export function Column({
  column,
  cards,
  onCardTap,
  onReorderCards,
  capacity,
  defaultExpanded = false,
  flash,
  energyMax,
  dayGroups,
  dayLimit,
  filterDate,
  expandedCards,
}: ColumnProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  /** Dates near today that should default to expanded in day groups */
  const nearbyDates = useMemo(() => {
    if (!dayGroups) return undefined;
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dates = new Set([toISODate(now), toISODate(yesterday), toISODate(tomorrow)]);
    if (filterDate) dates.add(filterDate);
    return dates;
  }, [dayGroups, filterDate]);

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
          <h2 className="font-display text-ohm-text text-sm font-bold tracking-widest uppercase">
            {column.label}
          </h2>
          <span className="font-body text-ohm-muted ml-1 text-xs">{cards.length}</span>
          {capacity && (
            <span
              className={`font-display ml-auto shrink-0 text-xs font-bold ${capacity.used > capacity.total ? 'animate-pulse' : ''}`}
              style={{ color: budgetColor(capacity.used / capacity.total) }}
            >
              {capacity.used}/{capacity.total}
            </span>
          )}
        </button>
        {/* Desktop static header */}
        <div className="hidden items-center gap-2 md:flex md:w-full">
          <div className={`h-2 w-2 rounded-full bg-${column.color}`} aria-hidden="true" />
          <h2 className="font-display text-ohm-text text-sm font-bold tracking-widest uppercase">
            {column.label}
          </h2>
          <span className="font-body text-ohm-muted ml-1 text-xs">{cards.length}</span>
          {capacity && (
            <span
              className={`font-display ml-auto shrink-0 text-xs font-bold ${capacity.used > capacity.total ? 'animate-pulse' : ''}`}
              style={{ color: budgetColor(capacity.used / capacity.total) }}
            >
              {capacity.used}/{capacity.total}
            </span>
          )}
        </div>
      </div>

      {/* Cards — hidden on mobile when collapsed, always visible on md+ */}
      <div
        id={`column-cards-${column.label}`}
        className={`flex-col gap-2 px-2 pb-4 ${expanded ? 'flex min-h-[60px]' : 'hidden'} md:flex md:min-h-[100px]`}
      >
        {dayGroups ? (
          (() => {
            let offset = 0;
            return dayGroups.map((group) => {
              const currentOffset = offset;
              offset += group.cards.length;
              return (
                <DayGroup
                  key={group.key}
                  group={group}
                  onCardTap={onCardTap}
                  onReorder={onReorderCards ? handleReorder : undefined}
                  indexOffset={currentOffset}
                  energyMax={energyMax}
                  dayLimit={dayLimit}
                  defaultExpanded={nearbyDates?.has(group.key) ?? true}
                />
              );
            });
          })()
        ) : (
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((card, idx) => (
              <Card
                key={card.id}
                card={card}
                onTap={onCardTap}
                onReorder={(dir) => handleReorder(idx, card.id, dir)}
                energyMax={energyMax}
                expanded={expandedCards}
              />
            ))}
          </SortableContext>
        )}
        {cards.length === 0 && (
          <div className="font-body text-ohm-muted/40 py-8 text-center text-xs italic">
            {column.description}
          </div>
        )}
      </div>
    </div>
  );
}
