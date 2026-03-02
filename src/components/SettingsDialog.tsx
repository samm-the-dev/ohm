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
} from 'lucide-react';
import type { OhmBoard, ColumnStatus } from '../types/board';
import { STATUS } from '../types/board';
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

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onAddCategory: (category: string) => void;
  onRemoveCategory: (category: string) => void;
  capacities: { charging: number; live: number; grounded: number };
  onSetCapacity: (status: ColumnStatus, capacity: number) => void;
  driveAvailable?: boolean;
  driveConnected?: boolean;
  onConnectDrive?: () => void;
  onDisconnectDrive?: () => void;
  board: OhmBoard;
  onReplaceBoard: (board: OhmBoard) => void;
}

const CAPACITY_ROWS = [
  {
    label: 'Charging',
    status: STATUS.CHARGING,
    key: 'charging' as const,
    color: 'text-ohm-charging',
  },
  { label: 'Live', status: STATUS.LIVE, key: 'live' as const, color: 'text-ohm-live' },
  {
    label: 'Grounded',
    status: STATUS.GROUNDED,
    key: 'grounded' as const,
    color: 'text-ohm-grounded',
  },
];

export function SettingsDialog({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onRemoveCategory,
  capacities,
  onSetCapacity,
  driveAvailable,
  driveConnected,
  onConnectDrive,
  onDisconnectDrive,
  board,
  onReplaceBoard,
}: SettingsDialogProps) {
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
    setImportPending(null);
    refreshRestorePoints();
  };

  const handleImportMerge = () => {
    if (!importPending) return;
    createRestorePoint(board, 'Before import');
    onReplaceBoard(mergeBoards(board, importPending));
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
      <DialogContent className="sm:max-w-md">
        <div className="mb-3 flex items-center gap-2">
          <Settings size={16} className="text-ohm-muted" />
          <DialogTitle className="font-display text-xs uppercase tracking-widest text-ohm-muted">
            Settings
          </DialogTitle>
        </div>
        <DialogDescription className="sr-only">Board settings</DialogDescription>

        {/* Categories */}
        <div className="mb-5">
          <span className="mb-2 block font-display text-[10px] uppercase tracking-widest text-ohm-muted">
            Categories
          </span>
          <div className="flex flex-col gap-1.5">
            {categories.map((cat) => (
              <div
                key={cat}
                className="flex items-center justify-between rounded-md border border-ohm-border bg-ohm-bg px-3 py-1.5"
              >
                <span className="font-body text-sm text-ohm-text">{cat}</span>
                <button
                  type="button"
                  onClick={() => onRemoveCategory(cat)}
                  className="rounded-sm p-0.5 text-ohm-muted transition-colors hover:text-ohm-live"
                  aria-label={`Remove ${cat} category`}
                >
                  <X size={14} />
                </button>
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
              className="flex-1 border-ohm-border bg-ohm-bg px-3 py-1.5 font-body text-sm text-ohm-text placeholder:text-ohm-muted/40 focus-visible:ring-ohm-spark/20 focus-visible:ring-offset-0"
            />
            <Button
              type="submit"
              disabled={!newCategoryName.trim()}
              className="bg-ohm-spark/20 font-display text-xs uppercase tracking-wider text-ohm-spark hover:bg-ohm-spark/30 active:bg-ohm-spark/40"
            >
              Add
            </Button>
          </form>
        </div>

        {/* Capacity */}
        <div>
          <span className="mb-2 block font-display text-[10px] uppercase tracking-widest text-ohm-muted">
            Energy Capacity
          </span>
          {CAPACITY_ROWS.map(({ label, status, key, color }) => {
            const value = capacities[key];
            return (
              <div key={status} className="mt-2 flex items-center gap-3">
                <span
                  className={`w-20 font-display text-[10px] uppercase tracking-widest ${color}`}
                >
                  {label}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onSetCapacity(status, Math.max(1, value - 1))}
                  disabled={value <= 1}
                  className="h-8 w-8 border-ohm-border text-ohm-muted hover:text-ohm-text"
                  aria-label={`Decrease ${label} capacity`}
                >
                  <Minus size={14} />
                </Button>
                <span className="min-w-[2ch] text-center font-display text-lg font-bold text-ohm-text">
                  {value}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onSetCapacity(status, value + 1)}
                  className="h-8 w-8 border-ohm-border text-ohm-muted hover:text-ohm-text"
                  aria-label={`Increase ${label} capacity`}
                >
                  <Plus size={14} />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Google Drive */}
        {driveAvailable && (
          <div className="mt-5 border-t border-ohm-border pt-5">
            <span className="mb-2 block font-display text-[10px] uppercase tracking-widest text-ohm-muted">
              Google Drive Sync
            </span>
            {driveConnected ? (
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-ohm-powered">Connected</span>
                <Button
                  variant="outline"
                  onClick={onDisconnectDrive}
                  className="border-ohm-border text-xs text-ohm-muted hover:text-ohm-live"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={onConnectDrive}
                className="w-full bg-ohm-spark/20 font-display text-xs uppercase tracking-wider text-ohm-spark hover:bg-ohm-spark/30"
              >
                Connect Google Drive
              </Button>
            )}
            <p className="mt-1.5 font-body text-[11px] text-ohm-muted/60">
              Sync your board across devices. Data stored privately in app storage.
            </p>
          </div>
        )}

        {/* Advanced */}
        <div className="mt-5 border-t border-ohm-border pt-4">
          <button
            type="button"
            onClick={handleToggleAdvanced}
            className="flex w-full items-center gap-2 text-left"
          >
            <ChevronDown
              size={14}
              className={`text-ohm-muted transition-transform ${advancedOpen ? 'rotate-0' : '-rotate-90'}`}
            />
            <span className="font-display text-[10px] uppercase tracking-widest text-ohm-muted">
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
                  className="flex-1 gap-1.5 border-ohm-border text-xs text-ohm-muted hover:text-ohm-text"
                >
                  <Download size={14} />
                  Export
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 gap-1.5 border-ohm-border text-xs text-ohm-muted hover:text-ohm-text"
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
                <div className="rounded-md border border-ohm-spark/30 bg-ohm-spark/5 p-3">
                  <p className="mb-2 font-body text-xs text-ohm-text">
                    Import {importPending.cards.length} card
                    {importPending.cards.length !== 1 ? 's' : ''}. How?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleImportMerge}
                      className="flex-1 bg-ohm-spark/20 text-xs text-ohm-spark hover:bg-ohm-spark/30"
                    >
                      Merge
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleImportReplace}
                      className="flex-1 border-ohm-border text-xs text-ohm-muted hover:text-ohm-live"
                    >
                      Replace
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setImportPending(null)}
                      className="border-ohm-border px-2 text-xs text-ohm-muted hover:text-ohm-text"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Restore points */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-[10px] uppercase tracking-widest text-ohm-muted">
                    Restore Points
                  </span>
                  <Button
                    variant="outline"
                    onClick={handleCreateRestorePoint}
                    className="h-6 gap-1 border-ohm-border px-2 text-[10px] text-ohm-muted hover:text-ohm-text"
                  >
                    <Save size={10} />
                    Save
                  </Button>
                </div>
                {restorePoints.length === 0 ? (
                  <p className="font-body text-[11px] text-ohm-muted/60">No restore points yet.</p>
                ) : (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {[...restorePoints].reverse().map((rp) => (
                      <div
                        key={rp.id}
                        className="flex items-center justify-between rounded-md border border-ohm-border bg-ohm-bg px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-body text-xs text-ohm-text">
                            {rp.label}
                          </span>
                          <span className="font-body text-[10px] text-ohm-muted/60">
                            {formatDate(rp.createdAt)} — {rp.board.cards.length} card
                            {rp.board.cards.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => handleRestore(rp)}
                            className={`rounded-sm p-1 text-ohm-muted transition-colors ${
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
                            className="rounded-sm p-1 text-ohm-muted transition-colors hover:text-ohm-live"
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
