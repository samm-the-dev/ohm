import { useState, useCallback, useRef, useEffect } from 'react';
import type { OhmCard, ColumnStatus } from '../types/board';
import {
  STATUS,
  COLUMNS,
  ENERGY_CONFIG,
  ENERGY_CLASSES,
  STATUS_CLASSES,
  SPARK_CLASSES,
  VALID_TRANSITIONS,
} from '../types/board';
import { Settings, List, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle as AlertTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from './ui/alert-dialog';

interface CardDetailProps {
  card: OhmCard;
  categories: string[];
  onSave: (card: OhmCard) => void;
  onDelete: (cardId: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  isNew?: boolean;
}

export function CardDetail({
  card,
  categories,
  onSave,
  onDelete,
  onClose,
  onOpenSettings,
  isNew,
}: CardDetailProps) {
  const [editing, setEditing] = useState(card);
  const [newNote, setNewNote] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const isPowered = editing.status === STATUS.POWERED;

  // Auto-focus title for new cards
  useEffect(() => {
    if (isNew) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isNew]);

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  const descRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (node) autoSize(node);
  }, []);

  const handleSave = () => {
    if (isNew && !editing.title.trim()) return;
    const pendingTask = newNote.trim();
    const finalTasks = pendingTask ? [...editing.tasks, pendingTask] : editing.tasks;
    onSave({ ...editing, tasks: finalTasks, updatedAt: new Date().toISOString() });
    onClose();
  };

  const handleStatusChange = (newStatus: ColumnStatus) => {
    setEditing((prev) => ({ ...prev, status: newStatus }));
  };

  const handleAddNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    setEditing((prev) => ({ ...prev, tasks: [...prev.tasks, trimmed] }));
    setNewNote('');
  };

  const handleUpdateNote = (index: number, value: string) => {
    setEditing((prev) => ({
      ...prev,
      tasks: prev.tasks.map((n, i) => (i === index ? value : n)),
    }));
  };

  const handleRemoveNote = (index: number) => {
    setEditing((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  };

  const accent = isNew ? SPARK_CLASSES : STATUS_CLASSES[editing.status]!;
  const hasChangedStatus = editing.status !== card.status;
  const availableTransitions = hasChangedStatus
    ? [card.status]
    : (VALID_TRANSITIONS[card.status] ?? []);

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {/* Header -- title + close */}
        <DialogTitle className="sr-only">{editing.title || 'Card details'}</DialogTitle>
        <DialogDescription className="sr-only">
          {isNew ? 'Create a new card' : 'Edit card details'}
        </DialogDescription>

        {/* Title */}
        <div className="mb-4">
          {isPowered && !isNew ? (
            <p className="font-body text-sm font-medium text-ohm-text">{editing.title}</p>
          ) : (
            <Input
              ref={titleRef}
              value={editing.title}
              onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }))}
              aria-label="Card title"
              autoComplete="off"
              data-form-type="other"
              placeholder={isNew ? "What's the idea?" : undefined}
              className={`${accent.border} bg-ohm-bg font-body text-sm font-medium text-ohm-text placeholder:text-ohm-muted/50 ${accent.ring} focus-visible:ring-offset-0`}
            />
          )}
        </div>

        {/* Description */}
        <div className="mb-3">
          <label
            htmlFor="card-description"
            className="mb-1 block font-display text-[10px] uppercase tracking-widest text-ohm-muted"
          >
            Description
          </label>
          {isPowered && !isNew ? (
            <p className="font-body text-sm text-ohm-muted">
              {editing.description || <span className="italic text-ohm-muted/40">None</span>}
            </p>
          ) : (
            <Textarea
              ref={descRef}
              id="card-description"
              value={editing.description}
              onChange={(e) => {
                setEditing((prev) => ({ ...prev, description: e.target.value }));
                autoSize(e.target);
              }}
              placeholder="Notes, context, details..."
              autoComplete="off"
              rows={2}
              className={`resize-none ${accent.border} bg-ohm-bg font-body text-sm text-ohm-text placeholder:text-ohm-muted/50 ${accent.ring} focus-visible:ring-offset-0`}
            />
          )}
        </div>

        {/* Tasks */}
        <div className="mb-3">
          <span className="mb-2 flex items-center gap-1 font-display text-[10px] uppercase tracking-widest text-ohm-muted">
            <List size={10} />
            Tasks
          </span>
          {editing.tasks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {editing.tasks.map((note, index) => (
                <div key={index} className="flex items-center gap-2">
                  {isPowered ? (
                    <span className="min-w-0 flex-1 rounded-md border border-ohm-border bg-ohm-bg px-3 py-2 font-body text-sm text-ohm-text">
                      {note}
                    </span>
                  ) : (
                    <Input
                      value={note}
                      onChange={(e) => handleUpdateNote(index, e.target.value)}
                      autoComplete="off"
                      data-form-type="other"
                      className={`flex-1 ${accent.border} bg-ohm-bg font-body text-sm text-ohm-text ${accent.ring} focus-visible:ring-offset-0`}
                    />
                  )}
                  {!isPowered && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveNote(index)}
                      className="h-9 w-9 shrink-0 text-ohm-live/60 hover:bg-transparent hover:text-ohm-live"
                      aria-label={`Delete task: ${note}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!isPowered && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddNote();
              }}
              className="mt-2 flex gap-2"
            >
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a task..."
                autoComplete="off"
                data-form-type="other"
                className={`flex-1 ${accent.border} bg-ohm-bg font-body text-sm text-ohm-text placeholder:text-ohm-muted/50 ${accent.ring} focus-visible:ring-offset-0`}
              />
              <Button
                type="submit"
                disabled={!newNote.trim()}
                className="bg-ohm-spark/20 font-display text-xs uppercase tracking-wider text-ohm-spark hover:bg-ohm-spark/30 active:bg-ohm-spark/40"
              >
                Add
              </Button>
            </form>
          )}
          {editing.tasks.length === 0 && isPowered && (
            <p className="font-body text-sm italic text-ohm-muted/40">No tasks</p>
          )}
        </div>

        {/* Energy tag */}
        <div className="mb-3">
          <span className="mb-2 block font-display text-[10px] uppercase tracking-widest text-ohm-muted">
            Energy
          </span>
          {isPowered && !isNew ? (
            (() => {
              const ec = ENERGY_CLASSES[editing.energy]!;
              const config = ENERGY_CONFIG[editing.energy]!;
              const Icon = config.icon;
              return (
                <span className={`flex items-center gap-1.5 ${ec.text}`}>
                  <Icon size={14} />
                  <span className="font-body text-sm">{config.label}</span>
                </span>
              );
            })()
          ) : (
            <div className="flex flex-wrap gap-2">
              {ENERGY_CONFIG.map((config, index) => {
                const Icon = config.icon;
                const selected = editing.energy === index;
                const ec = ENERGY_CLASSES[index]!;
                return (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing((prev) => ({ ...prev, energy: index as OhmCard['energy'] }))
                    }
                    className={`gap-1.5 font-body text-xs ${
                      selected ? `${ec.border} ${ec.bg}` : `${ec.dimBorder} bg-ohm-bg`
                    }`}
                  >
                    <span className={ec.text}>
                      <Icon size={14} />
                    </span>
                    <span className={selected ? ec.text : 'text-ohm-muted'}>{config.label}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {/* Category */}
        {!isPowered && (
          <div className="mb-4">
            <span className="mb-2 block font-display text-[10px] uppercase tracking-widest text-ohm-muted">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing((prev) => ({ ...prev, category: '' }))}
                className={`font-body text-xs ${
                  !editing.category
                    ? 'border-ohm-text/30 bg-ohm-text/10 text-ohm-text'
                    : 'border-ohm-border bg-ohm-bg text-ohm-muted hover:text-ohm-text'
                }`}
              >
                None
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing((prev) => ({ ...prev, category: cat }))}
                  className={`font-body text-xs ${
                    editing.category === cat
                      ? 'border-ohm-text/30 bg-ohm-text/10 text-ohm-text'
                      : 'border-ohm-border bg-ohm-bg text-ohm-muted hover:text-ohm-text'
                  }`}
                >
                  {cat}
                </Button>
              ))}
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-md border border-ohm-text/20 p-1.5 text-ohm-text/70 transition-colors hover:text-ohm-text"
                aria-label="Manage categories"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Powered: show category as read-only if set */}
        {isPowered && editing.category && (
          <div className="mb-4">
            <span className="mb-1 block font-display text-[10px] uppercase tracking-widest text-ohm-muted">
              Category
            </span>
            <p className="font-body text-sm text-ohm-muted">{editing.category}</p>
          </div>
        )}

        {/* Status -- contextual transitions only (hidden for new cards) */}
        {!isNew && availableTransitions.length > 0 && (
          <div className="mb-5">
            <span className="mb-2 block font-display text-[10px] uppercase tracking-widest text-ohm-muted">
              Move to
            </span>
            <div className="flex gap-2">
              {availableTransitions.map((status) => {
                const col = COLUMNS[status]!;
                const targetAccent = STATUS_CLASSES[status]!;
                return (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange(status)}
                    className={`${targetAccent.border} bg-ohm-bg font-body text-xs uppercase text-ohm-muted hover:text-ohm-text`}
                  >
                    {col.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-ohm-border pt-3">
          {!isNew ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="font-display text-xs uppercase tracking-wider text-ohm-live hover:bg-transparent hover:text-ohm-live/80"
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertTitle className="text-ohm-text">Delete this card?</AlertTitle>
                  <AlertDialogDescription>
                    This will permanently remove &ldquo;{editing.title || card.title}&rdquo;.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-ohm-border text-ohm-muted hover:bg-ohm-bg hover:text-ohm-text">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onDelete(card.id);
                      onClose();
                    }}
                    className="bg-ohm-live/20 text-ohm-live hover:bg-ohm-live/30"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {isPowered && !isNew && !hasChangedStatus ? (
              <Button
                variant="ghost"
                onClick={onClose}
                className="font-display text-xs uppercase tracking-wider text-ohm-muted hover:text-ohm-text"
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="font-display text-xs uppercase tracking-wider text-ohm-muted hover:text-ohm-text"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isNew && !editing.title.trim()}
                  className="bg-ohm-powered/20 font-display text-xs uppercase tracking-wider text-ohm-powered hover:bg-ohm-powered/30 active:bg-ohm-powered/40"
                >
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Timestamps -- only for existing cards */}
        {!isNew && (
          <div className="mt-3 font-body text-[11px] text-ohm-muted/60">
            Created {new Date(card.createdAt).toLocaleDateString()} &middot; Updated{' '}
            {new Date(card.updatedAt).toLocaleDateString()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
