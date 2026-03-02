import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Settings, Plus, CloudOff, SlidersHorizontal, Search, X, Tag } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { OhmCard, EnergyTag, ColumnStatus } from '../types/board';
import { STATUS, COLUMNS, ENERGY_CONFIG, ENERGY_CLASSES } from '../types/board';
import { createCard, getColumnCards, getColumnCapacity } from '../utils/board-utils';
import { useBoard } from '../hooks/useBoard';
import { useDriveSync } from '../hooks/useDriveSync';
import { useWelcomeBack } from '../hooks/useWelcomeBack';
import { Button } from './ui/button';
import { Column } from './Column';
import { CardDetail } from './CardDetail';
import { SettingsDialog } from './SettingsDialog';
import { SyncIndicator } from './SyncIndicator';
import { toastCardMoved, toastCardDeleted, toastQuickAdd } from '../utils/toast';

function CategoryFilter({
  categories,
  selected,
  onToggle,
}: {
  categories: string[];
  selected: string[];
  onToggle: (cat: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const available = categories.filter((c) => !selected.includes(c));
  const matches = query
    ? available.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : available;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex flex-wrap items-center gap-1.5">
      {selected.map((cat) => (
        <span
          key={cat}
          className="flex items-center gap-1 rounded-full bg-ohm-text/10 px-2 py-0.5 font-body text-[11px] text-ohm-text"
        >
          {cat}
          <button
            type="button"
            onClick={() => onToggle(cat)}
            className="text-ohm-muted hover:text-ohm-text"
            aria-label={`Remove ${cat}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <div className="relative">
          <div className="relative flex items-center">
            <Tag size={10} className="absolute left-2 text-ohm-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={selected.length ? '+ Add' : 'Category...'}
              aria-label="Filter categories"
              className={`${selected.length ? 'w-16' : 'w-24'} rounded-full border border-ohm-border bg-transparent py-1 pl-6 pr-2 font-body text-[11px] text-ohm-text placeholder:text-ohm-muted/40 focus:outline-none focus:ring-1 focus:ring-ohm-text/10`}
            />
          </div>
          {open && matches.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-40 w-36 overflow-y-auto rounded-lg border border-ohm-border bg-ohm-surface shadow-lg">
              {matches.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onToggle(cat);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left font-body text-[11px] text-ohm-muted transition-colors hover:bg-ohm-text/5 hover:text-ohm-text"
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Board() {
  const {
    board,
    quickAdd,
    updateCard,
    deleteCard,
    restoreCard,
    reorderBatch,
    addCategory,
    removeCategory,
    renameCategory,
    setCapacity,
    replaceBoard,
  } = useBoard();

  // Drag-and-drop sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const [draggingCard, setDraggingCard] = useState<OhmCard | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = board.cards.find((c) => c.id === event.active.id);
      setDraggingCard(card ?? null);
    },
    [board.cards],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingCard(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const draggedCard = board.cards.find((c) => c.id === active.id);
      const overCard = board.cards.find((c) => c.id === over.id);
      if (!draggedCard || !overCard) return;

      // Only reorder within same column
      if (draggedCard.status !== overCard.status) return;

      const columnCards = getColumnCards(board, draggedCard.status);
      const oldIndex = columnCards.findIndex((c) => c.id === active.id);
      const newIndex = columnCards.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(columnCards, oldIndex, newIndex);
      reorderBatch(
        reordered.map((c) => c.id),
        String(active.id),
      );
    },
    [board, reorderBatch],
  );

  const handleDragCancel = useCallback(() => {
    setDraggingCard(null);
  }, []);

  const {
    driveAvailable,
    driveConnected,
    syncStatus,
    needsReconnect,
    connect,
    disconnect,
    manualSync,
    queueSync,
  } = useDriveSync(board, replaceBoard);

  // Queue Drive sync whenever board changes
  useEffect(() => {
    queueSync(board);
  }, [board, queueSync]);

  const { summary: welcomeBack, dismiss: dismissWelcome } = useWelcomeBack(board);

  // Completion flash — column header animation (toast handled in onSave)
  const [poweredFlash, setPoweredFlash] = useState(false);

  const [selectedCard, setSelectedCard] = useState<OhmCard | null>(null);
  const [newCard, setNewCard] = useState<OhmCard | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [energyFilter, setEnergyFilter] = useState<EnergyTag | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredCards = (status: ColumnStatus) => {
    let cards = getColumnCards(board, status);
    if (energyFilter !== null) cards = cards.filter((c) => c.energy === energyFilter);
    if (categoryFilter.length > 0) cards = cards.filter((c) => categoryFilter.includes(c.category));
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      cards = cards.filter(
        (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      );
    }
    return cards;
  };

  const hasActiveFilter = energyFilter !== null || categoryFilter.length > 0 || searchFilter !== '';
  const hasAdvancedFilter = categoryFilter.length > 0 || searchFilter !== '';
  const advancedFilterCount = categoryFilter.length + (searchFilter ? 1 : 0);

  const toggleCategory = (cat: string) => {
    setCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const resetFilters = () => {
    setEnergyFilter(null);
    setCategoryFilter([]);
    setSearchFilter('');
  };

  const handleQuickSpark = () => {
    setNewCard(createCard(''));
  };

  const activeCard = selectedCard || newCard;

  return (
    <div className="flex min-h-screen flex-col bg-ohm-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-ohm-border bg-ohm-bg/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left -- settings (desktop only) */}
          <div className="flex w-20 items-center">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden rounded-md p-1.5 text-ohm-muted transition-colors hover:bg-ohm-surface hover:text-ohm-text md:block"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Center -- title */}
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-ohm-spark" />
            <span className="font-display text-sm font-bold uppercase tracking-widest text-ohm-text">
              Ohm
            </span>
          </div>

          {/* Right -- quick spark (desktop) + sync indicator */}
          <div className="flex w-20 items-center justify-end gap-1">
            <button
              type="button"
              onClick={handleQuickSpark}
              className="hidden rounded-md p-1.5 text-ohm-spark transition-colors hover:bg-ohm-spark/10 md:block"
              aria-label="Quick spark"
            >
              <Plus size={16} />
            </button>
            {driveAvailable && (
              <SyncIndicator connected={driveConnected} status={syncStatus} onSync={manualSync} />
            )}
          </div>
        </div>
      </header>

      {/* Reconnect banner */}
      {needsReconnect && !driveConnected && (
        <div className="flex items-center justify-center gap-3 border-b border-ohm-border bg-ohm-surface px-4 py-2">
          <CloudOff size={14} className="text-ohm-muted" />
          <span className="font-body text-xs text-ohm-muted">
            This board was previously synced with Google Drive.
          </span>
          <button
            type="button"
            onClick={connect}
            className="font-display text-xs uppercase tracking-wider text-ohm-spark transition-colors hover:text-ohm-spark/80"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Welcome-back summary */}
      {welcomeBack && (
        <div className="flex items-center justify-between border-b border-ohm-border bg-ohm-surface px-4 py-2">
          <div className="flex items-center gap-3 font-body text-xs text-ohm-muted">
            <Zap size={14} className="shrink-0 text-ohm-spark" />
            <span>
              Welcome back!{' '}
              <span className="text-ohm-charging">{welcomeBack.charging} charging</span>
              {welcomeBack.live > 0 && (
                <>
                  , <span className="text-ohm-live">{welcomeBack.live} live</span>
                </>
              )}
              {welcomeBack.grounded > 0 && (
                <>
                  , <span className="text-ohm-grounded">{welcomeBack.grounded} grounded</span>
                </>
              )}
              {welcomeBack.powered > 0 && (
                <>
                  , <span className="text-ohm-powered">{welcomeBack.powered} powered</span>
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={dismissWelcome}
            className="shrink-0 text-ohm-muted hover:text-ohm-text"
            aria-label="Dismiss welcome summary"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="border-b border-ohm-border px-4 py-2">
        {/* Row 1: Energy chips (always visible) + expand toggle (mobile) */}
        <div className="flex items-center gap-2">
          {ENERGY_CONFIG.map((config, index) => {
            const Icon = config.icon;
            const active = energyFilter === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setEnergyFilter(active ? null : (index as EnergyTag))}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-body text-[11px] transition-colors ${
                  active ? 'bg-ohm-text/10 text-ohm-text' : 'text-ohm-muted hover:text-ohm-text'
                }`}
              >
                <span className={ENERGY_CLASSES[index]!.text}>
                  <Icon size={12} />
                </span>
                {config.label}
              </button>
            );
          })}

          {/* Desktop: inline category + search (hidden on mobile) */}
          <div className="mx-1 hidden h-3 w-px shrink-0 bg-ohm-border md:block" />
          <div className="hidden items-center gap-2 md:flex">
            <CategoryFilter
              categories={board.categories}
              selected={categoryFilter}
              onToggle={toggleCategory}
            />
            <div className="mx-1 h-3 w-px shrink-0 bg-ohm-border" />
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2 text-ohm-muted" />
              <input
                ref={searchRef}
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search..."
                className="w-32 rounded-full border border-ohm-border bg-transparent py-1 pl-7 pr-2 font-body text-[11px] text-ohm-text placeholder:text-ohm-muted/40 focus:outline-none focus:ring-1 focus:ring-ohm-text/10"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-1.5 text-ohm-muted hover:text-ohm-text"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Mobile: active advanced filter indicator (when collapsed) */}
          {!filtersExpanded && hasAdvancedFilter && (
            <span className="flex items-center gap-1 rounded-full bg-ohm-text/10 px-2 py-0.5 font-body text-[10px] text-ohm-text md:hidden">
              +{advancedFilterCount} filter{advancedFilterCount > 1 ? 's' : ''}
            </span>
          )}

          {/* Reset button */}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="shrink-0 font-display text-[10px] uppercase tracking-wider text-ohm-muted hover:text-ohm-text"
            >
              Reset
            </button>
          )}

          {/* Mobile: expand/collapse toggle */}
          <button
            type="button"
            onClick={() => setFiltersExpanded((prev) => !prev)}
            className="relative shrink-0 rounded-md p-1 text-ohm-muted transition-colors hover:text-ohm-text md:hidden"
            aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Mobile expanded: category + search rows */}
        {filtersExpanded && (
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            <CategoryFilter
              categories={board.categories}
              selected={categoryFilter}
              onToggle={toggleCategory}
            />
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2 text-ohm-muted" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search cards..."
                className="w-full rounded-full border border-ohm-border bg-transparent py-1.5 pl-7 pr-2 font-body text-xs text-ohm-text placeholder:text-ohm-muted/40 focus:outline-none focus:ring-1 focus:ring-ohm-text/10"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 text-ohm-muted hover:text-ohm-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <main className="flex-1 overflow-y-auto md:overflow-x-auto md:overflow-y-hidden">
          <div className="flex flex-col gap-3 p-4 md:min-h-[calc(100vh-56px)] md:flex-row md:gap-4">
            {COLUMNS.map((col, index) => {
              const status = index as ColumnStatus;
              return (
                <Column
                  key={index}
                  column={col}
                  cards={filteredCards(status)}
                  onCardTap={setSelectedCard}
                  capacity={getColumnCapacity(board, status) ?? undefined}
                  defaultExpanded={index === STATUS.LIVE}
                  flash={index === STATUS.POWERED ? poweredFlash : undefined}
                />
              );
            })}
          </div>
        </main>
        <DragOverlay>
          {draggingCard && (
            <div className="rounded-lg border border-ohm-border bg-ohm-surface p-3 shadow-xl">
              <p className="font-body text-sm font-medium text-ohm-text">{draggingCard.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Card detail / new card modal */}
      {activeCard && (
        <CardDetail
          card={activeCard}
          isNew={!!newCard}
          categories={board.categories}
          onSave={(updated) => {
            if (newCard) {
              quickAdd(updated.title, {
                description: updated.description || undefined,
                energy: updated.energy,
                category: updated.category || undefined,
              });
              toastQuickAdd(updated.title);
            } else {
              const original = board.cards.find((c) => c.id === updated.id);
              updateCard(updated);
              if (original && updated.status !== original.status) {
                toastCardMoved(updated, updated.status);
                if (updated.status === STATUS.POWERED) {
                  setPoweredFlash(true);
                  setTimeout(() => setPoweredFlash(false), 1000);
                }
              }
            }
            setSelectedCard(null);
            setNewCard(null);
          }}
          onDelete={(id) => {
            const deletedCard = board.cards.find((c) => c.id === id);
            deleteCard(id);
            setSelectedCard(null);
            if (deletedCard) {
              toastCardDeleted(deletedCard, () => restoreCard(deletedCard));
            }
          }}
          onClose={() => {
            setSelectedCard(null);
            setNewCard(null);
          }}
          onOpenSettings={() => {
            setSelectedCard(null);
            setNewCard(null);
            setSettingsOpen(true);
          }}
        />
      )}

      {/* Settings dialog */}
      <SettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        categories={board.categories}
        onAddCategory={addCategory}
        onRemoveCategory={removeCategory}
        onRenameCategory={renameCategory}
        capacities={{
          charging: board.chargingCapacity,
          live: board.liveCapacity,
          grounded: board.groundedCapacity,
        }}
        onSetCapacity={setCapacity}
        driveAvailable={driveAvailable}
        driveConnected={driveConnected}
        onConnectDrive={connect}
        onDisconnectDrive={disconnect}
        board={board}
        onReplaceBoard={replaceBoard}
      />

      {/* Settings FAB -- mobile only */}
      <Button
        size="icon"
        onClick={() => setSettingsOpen(true)}
        className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full border border-ohm-border bg-ohm-surface text-ohm-muted shadow-md transition-transform hover:text-ohm-text active:scale-95 md:hidden"
        aria-label="Settings"
      >
        <Settings size={20} />
      </Button>

      {/* Quick spark FAB -- mobile only */}
      <Button
        size="icon"
        onClick={handleQuickSpark}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-ohm-spark text-ohm-bg shadow-lg shadow-ohm-spark/30 transition-transform hover:bg-ohm-spark/90 active:scale-95 md:hidden"
        aria-label="Quick spark"
      >
        <Zap size={24} />
      </Button>
    </div>
  );
}
