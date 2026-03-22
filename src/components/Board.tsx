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
  MonitorDown,
  Filter,
  CalendarDays,
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
  ENERGY_MAX_DEFAULT,
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
  groupCardsByDate,
} from '../utils/board-utils';
import { formatDateLabel, toISODate } from '../utils/schedule-utils';
import { useBoard } from '../hooks/useBoard';
import { useActivities } from '../hooks/useActivities';
import { useDriveSync } from '../hooks/useDriveSync';
import { useWelcomeBack } from '../hooks/useWelcomeBack';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { Button } from './ui/button';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Calendar } from './ui/calendar';
import { parseISO } from 'date-fns';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from './ui/responsive-dialog';
import { Column } from './Column';
import { BudgetBar } from './BudgetBar';
import { DayFocusDialog } from './DayFocusDialog';
import { CardDetail } from './CardDetail';
import { SettingsPage } from './SettingsPage';
import { SyncIndicator } from './SyncIndicator';
import { StorageIndicator } from './StorageIndicator';
import { useStorageAdapter } from '../hooks/useStorageAdapter';
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
          className="bg-ohm-text/10 font-body text-ohm-text flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
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
              className={`${fullWidth ? 'w-full' : selected.length ? 'w-16' : 'w-24'} border-ohm-border font-body text-ohm-text placeholder:text-ohm-muted/40 focus:ring-ohm-text/10 rounded-full border bg-transparent py-1 pr-2 pl-6 text-xs focus:ring-1 focus:outline-hidden`}
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
                  className="font-body text-ohm-muted hover:bg-ohm-text/5 hover:text-ohm-text block w-full px-3 py-1.5 text-left text-xs transition-colors"
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
    setEnergyMax: setBoardEnergyMax,
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
    instancesReady,
    addActivity,
    updateActivity,
    deleteActivity,
    refreshWindow,
    dismissInstance,
    syncInstanceToColumn,
  } = useActivities({
    activities: board.activities ?? [],
    setActivities,
    windowSize: board.windowSize,
  });

  // Clean up orphaned activity cards (instance or activity deleted but card survived).
  // Wait for Dexie instances to load before checking — empty [] on first render is not orphanhood.
  useEffect(() => {
    if (!instancesReady) return;
    const instanceIds = new Set(instances.map((i) => i.id));
    const orphanIds = board.cards
      .filter((c) => c.activityInstanceId && !instanceIds.has(c.activityInstanceId))
      .map((c) => c.id);
    if (orphanIds.length > 0) deleteCards(orphanIds);
  }, [board.cards, instances, instancesReady, deleteCards]);

  // Cards pending user action (expired scheduled cards)
  const [pendingExpired, setPendingExpired] = useState<OhmCard[]>([]);

  // Refresh activity instances on mount
  useEffect(() => {
    void refreshWindow();
  }, [refreshWindow]);

  // Collect expired cards: Charging non-activity cards auto-ground silently;
  // everything else (Live with past date, activity instance cards) prompts user.
  useEffect(() => {
    const today = toISODate(new Date());
    const toPrompt: OhmCard[] = [];

    for (const card of board.cards) {
      // Charging card with no date and no activity link — auto-ground
      if (card.status === STATUS.CHARGING && !card.scheduledDate && !card.activityInstanceId) {
        move(card.id, STATUS.GROUNDED);
        continue;
      }

      // Today's Charging cards — auto-move to Live
      if (card.status === STATUS.CHARGING && card.scheduledDate === today) {
        move(card.id, STATUS.LIVE);
        continue;
      }

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
  }, [board.cards, move]);

  // Materialize Potential activity instances as Charging cards (atomic — strict-mode safe)
  useEffect(() => {
    const activityMap = new Map(activities.map((a) => [a.id, a]));
    const specs = instances
      .filter((inst) => inst.status === ACTIVITY_STATUS.POTENTIAL)
      .map((inst) => {
        const activity = activityMap.get(inst.activityId);
        if (!activity) return null;
        return {
          title: activity.name,
          energy: activity.energy ?? ENERGY_DEFAULT,
          category: activity.category ?? '',
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
          category: string;
          activityInstanceId: string;
          scheduledDate: string;
        } => s !== null,
      );

    if (specs.length > 0) materializeInstances(specs);
  }, [instances, activities, materializeInstances]);

  // Sync activity edits (name, energy, category) to already-materialized cards
  useEffect(() => {
    const activityMap = new Map(activities.map((a) => [a.id, a]));
    const updates: OhmCard[] = [];

    for (const card of board.cards) {
      if (!card.activityInstanceId || card.edited) continue;
      const inst = instances.find((i) => i.id === card.activityInstanceId);
      if (!inst) continue;
      const activity = activityMap.get(inst.activityId);
      if (!activity) continue;

      const expectedEnergy = activity.energy ?? ENERGY_DEFAULT;
      if (
        card.title !== activity.name ||
        card.energy !== expectedEnergy ||
        card.category !== (activity.category ?? '')
      ) {
        updates.push({
          ...card,
          title: activity.name,
          energy: expectedEnergy,
          category: activity.category ?? '',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    for (const u of updates) updateCard(u);
  }, [board.cards, activities, instances, updateCard]);

  // Auto-archive Powered cards that have fallen outside the trailing window
  useEffect(() => {
    const trailingStart = new Date();
    trailingStart.setDate(trailingStart.getDate() - ((board.windowSize ?? WINDOW_DEFAULT) - 1));
    const expired = getExpiredPowered(board, toISODate(trailingStart));
    if (expired.length > 0) {
      deleteCards(expired.map((c) => c.id));
    }
  }, [board.windowSize, board.cards, deleteCards]); // eslint-disable-line react-hooks/exhaustive-deps

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
      onDragEnd({ active }: DragEndEvent) {
        const card = board.cards.find((c) => c.id === active.id);
        if (!card) return '';
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

      // Only allow reorder within the same group (same status + same day)
      if (draggedCard.status !== overCard.status) return;
      if (draggedCard.scheduledDate !== overCard.scheduledDate) return;

      // Same-group reorder
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
    recoveryPrompt,
    connect,
    disconnect,
    dismissRecovery,
    manualSync,
    queueSync,
  } = useDriveSync(board, replaceBoard);

  // Queue Drive sync whenever board changes
  useEffect(() => {
    queueSync(board);
  }, [board, queueSync]);

  const { summary: welcomeBack, dismiss: dismissWelcome } = useWelcomeBack(board);
  const { isInstallable, installApp } = useInstallPrompt();
  const storageAdapter = useStorageAdapter();

  // Completion flash — column header animation
  const [poweredFlash, setPoweredFlash] = useState(false);

  const [selectedCard, setSelectedCard] = useState<OhmCard | null>(null);
  const [newCard, setNewCard] = useState<OhmCard | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'board' | 'schedule' | 'data' | undefined>();
  const [editActivityId, setEditActivityId] = useState<string | undefined>();
  const [energyMin, setEnergyMin] = useState<number | null>(null);
  const [energyMax, setEnergyMax] = useState<number | null>(null);
  const eMax = board.energyMax ?? ENERGY_MAX_DEFAULT;
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [todayFilter, setTodayFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredCards = (status: ColumnStatus) => {
    let cards = getColumnCards(board, status);
    if (todayFilter) {
      const todayStr = toISODate(new Date());
      cards = cards.filter((c) => c.scheduledDate === todayStr);
    }
    if (energyMin !== null) cards = cards.filter((c) => c.energy >= energyMin);
    if (energyMax !== null) cards = cards.filter((c) => c.energy <= energyMax);
    if (categoryFilter.length > 0) cards = cards.filter((c) => categoryFilter.includes(c.category));
    if (dateFilter) cards = cards.filter((c) => c.scheduledDate === dateFilter);
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      cards = cards.filter(
        (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      );
    }
    return cards;
  };

  const hasActiveFilter =
    energyMin !== null ||
    energyMax !== null ||
    categoryFilter.length > 0 ||
    searchFilter !== '' ||
    todayFilter ||
    dateFilter !== null;
  const hasAdvancedFilter = categoryFilter.length > 0 || searchFilter !== '';
  const advancedFilterCount =
    categoryFilter.length +
    (searchFilter ? 1 : 0) +
    (energyMin !== null ? 1 : 0) +
    (energyMax !== null ? 1 : 0) +
    (todayFilter ? 1 : 0) +
    (dateFilter ? 1 : 0);

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
    setTodayFilter(false);
    setDateFilter(null);
  };

  // Budget bar data — computed each render to keep today/window bounds fresh across midnight
  const budgetData = (() => {
    const today = new Date();
    const todayStr = toISODate(today);
    const dayLimit = board.liveCapacity;
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + (board.windowSize ?? WINDOW_DEFAULT) - 1);
    const windowEndStr = toISODate(windowEnd);
    const daily = getDailyEnergy(board, todayStr, windowEndStr);
    const total = getTotalCapacity(board, todayStr, windowEndStr);
    return { daily, dayLimit, total, todayStr };
  })();

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
          {/* Left -- storage + sync status + install */}
          <div className="flex w-24 items-center gap-1">
            <StorageIndicator adapter={storageAdapter} />
            {driveAvailable && (
              <SyncIndicator connected={driveConnected} status={syncStatus} onSync={manualSync} />
            )}
            {isInstallable && (
              <button
                type="button"
                onClick={installApp}
                className="text-ohm-muted hover:bg-ohm-surface hover:text-ohm-text rounded-md p-1.5 transition-colors"
                aria-label="Install app"
              >
                <MonitorDown size={16} />
              </button>
            )}
          </div>

          {/* Center -- title */}
          <h1 className="flex items-center gap-[0.15em] text-lg">
            <span className="text-ohm-spark flex items-center">
              <svg
                className="h-[0.8em] w-[0.8em] flex-shrink-0"
                viewBox="1.5 1 21 22"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="font-display text-ohm-text font-bold tracking-widest uppercase">
              Ohm
            </span>
          </h1>

          {/* Right -- quick spark (desktop) + share + settings */}
          <div className="flex w-24 items-center justify-end gap-1">
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
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-ohm-muted hover:bg-ohm-surface hover:text-ohm-text rounded-md p-1.5 transition-colors"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Reconnect banner */}
      {needsReconnect && !driveConnected && (
        <div className="border-ohm-border bg-ohm-surface flex items-center justify-center gap-3 border-b px-4 py-2">
          <CloudOff size={14} className="text-ohm-muted" />
          <span className="font-body text-ohm-muted text-xs">
            {recoveryPrompt
              ? 'Sync with Google Drive?'
              : 'This board was previously synced with Google Drive.'}
          </span>
          <button
            type="button"
            onClick={connect}
            className="font-display text-ohm-spark hover:text-ohm-spark/80 text-xs tracking-wider uppercase transition-colors"
          >
            {recoveryPrompt ? 'Connect with Drive' : 'Reconnect'}
          </button>
          {recoveryPrompt && (
            <button
              type="button"
              onClick={dismissRecovery}
              aria-label="Dismiss"
              className="text-ohm-muted hover:text-ohm-text transition-colors"
            >
              <X size={14} />
            </button>
          )}
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
          <Filter size={12} className="text-ohm-muted shrink-0" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setTodayFilter((prev) => !prev)}
            className={`font-display flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tracking-wide transition-colors ${
              todayFilter
                ? 'border-ohm-spark/40 bg-ohm-spark/10 text-ohm-spark'
                : 'border-ohm-border text-ohm-muted hover:text-ohm-text'
            }`}
            aria-pressed={todayFilter}
          >
            <CalendarDays size={10} />
            Today
          </button>
          <span className="font-display text-ohm-muted shrink-0 text-xs tracking-widest uppercase">
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
            className="font-display text-xs font-bold tabular-nums"
            style={{ color: energyColor(energyMin ?? ENERGY_MIN, undefined, eMax) }}
          >
            {energyMin ?? ENERGY_MIN}
          </span>
          <button
            type="button"
            className="text-ohm-muted hover:text-ohm-text hidden shrink-0 px-1 py-0.5 text-sm font-bold disabled:opacity-30 md:inline"
            disabled={(energyMin ?? ENERGY_MIN) >= (energyMax ?? eMax)}
            onClick={() => {
              const v = (energyMin ?? ENERGY_MIN) + 1;
              setEnergyMin(v <= ENERGY_MIN ? null : v);
            }}
            aria-label="Increase minimum energy"
          >
            +
          </button>
          <div className="relative flex h-5 flex-1 items-center">
            {/* Full gradient track */}
            <div
              className="absolute inset-x-0 h-1 rounded-full"
              style={{
                background: `linear-gradient(to right, ${Array.from({ length: eMax - ENERGY_MIN + 1 }, (_, i) => energyColor(ENERGY_MIN + i, undefined, eMax)).join(', ')})`,
              }}
            />
            {/* Dim outside active range */}
            {(energyMin ?? ENERGY_MIN) > ENERGY_MIN && (
              <div
                className="absolute h-1 rounded-l-full bg-black/60"
                style={{
                  left: 0,
                  width: `${(((energyMin ?? ENERGY_MIN) - ENERGY_MIN) / (eMax - ENERGY_MIN)) * 100}%`,
                }}
              />
            )}
            {(energyMax ?? eMax) < eMax && (
              <div
                className="absolute h-1 rounded-r-full bg-black/60"
                style={{
                  right: 0,
                  width: `${((eMax - (energyMax ?? eMax)) / (eMax - ENERGY_MIN)) * 100}%`,
                }}
              />
            )}
            {/* Min thumb */}
            <input
              type="range"
              min={ENERGY_MIN}
              max={eMax}
              step={1}
              value={energyMin ?? ENERGY_MIN}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnergyMin(v === ENERGY_MIN ? null : v);
                if ((energyMax ?? eMax) < v) setEnergyMax(v === eMax ? null : v);
              }}
              aria-label="Minimum energy"
              className="ohm-range-thumb pointer-events-none absolute inset-x-0 m-0 h-0 w-full appearance-none bg-transparent"
            />
            {/* Max thumb */}
            <input
              type="range"
              min={ENERGY_MIN}
              max={eMax}
              step={1}
              value={energyMax ?? eMax}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnergyMax(v === eMax ? null : v);
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
            disabled={(energyMax ?? eMax) <= (energyMin ?? ENERGY_MIN)}
            onClick={() => {
              const v = (energyMax ?? eMax) - 1;
              setEnergyMax(v >= eMax ? null : v);
            }}
            aria-label="Decrease maximum energy"
          >
            -
          </button>
          <span
            className="font-display text-xs font-bold tabular-nums"
            style={{ color: energyColor(energyMax ?? eMax, undefined, eMax) }}
          >
            {energyMax ?? eMax}
          </span>
          <button
            type="button"
            className="text-ohm-muted hover:text-ohm-text hidden shrink-0 px-1 py-0.5 text-sm font-bold disabled:opacity-30 md:inline"
            disabled={(energyMax ?? eMax) >= eMax}
            onClick={() => {
              const v = (energyMax ?? eMax) + 1;
              setEnergyMax(v >= eMax ? null : v);
            }}
            aria-label="Increase maximum energy"
          >
            +
          </button>

          {/* Mobile: active advanced filter indicator (when collapsed) */}
          {!filtersExpanded && hasAdvancedFilter && (
            <span className="bg-ohm-text/10 font-body text-ohm-text flex items-center gap-1 rounded-full px-2 py-0.5 text-xs md:hidden">
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
          <Popover>
            <div className="flex items-center">
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Filter by date"
                  className={`border-ohm-border font-body focus:ring-ohm-text/10 flex items-center gap-1.5 rounded-full border bg-transparent py-1 text-xs focus:ring-1 focus:outline-hidden ${
                    dateFilter ? 'text-ohm-text pr-1 pl-2.5' : 'text-ohm-muted pr-2 pl-2.5'
                  }`}
                >
                  <CalendarDays size={12} />
                  {dateFilter ? formatDateLabel(dateFilter, budgetData.todayStr) : 'Date'}
                </button>
              </PopoverTrigger>
              {dateFilter && (
                <button
                  type="button"
                  aria-label="Clear date filter"
                  onClick={() => setDateFilter(null)}
                  className="border-ohm-border text-ohm-muted hover:text-ohm-text -ml-px rounded-r-full border border-l-0 py-1 pr-2 pl-1"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <PopoverContent align="start" className="border-ohm-border bg-ohm-bg p-0">
              <Calendar
                mode="single"
                selected={dateFilter ? parseISO(dateFilter) : undefined}
                onSelect={(day) => setDateFilter(day ? toISODate(day) : null)}
              />
            </PopoverContent>
          </Popover>
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
              className="border-ohm-border font-body text-ohm-text placeholder:text-ohm-muted/40 focus:ring-ohm-text/10 w-full rounded-full border bg-transparent py-1 pr-2 pl-7 text-xs focus:ring-1 focus:outline-hidden"
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
            className="font-display text-ohm-muted hover:text-ohm-text shrink-0 text-xs tracking-wider uppercase disabled:pointer-events-none disabled:opacity-30"
          >
            Reset
          </button>
        </div>

        {/* Mobile expanded: category + search rows */}
        {filtersExpanded && (
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            <div className="relative flex items-center">
              <CalendarDays size={12} className="text-ohm-muted absolute left-2" />
              <input
                type="date"
                value={dateFilter ?? ''}
                onChange={(e) => setDateFilter(e.target.value || null)}
                aria-label="Filter by date"
                className="border-ohm-border font-body text-ohm-text focus:ring-ohm-text/10 w-full rounded-full border bg-transparent py-1.5 pr-2 pl-7 text-xs focus:ring-1 focus:outline-hidden"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter(null)}
                  className="text-ohm-muted hover:text-ohm-text absolute right-2"
                  aria-label="Clear date filter"
                >
                  <X size={12} />
                </button>
              )}
            </div>
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
                className="font-display text-ohm-muted hover:text-ohm-text shrink-0 text-xs tracking-wider uppercase disabled:pointer-events-none disabled:opacity-30"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </nav>

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
          <div className="flex flex-col gap-3 p-4 pb-28 md:min-h-[calc(100vh-56px)] md:flex-row md:gap-4">
            {COLUMNS.map((col, index) => {
              const status = index as ColumnStatus;
              const cards = filteredCards(status);
              const todayStr = toISODate(new Date());
              return (
                <Column
                  key={index}
                  column={col}
                  cards={cards}
                  onCardTap={setSelectedCard}
                  onReorderCards={reorderBatch}
                  capacity={getColumnCapacity(board, status, todayStr) ?? undefined}
                  defaultExpanded={index === STATUS.LIVE}
                  flash={index === STATUS.POWERED ? poweredFlash : undefined}
                  energyMax={eMax}
                  dayGroups={
                    status === STATUS.CHARGING || status === STATUS.POWERED
                      ? groupCardsByDate(cards, todayStr, status === STATUS.POWERED)
                      : undefined
                  }
                  dayLimit={board.liveCapacity}
                  filterDate={dateFilter}
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

      {/* Budget bar — fixed bottom */}
      <BudgetBar
        daily={budgetData.daily}
        dayLimit={budgetData.dayLimit}
        total={budgetData.total}
        todayStr={budgetData.todayStr}
        onDayClick={setFocusDate}
      />

      {/* Day focus dialog */}
      {focusDate && (
        <DayFocusDialog
          date={focusDate}
          availableDates={budgetData.daily.map((d) => d.date)}
          board={board}
          todayStr={budgetData.todayStr}
          energyMax={eMax}
          onReschedule={(cardId, newDate) => {
            const card = board.cards.find((c) => c.id === cardId);
            if (!card || card.activityInstanceId) return;
            updateCard({
              ...card,
              scheduledDate: newDate,
              updatedAt: new Date().toISOString(),
            });
          }}
          onReorder={(activeId, overId) => {
            const draggedCard = board.cards.find((c) => c.id === activeId);
            const overCard = board.cards.find((c) => c.id === overId);
            if (!draggedCard || !overCard || draggedCard.status !== overCard.status) return;
            const columnCards = getColumnCards(board, draggedCard.status);
            const oldIdx = columnCards.findIndex((c) => c.id === activeId);
            const newIdx = columnCards.findIndex((c) => c.id === overId);
            if (oldIdx === -1 || newIdx === -1) return;
            const reordered = arrayMove(columnCards, oldIdx, newIdx);
            reorderBatch(
              reordered.map((c) => c.id),
              activeId,
            );
          }}
          onClose={() => setFocusDate(null)}
        />
      )}

      {/* Card detail / new card modal */}
      {activeCard && (
        <CardDetail
          card={activeCard}
          isNew={!!newCard}
          categories={board.categories}
          energyMax={eMax}
          onAddActivity={addActivity}
          onEditSchedule={(instanceId) => {
            const inst = instances.find((i) => i.id === instanceId);
            if (!inst) return;
            setSelectedCard(null);
            setNewCard(null);
            setEditActivityId(inst.activityId);
            setSettingsTab('schedule');
            setSettingsOpen(true);
          }}
          onSave={(saved) => {
            let updated = saved;
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
              // Grounded card with a new scheduled date → move to Charging
              if (
                original &&
                original.status === STATUS.GROUNDED &&
                updated.status === STATUS.GROUNDED &&
                updated.scheduledDate &&
                !original.scheduledDate
              ) {
                updated = { ...updated, status: STATUS.CHARGING };
              }
              // Apply moveCard side-effects when status changed via CardDetail
              if (original && updated.status !== original.status) {
                if (updated.status === STATUS.LIVE) {
                  updated = { ...updated, scheduledDate: toISODate(new Date()) };
                } else if (updated.status === STATUS.GROUNDED) {
                  updated = { ...updated, scheduledDate: undefined };
                }
              }
              if (updated.activityInstanceId) {
                updated = { ...updated, edited: true };
              }
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
            if (deletedCard?.activityInstanceId) {
              void dismissInstance(deletedCard.activityInstanceId);
            }
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
        <ResponsiveDialog open onOpenChange={() => setPendingExpired([])}>
          <ResponsiveDialogContent className="max-w-sm">
            <ResponsiveDialogTitle className="font-display text-ohm-text text-sm tracking-wider uppercase">
              Expired tasks
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-ohm-muted text-xs">
              These tasks have dates in the past. What happened?
            </ResponsiveDialogDescription>
            <div className="flex flex-col gap-2 pt-2">
              {pendingExpired.map((card) => {
                const isActivity = !!card.activityInstanceId;
                return (
                  <div
                    key={card.id}
                    className="border-ohm-border flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-ohm-text truncate text-sm">{card.title}</p>
                      <p className="font-body text-ohm-muted/60 text-xs">
                        {card.scheduledDate
                          ? formatDateLabel(card.scheduledDate, toISODate(new Date()))
                          : 'No date'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-ohm-powered/30 text-ohm-powered hover:bg-ohm-powered/10 h-6 px-2 text-xs"
                        onClick={() => {
                          if (card.activityInstanceId) {
                            updateCard({ ...card, edited: true });
                            void syncInstanceToColumn(card.activityInstanceId, STATUS.POWERED);
                          }
                          move(card.id, STATUS.POWERED);
                          setPendingExpired((prev) => prev.filter((c) => c.id !== card.id));
                        }}
                      >
                        Done
                      </Button>
                      {isActivity ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-ohm-live/30 text-ohm-live hover:bg-ohm-live/10 h-6 px-2 text-xs"
                          onClick={() => {
                            if (card.activityInstanceId) {
                              void dismissInstance(card.activityInstanceId);
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
                          className="border-ohm-grounded/30 text-ohm-grounded hover:bg-ohm-grounded/10 h-6 px-2 text-xs"
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
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      )}

      {/* Settings full-page */}
      <SettingsPage
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsTab(undefined);
          setEditActivityId(undefined);
        }}
        initialTab={settingsTab}
        editActivityId={editActivityId}
        categories={board.categories}
        onAddCategory={addCategory}
        onRemoveCategory={removeCategory}
        onRenameCategory={renameCategory}
        energyBudget={board.energyBudget}
        liveCapacity={board.liveCapacity}
        onSetEnergyBudget={setEnergyBudget}
        onSetLiveCapacity={setLiveCapacity}
        energyMax={eMax}
        onSetEnergyMax={setBoardEnergyMax}
        windowSize={board.windowSize}
        onSetWindowSize={setWindowSize}
        autoBudget={board.autoBudget}
        onSetAutoBudget={setAutoBudget}
        activities={activities}
        onUpdateActivity={updateActivity}
        onDeleteActivity={async (id) => {
          // Remove board cards linked to this activity's instances
          const linkedCardIds = board.cards
            .filter(
              (c) =>
                c.activityInstanceId &&
                instances.some(
                  (inst) => inst.id === c.activityInstanceId && inst.activityId === id,
                ),
            )
            .map((c) => c.id);
          if (linkedCardIds.length > 0) deleteCards(linkedCardIds);
          await deleteActivity(id);
        }}
        driveAvailable={driveAvailable}
        driveConnected={driveConnected}
        onConnectDrive={connect}
        onDisconnectDrive={disconnect}
        board={board}
        onReplaceBoard={replaceBoard}
        storageAdapter={storageAdapter}
      />

      {/* Quick spark FAB -- mobile only */}
      <Button
        size="icon"
        onClick={handleQuickSpark}
        className="bg-ohm-spark text-ohm-bg hover:bg-ohm-spark/90 fixed right-6 z-40 h-14 w-14 rounded-full transition-transform active:scale-95 md:hidden [&_svg]:size-7"
        style={{ bottom: 'calc(var(--budget-bar-height, 0px) + 1.5rem)' }}
        aria-label="Quick spark"
      >
        <Zap fill="currentColor" stroke="none" />
      </Button>
    </div>
  );
}
