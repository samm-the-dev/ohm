import { useState, useRef } from 'react';
import {
  Settings,
  X,
  Minus,
  Plus,
  ChevronDown,
  Download,
  Upload,
  Save,
  Trash2,
  RotateCcw,
  MonitorDown,
  Clock,
} from 'lucide-react';
import type { OhmBoard } from '../types/board';
import { WINDOW_MIN, WINDOW_MAX, WINDOW_DEFAULT } from '../types/board';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
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
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import type { Activity } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import { ActivityManager } from './ActivityManager';

interface SettingsDialogProps {
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
    opts?: { description?: string; schedule?: StoredSchedule; energy?: number },
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
  {
    label: 'Live',
    field: 'liveCapacity' as const,
    color: 'text-ohm-live',
  },
  {
    label: 'Total',
    field: 'energyBudget' as const,
    color: 'text-ohm-spark',
  },
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

export function SettingsDialog({
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
}: SettingsDialogProps) {
  const { isInstallable, installApp } = useInstallPrompt();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [importPending, setImportPending] = useState<OhmBoard | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed && !categories.includes(trimmed)) {
      onAddCategory(trimmed);
    }
    setNewCategoryName('');
  };

  const refreshRestorePoints = () => setRestorePoints(getRestorePoints());

  const handleToggleAdvanced = () => {
    if (!advancedOpen) refreshRestorePoints();
    setAdvancedOpen((prev) => !prev);
  };

  const handleExport = () => exportBoard(board);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setNewCategoryName('');
          onClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onSwipeDismiss={() => {
          setNewCategoryName('');
          onClose();
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Settings size={16} className="text-ohm-muted" />
          <DialogTitle className="font-display text-ohm-muted text-xs tracking-widest uppercase">
            Settings
          </DialogTitle>
        </div>
        <DialogDescription className="sr-only">Board settings</DialogDescription>

        {/* Categories */}
        <div className="mb-5">
          <span className="font-display text-ohm-muted mb-2 block text-[10px] tracking-widest uppercase">
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
        </div>

        {/* Schedule (time features) */}
        {onSetTimeFeatures && (
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-ohm-muted" />
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
          </div>
        )}

        {/* Activities */}
        {timeFeatures && activities && onAddActivity && onUpdateActivity && onDeleteActivity && (
          <ActivityManager
            activities={activities}
            onAdd={onAddActivity}
            onUpdate={onUpdateActivity}
            onDelete={onDeleteActivity}
          />
        )}

        {/* Capacity */}
        <div className="border-ohm-border mt-5 border-t pt-5">
          <span className="font-display text-ohm-muted mb-2 block text-[10px] tracking-widest uppercase">
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
                <span
                  className={`font-display w-20 text-[10px] tracking-widest uppercase ${color}`}
                >
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
        </div>

        {/* Google Drive */}
        {driveAvailable && (
          <div className="border-ohm-border mt-5 border-t pt-5">
            <span className="font-display text-ohm-muted mb-2 block text-[10px] tracking-widest uppercase">
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
          </div>
        )}

        {/* Install PWA */}
        {isInstallable && (
          <div className="border-ohm-border mt-5 border-t pt-5">
            <Button
              onClick={installApp}
              variant="outline"
              className="border-ohm-border text-ohm-muted hover:text-ohm-text w-full gap-2 text-xs"
            >
              <MonitorDown size={14} />
              Install App
            </Button>
          </div>
        )}

        {/* Advanced */}
        <div className="border-ohm-border mt-5 border-t pt-4">
          <button
            type="button"
            onClick={handleToggleAdvanced}
            className="focus-visible:ring-ring flex w-full items-center gap-2 rounded-sm text-left focus-visible:ring-1 focus-visible:outline-hidden"
          >
            <ChevronDown
              size={14}
              className={`text-ohm-muted transition-transform ${advancedOpen ? 'rotate-0' : '-rotate-90'}`}
            />
            <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
              Advanced
            </span>
          </button>

          {advancedOpen && (
            <div className="mt-3 flex flex-col gap-3">
              {/* Export / Import */}
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

              {/* Import mode picker */}
              {importPending && (
                <div className="border-ohm-spark/30 bg-ohm-spark/5 rounded-md border p-3">
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

              {/* Auth level indicator */}
              <AuthLevelIndicator />

              {/* Restore points */}
              <div>
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
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {[...restorePoints].reverse().map((rp) => (
                      <div
                        key={rp.id}
                        className="border-ohm-border bg-ohm-bg flex items-center justify-between rounded-md border px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-body text-ohm-text block truncate text-xs">
                            {rp.label}
                          </span>
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
                              confirmRestoreId === rp.id
                                ? 'Confirm restore'
                                : `Restore to ${rp.label}`
                            }
                            title={
                              confirmRestoreId === rp.id ? 'Click again to confirm' : 'Restore'
                            }
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
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
