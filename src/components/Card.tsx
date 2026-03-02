import { useState, useEffect } from 'react';
import { ArrowRight, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { OhmCard } from '../types/board';
import { STATUS, ENERGY_CONFIG, ENERGY_CLASSES } from '../types/board';
import { Card as CardContainer } from './ui/card';
import { Badge } from './ui/badge';

interface CardProps {
  card: OhmCard;
  onTap: (card: OhmCard) => void;
}

const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function Card({ card, onTap }: CardProps) {
  const energyInfo = ENERGY_CONFIG[card.energy]!;
  const EnergyIcon = energyInfo.icon;

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
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onTap(card)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(card);
        }
      }}
    >
      <CardContainer
        className={`group border-ohm-border bg-ohm-surface p-3 shadow-none transition-all duration-150 active:scale-[0.98] ${isDragging ? 'z-50 opacity-40' : isStale ? 'opacity-50' : ''}`}
      >
        {/* Title row with drag handle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            {...listeners}
            className="-ml-1 mt-px shrink-0 cursor-grab touch-none rounded p-0.5 text-ohm-muted/40 transition-colors hover:text-ohm-muted active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100"
            aria-label="Drag to reorder"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
          <p className="min-w-0 flex-1 font-body text-sm font-medium leading-snug text-ohm-text">
            {card.title}
          </p>
        </div>

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`flex items-center gap-1 ${ENERGY_CLASSES[card.energy]!.text}`}
            title={energyInfo.label}
          >
            <EnergyIcon size={10} />
            <span className="font-body text-[10px] uppercase tracking-wider">
              {energyInfo.label}
            </span>
          </span>

          {/* Category pill */}
          {card.category && (
            <Badge
              variant="secondary"
              className="rounded bg-ohm-bg px-1.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider text-ohm-muted"
            >
              {card.category}
            </Badge>
          )}
        </div>

        {/* Notes preview */}
        {card.tasks.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-ohm-border pt-1.5 text-xs text-ohm-muted">
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
