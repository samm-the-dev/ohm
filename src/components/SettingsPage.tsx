import { useState, useRef, useEffect } from 'react';
import {
  Settings,
  X,
  Minus,
  Plus,
  ChevronLeft,
  Download,
  Upload,
  Save,
  Trash2,
  RotateCcw,
  CalendarDays,
  LayoutGrid,
  Database,
} from 'lucide-react';
import type { OhmBoard } from '../types/board';
import { WINDOW_MIN, WINDOW_MAX, WINDOW_DEFAULT } from '../types/board';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  getRestorePoints,
  createRestorePoint,
  deleteRestorePoint,
  exportBoard,
  importBoard,
  mergeBoards,
  type RestorePoint,
} from '../utils/restore-points';
import { toastImportComplete } from '../utils/toast';
import { getAuthLevel } from '../utils/google-drive';
import type { Activity } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import { ActivityManager } from './ActivityManager';

type SettingsTab = 'board' | 'schedule' | 'data';

const TABS: { id: SettingsTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'data', label: 'Data', icon: Database },
];

export interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onAddCategory: (category: string) => void;
  onRemoveCategory: (category: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  energyBudget: number;
  liveCapacity: number;
  onSetEnergyBudget: (budget: number) => void;
  onSetLiveCapacity: (capacity: number) => void;
  timeFeatures?: boolean;
  windowSize?: number;
  onSetTimeFeatures?: (enabled: boolean) => void;
  onSetWindowSize?: (size: number) => void;
  autoBudget?: boolean;
  onSetAutoBudget?: (enabled: boolean) => void;
  activities?: Activity[];
  onAddActivity?: (
    name: string,
    opts?: { description?: string; schedule?: StoredSchedule; energy?: number; category?: string },
  ) => Activity;
  onUpdateActivity?: (id: string, changes: Partial<Omit<Activity, 'id'>>) => void;
  onDeleteActivity?: (id: string) => void | Promise<void>;
  driveAvailable?: boolean;
  driveConnected?: boolean;
  onConnectDrive?: () => void;
  onDisconnectDrive?: () => void;
  board: OhmBoard;
  onReplaceBoard: (board: OhmBoard) => void;
}

const CAPACITY_ROWS = [
  { label: 'Live', field: 'liveCapacity' as const, color: 'text-ohm-live' },
  { label: 'Total', field: 'energyBudget' as const, color: 'text-ohm-spark' },
];

const AUTH_LEVEL_SEGMENTS = ['Local', 'Sync', 'Persist'] as const;
const AUTH_LEVEL_DESCRIPTIONS = [
  'Storage unavailable',
  'Local only',
  'Sync (re-auth on refresh)',
  'Persistent sync',
] as const;

function AuthLevelIndicator() {
  const level = getAuthLevel();
  return (
    <div>
      <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
        Storage Level
      </span>
      <div className="mt-1.5 flex gap-1">
        {AUTH_LEVEL_SEGMENTS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                i < level ? 'bg-ohm-powered/60' : 'bg-ohm-border'
              }`}
            />
            <span className="font-body text-ohm-muted/60 mt-0.5 block text-center text-[9px]">
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="font-body text-ohm-muted/40 mt-1 text-[10px]">
        {AUTH_LEVEL_DESCRIPTIONS[level]}
      </p>
    </div>
  );
}

export function SettingsPage({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onRemoveCategory,
  onRenameCategory,
  energyBudget,
  liveCapacity,
  onSetEnergyBudget,
  onSetLiveCapacity,
  timeFeatures,
  windowSize,
  onSetTimeFeatures,
  onSetWindowSize,
  autoBudget,
  onSetAutoBudget,
  activities,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
  driveAvailable,
  driveConnected,
  onConnectDrive,
  onDisconnectDrive,
  board,
  onReplaceBoard,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('board');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [importPending, setImportPending] = useState<OhmBoard | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap — re-queries live DOM on each Tab press so it stays fresh across tab switches
  useEffect(() => {
    if (!isOpen) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // Focus the active tab button on tab switch so screen readers announce the new tab
    const activeTabEl = document.getElementById(`tab-${activeTab}`);
    if (activeTabEl) activeTabEl.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = overlay.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    overlay.addEventListener('keydown', trap);
    return () => overlay.removeEventListener('keydown', trap);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed && !categories.includes(trimmed)) {
      onAddCategory(trimmed);
    }
    setNewCategoryName('');
  };

  const refreshRestorePoints = () => setRestorePoints(getRestorePoints());

  const handleExport = () => exportBoard(board);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const imported = await importBoard(file);
      setImportPending(imported);
    } catch {
      // Invalid file -- silently ignore
    }
  };

  const handleImportReplace = () => {
    if (!importPending) return;
    createRestorePoint(board, 'Before import');
    onReplaceBoard(importPending);
    toastImportComplete(importPending.cards.length);
    setImportPending(null);
    refreshRestorePoints();
  };

  const handleImportMerge = () => {
    if (!importPending) return;
    createRestorePoint(board, 'Before import');
    const merged = mergeBoards(board, importPending);
    onReplaceBoard(merged);
    toastImportComplete(merged.cards.length);
    setImportPending(null);
    refreshRestorePoints();
  };

  const handleCreateRestorePoint = () => {
    createRestorePoint(board, 'Manual');
    refreshRestorePoints();
  };

  const handleRestore = (rp: RestorePoint) => {
    if (confirmRestoreId === rp.id) {
      createRestorePoint(board, 'Before restore');
      onReplaceBoard(rp.board);
      setConfirmRestoreId(null);
      refreshRestorePoints();
    } else {
      setConfirmRestoreId(rp.id);
    }
  };

  const handleDeleteRestorePoint = (id: string) => {
    deleteRestorePoint(id);
    refreshRestorePoints();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (tab === 'data') refreshRestorePoints();
  };

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    let next: number | undefined;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    if (next !== undefined) {
      e.preventDefault();
      const tab = TABS[next]!;
      handleTabChange(tab.id);
      document.getElementById(`tab-${tab.id}`)?.focus();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="bg-ohm-bg fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Header */}
      <header className="border-ohm-border relative flex items-center justify-center border-b px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-ohm-muted hover:text-ohm-text absolute left-4 flex items-center gap-1.5 rounded-md p-1 transition-colors"
          aria-label="Back to board"
        >
          <ChevronLeft size={18} />
          <span className="font-display text-xs tracking-wider uppercase">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-ohm-muted" />
          <h1 className="font-display text-ohm-text text-sm font-bold tracking-widest uppercase">
            Settings
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-ohm-border border-b px-4" aria-label="Settings tabs">
        <div className="flex gap-1" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              onKeyDown={handleTabKeyDown}
              className={`font-display flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11px] tracking-wider uppercase transition-colors ${
                activeTab === id
                  ? 'border-ohm-spark text-ohm-spark'
                  : 'text-ohm-muted hover:text-ohm-text border-transparent'
              }`}
              aria-selected={activeTab === id}
              aria-controls={`tabpanel-${id}`}
              id={`tab-${id}`}
              role="tab"
              tabIndex={activeTab === id ? 0 : -1}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        <div className="mx-auto max-w-md">
          {activeTab === 'board' && (
            <BoardTab
              categories={categories}
              onRemoveCategory={onRemoveCategory}
              onRenameCategory={onRenameCategory}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              handleAddCategory={handleAddCategory}
              energyBudget={energyBudget}
              liveCapacity={liveCapacity}
              onSetEnergyBudget={onSetEnergyBudget}
              onSetLiveCapacity={onSetLiveCapacity}
              autoBudget={autoBudget}
              windowSize={windowSize}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleTab
              timeFeatures={timeFeatures}
              windowSize={windowSize}
              onSetTimeFeatures={onSetTimeFeatures}
              onSetWindowSize={onSetWindowSize}
              autoBudget={autoBudget}
              onSetAutoBudget={onSetAutoBudget}
              liveCapacity={liveCapacity}
              activities={activities}
              categories={categories}
              onAddActivity={onAddActivity}
              onUpdateActivity={onUpdateActivity}
              onDeleteActivity={onDeleteActivity}
            />
          )}

          {activeTab === 'data' && (
            <DataTab
              driveAvailable={driveAvailable}
              driveConnected={driveConnected}
              onConnectDrive={onConnectDrive}
              onDisconnectDrive={onDisconnectDrive}
              handleExport={handleExport}
              fileInputRef={fileInputRef}
              handleFileSelected={handleFileSelected}
              importPending={importPending}
              handleImportMerge={handleImportMerge}
              handleImportReplace={handleImportReplace}
              setImportPending={setImportPending}
              restorePoints={restorePoints}
              handleCreateRestorePoint={handleCreateRestorePoint}
              handleRestore={handleRestore}
              handleDeleteRestorePoint={handleDeleteRestorePoint}
              confirmRestoreId={confirmRestoreId}
              formatDate={formatDate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Board Tab ─── */

function BoardTab({
  categories,
  onRemoveCategory,
  onRenameCategory,
  newCategoryName,
  setNewCategoryName,
  handleAddCategory,
  energyBudget,
  liveCapacity,
  onSetEnergyBudget,
  onSetLiveCapacity,
  autoBudget,
  windowSize,
}: {
  categories: string[];
  onRemoveCategory: (c: string) => void;
  onRenameCategory: (old: string, next: string) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  handleAddCategory: () => void;
  energyBudget: number;
  liveCapacity: number;
  onSetEnergyBudget: (v: number) => void;
  onSetLiveCapacity: (v: number) => void;
  autoBudget?: boolean;
  windowSize?: number;
}) {
  return (
    <>
      {/* Categories */}
      <section className="mb-8">
        <span className="font-display text-ohm-muted mb-3 block text-[10px] tracking-widest uppercase">
          Categories
        </span>
        <div className="flex flex-col gap-1.5">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <Input
                defaultValue={cat}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (trimmed && trimmed !== cat) {
                    onRenameCategory(cat, trimmed);
                  } else {
                    e.target.value = cat;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    (e.target as HTMLInputElement).value = cat;
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                aria-label={`Rename category ${cat}`}
                className="border-ohm-border bg-ohm-bg font-body text-ohm-text focus-visible:ring-ohm-spark/20 flex-1 px-3 py-1.5 text-sm focus-visible:ring-offset-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveCategory(cat)}
                className="text-ohm-live/60 hover:text-ohm-live h-9 w-9 shrink-0 hover:bg-transparent"
                aria-label={`Remove ${cat} category`}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddCategory();
          }}
          className="mt-2 flex gap-2"
        >
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category..."
            aria-label="New category name"
            className="border-ohm-border bg-ohm-bg font-body text-ohm-text placeholder:text-ohm-muted/40 focus-visible:ring-ohm-spark/20 flex-1 px-3 py-1.5 text-sm focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            disabled={!newCategoryName.trim()}
            className="bg-ohm-spark/20 font-display text-ohm-spark hover:bg-ohm-spark/30 active:bg-ohm-spark/40 text-xs tracking-wider uppercase"
          >
            Add
          </Button>
        </form>
      </section>

      {/* Energy Capacity */}
      <section>
        <span className="font-display text-ohm-muted mb-3 block text-[10px] tracking-widest uppercase">
          Energy Capacity
        </span>
        {CAPACITY_ROWS.map(({ label, field, color }) => {
          const value = field === 'energyBudget' ? energyBudget : liveCapacity;
          const setter = field === 'energyBudget' ? onSetEnergyBudget : onSetLiveCapacity;
          const locked = field === 'energyBudget' && !!autoBudget;
          return (
            <div
              key={field}
              className={`mt-2 flex items-center gap-3 ${locked ? 'opacity-50' : ''}`}
            >
              <span className={`font-display w-20 text-[10px] tracking-widest uppercase ${color}`}>
                {label}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setter(Math.max(1, value - 1))}
                disabled={value <= 1 || locked}
                className="border-ohm-border text-ohm-muted hover:text-ohm-text h-8 w-8"
                aria-label={`Decrease ${label}`}
              >
                <Minus size={14} />
              </Button>
              <span className="font-display text-ohm-text min-w-[2ch] text-center text-lg font-bold">
                {value}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setter(value + 1)}
                disabled={locked}
                className="border-ohm-border text-ohm-muted hover:text-ohm-text h-8 w-8"
                aria-label={`Increase ${label}`}
              >
                <Plus size={14} />
              </Button>
            </div>
          );
        })}
        {autoBudget && (
          <p className="font-body text-ohm-muted/60 mt-2 text-[10px]">
            Total is auto-calculated ({windowSize ?? WINDOW_DEFAULT} x {liveCapacity}).
          </p>
        )}
      </section>
    </>
  );
}

/* ─── Schedule Tab ─── */

function ScheduleTab({
  timeFeatures,
  windowSize,
  onSetTimeFeatures,
  onSetWindowSize,
  autoBudget,
  onSetAutoBudget,
  liveCapacity,
  activities,
  categories,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
}: {
  timeFeatures?: boolean;
  windowSize?: number;
  onSetTimeFeatures?: (enabled: boolean) => void;
  onSetWindowSize?: (size: number) => void;
  autoBudget?: boolean;
  onSetAutoBudget?: (enabled: boolean) => void;
  liveCapacity: number;
  activities?: Activity[];
  categories: string[];
  onAddActivity?: (
    name: string,
    opts?: { description?: string; schedule?: StoredSchedule; energy?: number; category?: string },
  ) => Activity;
  onUpdateActivity?: (id: string, changes: Partial<Omit<Activity, 'id'>>) => void;
  onDeleteActivity?: (id: string) => void | Promise<void>;
}) {
  return (
    <>
      {/* Time features toggle */}
      {onSetTimeFeatures && (
        <section className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-ohm-muted" />
              <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
                Schedule
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!timeFeatures}
              aria-label="Schedule"
              onClick={() => onSetTimeFeatures(!timeFeatures)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                timeFeatures ? 'bg-ohm-spark' : 'bg-ohm-border'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  timeFeatures ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="font-body text-ohm-muted/60 mt-1.5 text-[11px]">
            Enable recurring activities with a rolling schedule window.
          </p>

          {timeFeatures && onSetWindowSize && (
            <div className="mt-3 flex items-center gap-3">
              <span className="font-display text-ohm-muted w-20 text-[10px] tracking-widest uppercase">
                Window
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  onSetWindowSize(Math.max(WINDOW_MIN, (windowSize ?? WINDOW_DEFAULT) - 1))
                }
                disabled={(windowSize ?? WINDOW_DEFAULT) <= WINDOW_MIN}
                className="border-ohm-border text-ohm-muted hover:text-ohm-text h-8 w-8"
                aria-label="Decrease window size"
              >
                <Minus size={14} />
              </Button>
              <span className="font-display text-ohm-text min-w-[2ch] text-center text-lg font-bold">
                {windowSize ?? WINDOW_DEFAULT}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  onSetWindowSize(Math.min(WINDOW_MAX, (windowSize ?? WINDOW_DEFAULT) + 1))
                }
                disabled={(windowSize ?? WINDOW_DEFAULT) >= WINDOW_MAX}
                className="border-ohm-border text-ohm-muted hover:text-ohm-text h-8 w-8"
                aria-label="Increase window size"
              >
                <Plus size={14} />
              </Button>
              <span className="font-body text-ohm-muted/60 text-[10px]">days</span>
            </div>
          )}

          {timeFeatures && onSetAutoBudget && (
            <div className="mt-3 flex items-center gap-3">
              <span className="font-display text-ohm-muted w-20 text-[10px] tracking-widest uppercase">
                Auto total
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={!!autoBudget}
                aria-label="Auto total budget"
                onClick={() => onSetAutoBudget(!autoBudget)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  autoBudget ? 'bg-ohm-spark' : 'bg-ohm-border'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    autoBudget ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {autoBudget && (
                <span className="font-body text-ohm-muted/60 text-[10px]">
                  {windowSize ?? WINDOW_DEFAULT} x {liveCapacity} ={' '}
                  {(windowSize ?? WINDOW_DEFAULT) * liveCapacity}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Activities */}
      {timeFeatures && activities && onAddActivity && onUpdateActivity && onDeleteActivity && (
        <section>
          <ActivityManager
            activities={activities}
            categories={categories}
            onAdd={onAddActivity}
            onUpdate={onUpdateActivity}
            onDelete={onDeleteActivity}
          />
        </section>
      )}

      {!timeFeatures && !!onSetTimeFeatures && (
        <p className="font-body text-ohm-muted/60 text-sm">
          Enable the schedule toggle above to configure activities and rolling windows.
        </p>
      )}
    </>
  );
}

/* ─── Sync & Data Tab ─── */

function DataTab({
  driveAvailable,
  driveConnected,
  onConnectDrive,
  onDisconnectDrive,
  handleExport,
  fileInputRef,
  handleFileSelected,
  importPending,
  handleImportMerge,
  handleImportReplace,
  setImportPending,
  restorePoints,
  handleCreateRestorePoint,
  handleRestore,
  handleDeleteRestorePoint,
  confirmRestoreId,
  formatDate,
}: {
  driveAvailable?: boolean;
  driveConnected?: boolean;
  onConnectDrive?: () => void;
  onDisconnectDrive?: () => void;
  handleExport: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importPending: OhmBoard | null;
  handleImportMerge: () => void;
  handleImportReplace: () => void;
  setImportPending: (v: OhmBoard | null) => void;
  restorePoints: RestorePoint[];
  handleCreateRestorePoint: () => void;
  handleRestore: (rp: RestorePoint) => void;
  handleDeleteRestorePoint: (id: string) => void;
  confirmRestoreId: string | null;
  formatDate: (iso: string) => string;
}) {
  return (
    <>
      {/* Google Drive */}
      {driveAvailable && (
        <section className="mb-8">
          <span className="font-display text-ohm-muted mb-3 block text-[10px] tracking-widest uppercase">
            Google Drive Sync
          </span>
          {driveConnected ? (
            <div className="flex items-center justify-between">
              <span className="font-body text-ohm-powered text-sm">Connected</span>
              <Button
                variant="outline"
                onClick={onDisconnectDrive}
                className="border-ohm-border text-ohm-muted hover:text-ohm-live text-xs"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              onClick={onConnectDrive}
              className="bg-ohm-spark/20 font-display text-ohm-spark hover:bg-ohm-spark/30 w-full text-xs tracking-wider uppercase"
            >
              Connect Google Drive
            </Button>
          )}
          <p className="font-body text-ohm-muted/60 mt-1.5 text-[11px]">
            Sync your board across devices. Data stored privately in app storage.
          </p>
        </section>
      )}

      {/* Export / Import */}
      <section className="mb-8">
        <span className="font-display text-ohm-muted mb-3 block text-[10px] tracking-widest uppercase">
          Export / Import
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="border-ohm-border text-ohm-muted hover:text-ohm-text flex-1 gap-1.5 text-xs"
          >
            <Download size={14} />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="border-ohm-border text-ohm-muted hover:text-ohm-text flex-1 gap-1.5 text-xs"
          >
            <Upload size={14} />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelected}
            className="hidden"
            aria-label="Import board file"
          />
        </div>

        {importPending && (
          <div className="border-ohm-spark/30 bg-ohm-spark/5 mt-3 rounded-md border p-3">
            <p className="font-body text-ohm-text mb-2 text-xs">
              Import {importPending.cards.length} card
              {importPending.cards.length !== 1 ? 's' : ''}.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleImportMerge}
                className="bg-ohm-spark/20 text-ohm-spark hover:bg-ohm-spark/30 flex-1 text-xs"
              >
                Merge
              </Button>
              <Button
                variant="outline"
                onClick={handleImportReplace}
                className="border-ohm-border text-ohm-muted hover:text-ohm-live flex-1 text-xs"
              >
                Overwrite
              </Button>
              <Button
                variant="outline"
                onClick={() => setImportPending(null)}
                className="border-ohm-border text-ohm-muted hover:text-ohm-text px-2 text-xs"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Auth level */}
      <section className="mb-8">
        <AuthLevelIndicator />
      </section>

      {/* Restore points */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
            Restore Points
          </span>
          <Button
            variant="outline"
            onClick={handleCreateRestorePoint}
            className="border-ohm-border text-ohm-muted hover:text-ohm-text h-6 gap-1 px-2 text-[10px]"
          >
            <Save size={10} />
            Save
          </Button>
        </div>
        {restorePoints.length === 0 ? (
          <p className="font-body text-ohm-muted/60 text-[11px]">No restore points yet.</p>
        ) : (
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {[...restorePoints].reverse().map((rp) => (
              <div
                key={rp.id}
                className="border-ohm-border bg-ohm-bg flex items-center justify-between rounded-md border px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-body text-ohm-text block truncate text-xs">{rp.label}</span>
                  <span className="font-body text-ohm-muted/60 text-[10px]">
                    {formatDate(rp.createdAt)} — {rp.board.cards.length} card
                    {rp.board.cards.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="ml-2 flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleRestore(rp)}
                    className={`text-ohm-muted rounded-sm p-1 transition-colors ${
                      confirmRestoreId === rp.id
                        ? 'bg-ohm-spark/20 text-ohm-spark'
                        : 'hover:text-ohm-text'
                    }`}
                    aria-label={
                      confirmRestoreId === rp.id ? 'Confirm restore' : `Restore to ${rp.label}`
                    }
                    title={confirmRestoreId === rp.id ? 'Click again to confirm' : 'Restore'}
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRestorePoint(rp.id)}
                    className="text-ohm-muted hover:text-ohm-live rounded-sm p-1 transition-colors"
                    aria-label={`Delete restore point ${rp.label}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
