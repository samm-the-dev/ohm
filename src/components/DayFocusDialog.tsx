import { useState } from 'react';
import { CalendarArrowUp, CalendarX, CalendarDays, GripVertical } from 'lucide-react';
import type { OhmBoard, OhmCard } from '../types/board';
import { STATUS, COLUMNS, energyColor, budgetColor } from '../types/board';
import { getCardsForDate } from '../utils/board-utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DayFocusDialogProps {
  date: string;
  board: OhmBoard;
  todayStr: string;
  energyMax: number;
  onReschedule: (cardId: string, newDate: string | undefined) => void;
  onReorder?: (activeId: string, overId: string) => void;
  onClose: () => void;
}

function formatDateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today';
  const today = new Date(todayStr + 'T00:00:00');
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (dateStr === tomorrowStr) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function getTomorrow(todayStr: string): string {
  const d = new Date(todayStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Group cards by column status for display */
function groupByStatus(
  cards: OhmCard[],
): Array<{ status: number; label: string; cards: OhmCard[] }> {
  const groups: Array<{ status: number; label: string; cards: OhmCard[] }> = [];
  for (const card of cards) {
    let group = groups.find((g) => g.status === card.status);
    if (!group) {
      group = { status: card.status, label: COLUMNS[card.status]!.label, cards: [] };
      groups.push(group);
    }
    group.cards.push(card);
  }
  return groups;
}

export function DayFocusDialog({
  date,
  board,
  todayStr,
  energyMax,
  onReschedule,
  onReorder,
  onClose,
}: DayFocusDialogProps) {
  const cards = getCardsForDate(board, date);
  const totalEnergy = cards.reduce((sum, c) => sum + c.energy, 0);
  const statusGroups = groupByStatus(cards);
  const label = formatDateLabel(date, todayStr);
  const tomorrowStr = getTomorrow(todayStr);
  const [draggingCard, setDraggingCard] = useState<OhmCard | null>(null);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    setDraggingCard(card ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingCard(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sourceCard = cards.find((c) => c.id === active.id);
    const overCard = cards.find((c) => c.id === over.id);
    if (!sourceCard || !overCard) return;
    // Only allow reorder within the same status section
    if (overCard.status !== sourceCard.status) return;
    onReorder?.(String(active.id), String(over.id));
  }

  function handleDragCancel() {
    setDraggingCard(null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onSwipeDismiss={onClose}>
        <DialogTitle className="font-display text-ohm-text flex items-center gap-3">
          <CalendarDays size={18} className="text-ohm-muted" />
          <span>{label}</span>
          <span
            className="font-display ml-auto text-sm font-bold"
            style={{ color: budgetColor(totalEnergy / board.liveCapacity) }}
          >
            {totalEnergy}/{board.liveCapacity}
          </span>
        </DialogTitle>
        <DialogDescription className="sr-only">
          Cards scheduled for {label} with energy breakdown and reschedule actions
        </DialogDescription>

        {cards.length === 0 ? (
          <p className="text-ohm-muted/60 font-body py-6 text-center text-base italic">
            No cards scheduled for this day
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="mt-3 space-y-4">
              {statusGroups.map((group) => {
                const col = COLUMNS[group.status]!;
                return (
                  <div key={group.status} className="rounded-lg p-1">
                    {/* Column-styled section header */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full bg-${col.color}`} aria-hidden="true" />
                      <h3 className="font-display text-ohm-text text-sm font-bold tracking-widest uppercase">
                        {group.label}
                      </h3>
                      <span className="font-body text-ohm-muted ml-1 text-xs">
                        {group.cards.length}
                      </span>
                    </div>
                    <SortableContext
                      items={group.cards.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {group.cards.map((card) => (
                          <SortableCardRow
                            key={card.id}
                            card={card}
                            energyMax={energyMax}
                            tomorrowStr={tomorrowStr}
                            onReschedule={onReschedule}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
            </div>
            <DragOverlay>
              {draggingCard && (
                <div className="border-ohm-border bg-ohm-bg/95 rounded-lg border p-2.5 opacity-80 shadow-lg">
                  <p className="font-body text-ohm-text truncate text-base font-medium">
                    {draggingCard.title}
                  </p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SortableCardRow({
  card,
  energyMax,
  tomorrowStr,
  onReschedule,
}: {
  card: OhmCard;
  energyMax: number;
  tomorrowStr: string;
  onReschedule: (cardId: string, newDate: string | undefined) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handle = (
    <button
      type="button"
      className="text-ohm-muted/40 hover:text-ohm-muted mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
      {...listeners}
      aria-label="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical size={14} />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} data-no-sheet-swipe>
      <CardRow
        card={card}
        energyMax={energyMax}
        tomorrowStr={tomorrowStr}
        onReschedule={onReschedule}
        handle={handle}
      />
    </div>
  );
}

function CardRow({
  card,
  energyMax,
  tomorrowStr,
  onReschedule,
  handle,
}: {
  card: OhmCard;
  energyMax: number;
  tomorrowStr: string;
  onReschedule: (cardId: string, newDate: string | undefined) => void;
  handle?: React.ReactNode;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <div className="border-ohm-border bg-ohm-bg/50 rounded-lg border p-2.5">
      <div className="flex items-start gap-2">
        {/* Energy badge */}
        <span
          className="font-display mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: energyColor(card.energy, 0.12, energyMax),
            color: energyColor(card.energy, undefined, energyMax),
          }}
        >
          {card.energy}
        </span>

        {/* Title + category */}
        <div className="min-w-0 flex-1">
          <p className="font-body text-ohm-text truncate text-base font-medium">{card.title}</p>
          {card.category && <span className="text-ohm-muted text-xs">{card.category}</span>}
        </div>

        {/* Drag handle */}
        {handle}
      </div>

      {/* Quick actions — hidden for Powered cards and activity-linked cards (dates managed by ActivityInstance) */}
      {card.status !== STATUS.POWERED && !card.activityInstanceId && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onReschedule(card.id, tomorrowStr)}
            className="text-ohm-muted hover:text-ohm-text flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-white/5"
            title="Move to tomorrow"
          >
            <CalendarArrowUp size={12} />
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setShowDatePicker((prev) => !prev)}
            className="text-ohm-muted hover:text-ohm-text flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-white/5"
            title="Pick a date"
          >
            <CalendarDays size={12} />
            Pick date
          </button>
          <button
            type="button"
            onClick={() => onReschedule(card.id, undefined)}
            className="text-ohm-muted hover:text-ohm-text flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-white/5"
            title="Clear scheduled date"
          >
            <CalendarX size={12} />
            Clear
          </button>

          {showDatePicker && (
            <input
              type="date"
              className="border-ohm-border bg-ohm-bg text-ohm-text ml-auto rounded border px-1.5 py-0.5 text-sm"
              onChange={(e) => {
                if (e.target.value) {
                  onReschedule(card.id, e.target.value);
                  setShowDatePicker(false);
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
