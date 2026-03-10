import { useState, useEffect } from 'react';
import { ArrowRight, GripVertical, Repeat } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { OhmCard } from '../types/board';
import { STATUS, energyColor } from '../types/board';
import { Card as CardContainer } from './ui/card';
import { Badge } from './ui/badge';

interface CardProps {
  card: OhmCard;
  onTap: (card: OhmCard) => void;
  onReorder?: (direction: -1 | 1) => void;
}

const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function Card({ card, onTap, onReorder }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    const stale =
      (card.status === STATUS.CHARGING || card.status === STATUS.GROUNDED) &&
      Date.now() - new Date(card.updatedAt).getTime() > STALE_THRESHOLD_MS;
    const id = setTimeout(() => setIsStale(stale), 0);
    return () => clearTimeout(id);
  }, [card.status, card.updatedAt]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-roledescription="sortable"
      className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-hidden"
      onClick={() => onTap(card)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(card);
        } else if (onReorder && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          onReorder(e.key === 'ArrowUp' ? -1 : 1);
        }
      }}
    >
      <CardContainer
        className={`group border-ohm-border bg-ohm-surface p-3 shadow-none transition-all duration-150 active:scale-[0.98] ${isDragging ? 'z-50 opacity-40' : isStale ? 'opacity-50' : ''}`}
      >
        {/* Title row with drag handle */}
        <div className="flex items-center gap-1.5">
          {card.activityInstanceId && (
            <Repeat size={12} className="text-ohm-muted shrink-0" aria-label="Recurring" />
          )}
          <p className="font-body text-ohm-text min-w-0 flex-1 text-sm leading-snug font-medium">
            {card.title}
          </p>
          <button
            type="button"
            {...listeners}
            className="text-ohm-muted/40 hover:text-ohm-muted -mr-1 shrink-0 cursor-grab touch-none rounded p-1.5 transition-colors active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100"
            aria-label="Drag to reorder"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={18} />
          </button>
        </div>

        {/* Scheduled date */}
        {card.scheduledDate && (
          <p className="font-body text-ohm-muted mt-1 text-[10px]">{card.scheduledDate}</p>
        )}

        {/* Meta row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className="font-display inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
            style={{
              backgroundColor: energyColor(card.energy, 0.12),
              color: energyColor(card.energy),
            }}
          >
            {card.energy}
          </span>

          {/* Category pill */}
          {card.category && (
            <Badge
              variant="secondary"
              className="bg-ohm-bg font-body text-ohm-muted rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase"
            >
              {card.category}
            </Badge>
          )}
        </div>

        {/* Notes preview */}
        {card.tasks.length > 0 && (
          <div className="border-ohm-border text-ohm-muted mt-2 flex flex-col gap-1 border-t pt-1.5 text-xs">
            {card.tasks.map((note, i) => (
              <div key={i} className="flex items-start gap-1">
                <ArrowRight size={12} className="mt-0.5 shrink-0" />
                <span>{note.length > 60 ? note.slice(0, 60) + '...' : note}</span>
              </div>
            ))}
          </div>
        )}
      </CardContainer>
    </div>
  );
}
