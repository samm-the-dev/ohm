import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Zap,
  Settings,
  Plus,
  CloudOff,
  SlidersHorizontal,
  Search,
  X,
  Tag,
  Share2,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { OhmCard, ColumnStatus } from '../types/board';
import {
  STATUS,
  COLUMNS,
  ENERGY_MIN,
  ENERGY_MAX,
  ENERGY_DEFAULT,
  WINDOW_DEFAULT,
  energyColor,
} from '../types/board';
import { ACTIVITY_STATUS } from '../types/activity';
import {
  createCard,
  getColumnCards,
  getColumnCapacity,
  getTotalCapacity,
  getDailyEnergy,
  getExpiredPowered,
  getTrailingPowered,
} from '../utils/board-utils';
import { toISODate } from '../utils/schedule-utils';
import { useBoard } from '../hooks/useBoard';
import { useActivities } from '../hooks/useActivities';
import { useDriveSync } from '../hooks/useDriveSync';
import { useWelcomeBack } from '../hooks/useWelcomeBack';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Column } from './Column';
import { CardDetail } from './CardDetail';
import { SettingsDialog } from './SettingsDialog';
import { SyncIndicator } from './SyncIndicator';
import {
  toastCardMoved,
  toastCardDeleted,
  toastQuickAdd,
  toastLinkCopied,
  toastLinkFailed,
} from '../utils/toast';

function CategoryFilter({
  categories,
  selected,
  onToggle,
  fullWidth,
}: {
  categories: string[];
  selected: string[];
  onToggle: (cat: string) => void;
  fullWidth?: boolean;
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
    <div
      ref={wrapperRef}
      className={`relative flex flex-wrap items-center gap-1.5 ${fullWidth ? 'w-full' : ''}`}
    >
      {selected.map((cat) => (
        <span
          key={cat}
          className="bg-ohm-text/10 font-body text-ohm-text flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
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
        <div className={`relative ${fullWidth ? 'flex-1' : ''}`}>
          <div className="relative flex items-center">
            <Tag size={10} className="text-ohm-muted absolute left-2" />
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
              autoComplete="off"
              data-form-type="other"
              className={`${fullWidth ? 'w-full' : selected.length ? 'w-16' : 'w-24'} border-ohm-border font-body text-ohm-text placeholder:text-ohm-muted/40 focus:ring-ohm-text/10 rounded-full border bg-transparent py-1 pr-2 pl-6 text-[11px] focus:ring-1 focus:outline-hidden`}
            />
          </div>
          {open && matches.length > 0 && (
            <div className="border-ohm-border bg-ohm-surface absolute top-full left-0 z-50 mt-1 max-h-40 w-36 overflow-y-auto rounded-lg border shadow-lg">
              {matches.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onToggle(cat);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="font-body text-ohm-muted hover:bg-ohm-text/5 hover:text-ohm-text block w-full px-3 py-1.5 text-left text-[11px] transition-colors"
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
    move,
    updateCard,
    deleteCard,
    deleteCards,
    restoreCard,
    reorderBatch,
    addCategory,
    removeCategory,
    renameCategory,
    setEnergyBudget,
    setLiveCapacity,
    setTimeFeatures,
    setWindowSize,
    setAutoBudget,
    setActivities,
    materializeInstances,
    replaceBoard,
  } = useBoard();

  // One-time migration: copy activities from Dexie to board state
  useEffect(() => {
    if (board.activities && board.activities.length > 0) return;
    void (async () => {
      const { db } = await import('../db');
      const dexieActivities = await db.activities.toArray();
      if (dexieActivities.length > 0) {
        setActivities(() => dexieActivities);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    activities,
    instances,
    addActivity,
    updateActivity,
    deleteActivity,
    refreshWindow,
    syncInstanceToColumn,
  } = useActivities({
    activities: board.activities ?? [],
    setActivities,
    windowSize: board.windowSize,
  });

  // Cards pending user action (expired scheduled cards)
  const [pendingExpired, setPendingExpired] = useState<OhmCard[]>([]);

  // Refresh activity instances when time features are enabled
  useEffect(() => {
    if (!board.timeFeatures) return;
    void refreshWindow();
  }, [board.timeFeatures, refreshWindow]);

  // Collect expired cards: Charging non-activity cards auto-ground silently;
  // everything else (Live with past date, activity instance cards) prompts user.
  useEffect(() => {
    if (!board.timeFeatures) return;
    const today = toISODate(new Date());
    const toPrompt: OhmCard[] = [];

    for (const card of board.cards) {
      if (!card.scheduledDate || card.scheduledDate >= today) continue;
      if (card.status === STATUS.GROUNDED || card.status === STATUS.POWERED) continue;

      if (card.status === STATUS.CHARGING && !card.activityInstanceId) {
        // Non-activity Charging card with past date — auto-ground silently
        move(card.id, STATUS.GROUNDED);
      } else {
        // Live cards, or activity-linked Charging cards — prompt user
        toPrompt.push(card);
      }
    }

    setPendingExpired((prev) => {
      if (toPrompt.length === 0) return prev.length === 0 ? prev : [];
      // Only update if the set of card IDs actually changed
      const prevIds = new Set(prev.map((c) => c.id));
      const newIds = new Set(toPrompt.map((c) => c.id));
      if (prevIds.size === newIds.size && [...prevIds].every((id) => newIds.has(id))) return prev;
      return toPrompt;
    });
  }, [board.timeFeatures, board.cards, move]); // eslint-disable-line react-hooks/exhaustive-deps

  // Materialize Potential activity instances as Charging cards (atomic — strict-mode safe)
  useEffect(() => {
    if (!board.timeFeatures) return;

    const activityMap = new Map(activities.map((a) => [a.id, a]));
    const specs = instances
      .filter((inst) => inst.status === ACTIVITY_STATUS.POTENTIAL)
      .map((inst) => {
        const activity = activityMap.get(inst.activityId);
        if (!activity) return null;
        return {
          title: activity.name,
          energy: activity.energy ?? ENERGY_DEFAULT,
          activityInstanceId: inst.id,
          scheduledDate: inst.scheduledDate,
        };
      })
      .filter(
        (
          s,
        ): s is {
          title: string;
          energy: number;
          activityInstanceId: string;
          scheduledDate: string;
        } => s !== null,
      );

    if (specs.length > 0) materializeInstances(specs);
  }, [board.timeFeatures, instances, activities, materializeInstances]);

  // Auto-archive Powered cards that have fallen outside the trailing window
  useEffect(() => {
    if (!board.timeFeatures) return;
    const trailingStart = new Date();
    trailingStart.setDate(trailingStart.getDate() - ((board.windowSize ?? WINDOW_DEFAULT) - 1));
    const expired = getExpiredPowered(board, toISODate(trailingStart));
    if (expired.length > 0) {
      deleteCards(expired.map((c) => c.id));
    }
  }, [board.timeFeatures, board.windowSize, board.cards, deleteCards]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag-and-drop sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Screen reader announcements for drag-and-drop
  const dndAnnouncements = useMemo(
    () => ({
      onDragStart({ active }: DragStartEvent) {
        const card = board.cards.find((c) => c.id === active.id);
        return card ? `Picked up card: ${card.title}` : '';
      },
      onDragOver() {
        return '';
      },
      onDragEnd({ active, over }: DragEndEvent) {
        const card = board.cards.find((c) => c.id === active.id);
        if (!card) return '';
        if (!over || active.id === over.id) return `Dropped card: ${card.title}`;
        const overCard = board.cards.find((c) => c.id === over.id);
        if (overCard) {
          const columnCards = getColumnCards(board, overCard.status);
          const newIndex = columnCards.findIndex((c) => c.id === over.id);
          return newIndex >= 0
            ? `Dropped ${card.title} at position ${newIndex + 1}`
            : `Dropped card: ${card.title}`;
        }
        return `Dropped card: ${card.title}`;
      },
      onDragCancel({ active }: { active: { id: string | number } }) {
        const card = board.cards.find((c) => c.id === active.id);
        return card ? `Cancelled dragging: ${card.title}` : '';
      },
    }),
    [board],
  );

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

  // Trailing powered ratio — used for Powered column glow and milestone toasts
  const trailingPoweredRatio = useMemo(() => {
    if (!board.timeFeatures) return 0;
    const today = new Date();
    const trailingStart = new Date(today);
    trailingStart.setDate(trailingStart.getDate() - ((board.windowSize ?? WINDOW_DEFAULT) - 1));
    const trailing = getTrailingPowered(board, toISODate(trailingStart), toISODate(today));
    return board.energyBudget > 0 ? trailing.used / board.energyBudget : 0;
  }, [board]);

  // Completion flash — column header animation
  const [poweredFlash, setPoweredFlash] = useState(false);

  const [selectedCard, setSelectedCard] = useState<OhmCard | null>(null);
  const [newCard, setNewCard] = useState<OhmCard | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [energyMin, setEnergyMin] = useState<number | null>(null);
  const [energyMax, setEnergyMax] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredCards = (status: ColumnStatus) => {
    let cards = getColumnCards(board, status);
    if (energyMin !== null) cards = cards.filter((c) => c.energy >= energyMin);
    if (energyMax !== null) cards = cards.filter((c) => c.energy <= energyMax);
    if (categoryFilter.length > 0) cards = cards.filter((c) => categoryFilter.includes(c.category));
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      cards = cards.filter(
        (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      );
    }
    return cards;
  };

  const hasActiveFilter =
    energyMin !== null || energyMax !== null || categoryFilter.length > 0 || searchFilter !== '';
  const hasAdvancedFilter = categoryFilter.length > 0 || searchFilter !== '';
  const advancedFilterCount =
    categoryFilter.length +
    (searchFilter ? 1 : 0) +
    (energyMin !== null ? 1 : 0) +
    (energyMax !== null ? 1 : 0);

  const toggleCategory = (cat: string) => {
    setCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const resetFilters = () => {
    setEnergyMin(null);
    setEnergyMax(null);
    setCategoryFilter([]);
    setSearchFilter('');
  };

  const handleQuickSpark = () => {
    setNewCard(createCard(''));
  };

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ohm', url });
        return;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toastLinkCopied();
    } catch {
      toastLinkFailed();
    }
  };

  const activeCard = selectedCard || newCard;

  return (
    <div className="bg-ohm-bg flex min-h-screen flex-col">
      <a href="#board" className="skip-to-content">
        Skip to board
      </a>

      {/* Header */}
      <header className="border-ohm-border bg-ohm-bg/90 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left -- settings (desktop only) + sync status */}
          <div className="flex w-20 items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-ohm-muted hover:bg-ohm-surface hover:text-ohm-text hidden rounded-md p-1.5 transition-colors md:block"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
            {driveAvailable && (
              <SyncIndicator connected={driveConnected} status={syncStatus} onSync={manualSync} />
            )}
          </div>

          {/* Center -- title */}
          <h1 className="flex items-center gap-2">
            <Zap size={18} className="text-ohm-spark" aria-hidden="true" />
            <span className="font-display text-ohm-text text-sm font-bold tracking-widest uppercase">
              Ohm
            </span>
          </h1>

          {/* Right -- quick spark (desktop) + share */}
          <div className="flex w-20 items-center justify-end gap-1">
            <button
              type="button"
              onClick={handleQuickSpark}
              className="text-ohm-spark hover:bg-ohm-spark/10 hidden rounded-md p-1.5 transition-colors md:block"
              aria-label="Quick spark"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="text-ohm-muted hover:bg-ohm-surface hover:text-ohm-text rounded-md p-1.5 transition-colors"
              aria-label="Share link"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Reconnect banner */}
      {needsReconnect && !driveConnected && (
        <div className="border-ohm-border bg-ohm-surface flex items-center justify-center gap-3 border-b px-4 py-2">
          <CloudOff size={14} className="text-ohm-muted" />
          <span className="font-body text-ohm-muted text-xs">
            This board was previously synced with Google Drive.
          </span>
          <button
            type="button"
            onClick={connect}
            className="font-display text-ohm-spark hover:text-ohm-spark/80 text-xs tracking-wider uppercase transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Welcome-back summary */}
      {welcomeBack && (
        <div className="border-ohm-border bg-ohm-surface flex items-center justify-between border-b px-4 py-2">
          <div className="font-body text-ohm-muted flex items-center gap-3 text-xs">
            <Zap size={14} className="text-ohm-spark shrink-0" />
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
            className="text-ohm-muted hover:text-ohm-text shrink-0"
            aria-label="Dismiss welcome summary"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter bar */}
      <nav aria-label="Filters" className="border-ohm-border border-b px-4 py-2">
        {/* Row 1: Energy min/max filter + expand toggle (mobile) */}
        <div className="flex items-center gap-2">
          <span className="font-display text-ohm-muted shrink-0 text-[10px] tracking-widest uppercase">
            Energy
          </span>
          {/* Min stepper (desktop) */}
          <button
            type="button"
            className="text-ohm-muted hover:text-ohm-text hidden shrink-0 px-1 py-0.5 text-sm font-bold disabled:opacity-30 md:inline"
            disabled={(energyMin ?? ENERGY_MIN) <= ENERGY_MIN}
            onClick={() => {
              const v = (energyMin ?? ENERGY_MIN) - 1;
              setEnergyMin(v <= ENERGY_MIN ? null : v);
            }}
            aria-label="Decrease minimum energy"
          >
            -
          </button>
          <span
            className="font-display text-[10px] font-bold tabular-nums"
            style={{ color: energyColor(energyMin ?? ENERGY_MIN) }}
          >
            {energyMin ?? ENERGY_MIN}
          </span>
          <button
            type="button"
            className="text-ohm-muted hover:text-ohm-text hidden shrink-0 px-1 py-0.5 text-sm font-bold disabled:opacity-30 md:inline"
            disabled={(energyMin ?? ENERGY_MIN) >= (energyMax ?? ENERGY_MAX)}
            onClick={() => {
              const v = (energyMin ?? ENERGY_MIN) + 1;
              setEnergyMin(v <= ENERGY_MIN ? null : v);
            }}
            aria-label="Increase minimum energy"
          >
            +
          </button>
          <div className="relative flex h-5 flex-1 items-center">
            {/* Track background */}
            <div className="bg-ohm-border absolute inset-x-0 h-1 rounded-full" />
            {/* Active range fill */}
            <div
              className="absolute h-1 rounded-full"
              style={{
                left: `${(((energyMin ?? ENERGY_MIN) - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN)) * 100}%`,
                right: `${(1 - ((energyMax ?? ENERGY_MAX) - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN)) * 100}%`,
                background: `linear-gradient(to right, ${energyColor(energyMin ?? ENERGY_MIN)}, ${energyColor(energyMax ?? ENERGY_MAX)})`,
              }}
            />
            {/* Min thumb */}
            <input
              type="range"
              min={ENERGY_MIN}
              max={ENERGY_MAX}
              step={1}
              value={energyMin ?? ENERGY_MIN}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnergyMin(v === ENERGY_MIN ? null : v);
                if ((energyMax ?? ENERGY_MAX) < v) setEnergyMax(v === ENERGY_MAX ? null : v);
              }}
              aria-label="Minimum energy"
              className="ohm-range-thumb pointer-events-none absolute inset-x-0 m-0 h-0 w-full appearance-none bg-transparent"
            />
            {/* Max thumb */}
            <input
              type="range"
              min={ENERGY_MIN}
              max={ENERGY_MAX}
              step={1}
              value={energyMax ?? ENERGY_MAX}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnergyMax(v === ENERGY_MAX ? null : v);
                if ((energyMin ?? ENERGY_MIN) > v) setEnergyMin(v === ENERGY_MIN ? null : v);
              }}
              aria-label="Maximum energy"
              className="ohm-range-thumb pointer-events-none absolute inset-x-0 m-0 h-0 w-full appearance-none bg-transparent"
            />
          </div>
          {/* Max stepper (desktop) */}
          <button
            type="button"
            className="text-ohm-muted hover:text-ohm-text hidden shrink-0 px-1 py-0.5 text-sm font-bold disabled:opacity-30 md:inline"
            disabled={(energyMax ?? ENERGY_MAX) <= (energyMin ?? ENERGY_MIN)}
            onClick={() => {
              const v = (energyMax ?? ENERGY_MAX) - 1;
              setEnergyMax(v >= ENERGY_MAX ? null : v);
            }}
            aria-label="Decrease maximum energy"
          >
            -
          </button>
          <span
            className="font-display text-[10px] font-bold tabular-nums"
            style={{ color: energyColor(energyMax ?? ENERGY_MAX) }}
          >
            {energyMax ?? ENERGY_MAX}
          </span>
          <button
            type="button"
            className="text-ohm-muted hover:text-ohm-text hidden shrink-0 px-1 py-0.5 text-sm font-bold disabled:opacity-30 md:inline"
            disabled={(energyMax ?? ENERGY_MAX) >= ENERGY_MAX}
            onClick={() => {
              const v = (energyMax ?? ENERGY_MAX) + 1;
              setEnergyMax(v >= ENERGY_MAX ? null : v);
            }}
            aria-label="Increase maximum energy"
          >
            +
          </button>

          {/* Mobile: active advanced filter indicator (when collapsed) */}
          {!filtersExpanded && hasAdvancedFilter && (
            <span className="bg-ohm-text/10 font-body text-ohm-text flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] md:hidden">
              +{advancedFilterCount} filter{advancedFilterCount > 1 ? 's' : ''}
            </span>
          )}

          {/* Mobile: expand/collapse toggle */}
          <button
            type="button"
            onClick={() => setFiltersExpanded((prev) => !prev)}
            className="text-ohm-muted hover:text-ohm-text relative shrink-0 rounded-md p-1 transition-colors md:hidden"
            aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Desktop: category + search + reset (own row, won't squish energy slider) */}
        <div className="mt-1.5 hidden items-center gap-2 md:flex">
          <CategoryFilter
            categories={board.categories}
            selected={categoryFilter}
            onToggle={toggleCategory}
          />
          <div className="bg-ohm-border mx-1 h-3 w-px shrink-0" />
          <div className="relative flex flex-1 items-center">
            <Search size={12} className="text-ohm-muted absolute left-2" />
            <input
              ref={searchRef}
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search..."
              aria-label="Search cards"
              className="border-ohm-border font-body text-ohm-text placeholder:text-ohm-muted/40 focus:ring-ohm-text/10 w-full rounded-full border bg-transparent py-1 pr-2 pl-7 text-[11px] focus:ring-1 focus:outline-hidden"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="text-ohm-muted hover:text-ohm-text absolute right-1.5"
                aria-label="Clear search"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilter}
            className="font-display text-ohm-muted hover:text-ohm-text shrink-0 text-[10px] tracking-wider uppercase disabled:pointer-events-none disabled:opacity-30"
          >
            Reset
          </button>
        </div>

        {/* Mobile expanded: category + search rows */}
        {filtersExpanded && (
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            <CategoryFilter
              categories={board.categories}
              selected={categoryFilter}
              onToggle={toggleCategory}
              fullWidth
            />
            <div className="flex items-center gap-2">
              <div className="relative flex flex-1 items-center">
                <Search size={12} className="text-ohm-muted absolute left-2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search cards..."
                  aria-label="Search cards"
                  className="border-ohm-border font-body text-ohm-text placeholder:text-ohm-muted/40 focus:ring-ohm-text/10 w-full rounded-full border bg-transparent py-1.5 pr-2 pl-7 text-xs focus:ring-1 focus:outline-hidden"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="text-ohm-muted hover:text-ohm-text absolute right-2"
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilter}
                className="font-display text-ohm-muted hover:text-ohm-text shrink-0 text-[10px] tracking-wider uppercase disabled:pointer-events-none disabled:opacity-30"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Energy meters — shared grid so bars align */}
      {(() => {
        const today = new Date();
        const todayStr = toISODate(today);

        // Window bounds for budget calculation
        let windowEndStr: string | undefined;
        let daily: Array<{ date: string; used: number }> = [];
        let dayLimit = board.liveCapacity;
        if (board.timeFeatures) {
          const windowEnd = new Date(today);
          windowEnd.setDate(windowEnd.getDate() + (board.windowSize ?? WINDOW_DEFAULT) - 1);
          windowEndStr = toISODate(windowEnd);
          daily = getDailyEnergy(board, todayStr, windowEndStr);
          dayLimit = board.liveCapacity;
        }

        const total = getTotalCapacity(board, todayStr, windowEndStr);
        const totalRatio = Math.min(total.used / total.total, 1);
        const totalHue = 120 * (1 - totalRatio);
        const totalColor = `hsl(${totalHue}, 80%, 50%)`;

        return (
          <div
            className="border-ohm-border grid items-center gap-x-3 gap-y-1 border-b px-4 py-2.5"
            style={{ gridTemplateColumns: '2.5rem 1fr 3rem' }}
          >
            {/* Daily row */}
            {board.timeFeatures && daily.length > 0 && (
              <div className="flex gap-1" style={{ gridColumn: '1 / -1' }}>
                {daily.map(({ date, used }) => {
                  const ratio = Math.min(used / dayLimit, 1);
                  const hue = 120 * (1 - ratio);
                  const color = used > 0 ? `hsl(${hue}, 80%, 50%)` : undefined;
                  const isToday = date === todayStr;
                  const d = new Date(date + 'T00:00:00');
                  const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
                  const dateNum = d.getDate();
                  return (
                    <div
                      key={date}
                      className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                      title={`${date}: ${used}/${dayLimit}`}
                    >
                      <span
                        className={`font-display text-[10px] leading-tight ${isToday ? 'text-ohm-text font-bold' : 'text-ohm-muted'}`}
                      >
                        {dayLabel}&nbsp;{dateNum}
                      </span>
                      <div className="bg-ohm-border relative h-1.5 w-full overflow-hidden rounded-full">
                        {used > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                            style={{ width: `${ratio * 100}%`, backgroundColor: color }}
                          />
                        )}
                      </div>
                      <span
                        className={`font-display text-[10px] leading-none font-bold ${used === 0 ? 'text-ohm-muted/30' : ''}`}
                        style={color ? { color } : undefined}
                      >
                        {used}/{dayLimit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total row */}
            <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
              Total
            </span>
            <div className="bg-ohm-border relative h-1.5 overflow-hidden rounded-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{ width: `${totalRatio * 100}%`, backgroundColor: totalColor }}
              />
            </div>
            <span
              className={`font-display text-right text-[10px] font-bold ${total.used > total.total ? 'animate-pulse' : ''}`}
              style={{ color: totalColor }}
            >
              {total.used}/{total.total}
            </span>
          </div>
        );
      })()}

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{ announcements: dndAnnouncements }}
      >
        <main
          id="board"
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none md:overflow-x-auto md:overflow-y-hidden"
        >
          <div className="flex flex-col gap-3 p-4 md:min-h-[calc(100vh-56px)] md:flex-row md:gap-4">
            {COLUMNS.map((col, index) => {
              const status = index as ColumnStatus;
              return (
                <Column
                  key={index}
                  column={col}
                  cards={filteredCards(status)}
                  onCardTap={setSelectedCard}
                  onReorderCards={reorderBatch}
                  capacity={getColumnCapacity(board, status) ?? undefined}
                  defaultExpanded={index === STATUS.LIVE}
                  flash={index === STATUS.POWERED ? poweredFlash : undefined}
                  glowIntensity={
                    index === STATUS.POWERED ? Math.min(trailingPoweredRatio, 1) : undefined
                  }
                />
              );
            })}
          </div>
        </main>
        <DragOverlay>
          {draggingCard && (
            <div className="border-ohm-border bg-ohm-surface rounded-lg border p-3 shadow-xl">
              <p className="font-body text-ohm-text text-sm font-medium">{draggingCard.title}</p>
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
          timeFeatures={board.timeFeatures}
          onSave={(updated) => {
            if (newCard) {
              quickAdd(updated.title, {
                description: updated.description || undefined,
                energy: updated.energy,
                category: updated.category || undefined,
                scheduledDate: updated.scheduledDate || undefined,
              });
              toastQuickAdd(updated.title);
            } else {
              const original = board.cards.find((c) => c.id === updated.id);
              updateCard(updated);
              if (original && updated.status !== original.status) {
                if (updated.activityInstanceId) {
                  void syncInstanceToColumn(updated.activityInstanceId, updated.status);
                }
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

      {/* Expired cards prompt */}
      {pendingExpired.length > 0 && (
        <Dialog open onOpenChange={() => setPendingExpired([])}>
          <DialogContent className="bg-ohm-surface border-ohm-border max-w-sm">
            <DialogTitle className="font-display text-ohm-text text-sm tracking-wider uppercase">
              Expired tasks
            </DialogTitle>
            <DialogDescription className="font-body text-ohm-muted text-xs">
              These tasks have dates in the past. What happened?
            </DialogDescription>
            <div className="flex flex-col gap-2 pt-2">
              {pendingExpired.map((card) => {
                const isActivity = !!card.activityInstanceId;
                return (
                  <div
                    key={card.id}
                    className="border-ohm-border flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-ohm-text truncate text-xs">{card.title}</p>
                      <p className="font-body text-ohm-muted/60 text-[10px]">
                        {card.scheduledDate}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-ohm-powered/30 text-ohm-powered hover:bg-ohm-powered/10 h-6 px-2 text-[10px]"
                        onClick={() => {
                          move(card.id, STATUS.POWERED);
                          if (card.activityInstanceId) {
                            void syncInstanceToColumn(card.activityInstanceId, STATUS.POWERED);
                          }
                          setPendingExpired((prev) => prev.filter((c) => c.id !== card.id));
                        }}
                      >
                        Done
                      </Button>
                      {isActivity ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-ohm-live/30 text-ohm-live hover:bg-ohm-live/10 h-6 px-2 text-[10px]"
                          onClick={() => {
                            if (card.activityInstanceId) {
                              void syncInstanceToColumn(card.activityInstanceId, STATUS.GROUNDED);
                            }
                            deleteCard(card.id);
                            setPendingExpired((prev) => prev.filter((c) => c.id !== card.id));
                          }}
                        >
                          Skip
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-ohm-grounded/30 text-ohm-grounded hover:bg-ohm-grounded/10 h-6 px-2 text-[10px]"
                          onClick={() => {
                            move(card.id, STATUS.GROUNDED);
                            setPendingExpired((prev) => prev.filter((c) => c.id !== card.id));
                          }}
                        >
                          Pause
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Settings dialog */}
      <SettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        categories={board.categories}
        onAddCategory={addCategory}
        onRemoveCategory={removeCategory}
        onRenameCategory={renameCategory}
        energyBudget={board.energyBudget}
        liveCapacity={board.liveCapacity}
        onSetEnergyBudget={setEnergyBudget}
        onSetLiveCapacity={setLiveCapacity}
        timeFeatures={board.timeFeatures}
        windowSize={board.windowSize}
        onSetTimeFeatures={setTimeFeatures}
        onSetWindowSize={setWindowSize}
        autoBudget={board.autoBudget}
        onSetAutoBudget={setAutoBudget}
        activities={activities}
        onAddActivity={addActivity}
        onUpdateActivity={updateActivity}
        onDeleteActivity={deleteActivity}
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
        className="border-ohm-border bg-ohm-surface text-ohm-muted hover:bg-ohm-surface hover:text-ohm-text fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full border shadow-md transition-transform active:scale-95 md:hidden"
        aria-label="Settings"
      >
        <Settings size={20} />
      </Button>

      {/* Quick spark FAB -- mobile only */}
      <Button
        size="icon"
        onClick={handleQuickSpark}
        className="bg-ohm-spark text-ohm-bg shadow-ohm-spark/30 hover:bg-ohm-spark/90 fixed right-6 bottom-6 z-40 h-14 w-14 rounded-full shadow-lg transition-transform active:scale-95 md:hidden"
        aria-label="Quick spark"
      >
        <Zap size={24} />
      </Button>
    </div>
  );
}
