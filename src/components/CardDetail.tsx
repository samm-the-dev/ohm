import { useState, useCallback, useRef, useEffect } from 'react';
import type { OhmCard, ColumnStatus } from '../types/board';
import {
  STATUS,
  COLUMNS,
  VALID_TRANSITIONS,
  energyColor,
  STATUS_CLASSES,
  SPARK_CLASSES,
} from '../types/board';
import type { Activity } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import { EnergySlider } from './ui/energy-slider';
import { ScheduleEditor } from './ActivityManager';
import { Settings, List, Trash2, Calendar, Repeat } from 'lucide-react';
import { DatePicker } from './ui/date-picker';
import { formatDateLabel, toISODate } from '../utils/schedule-utils';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from './ui/responsive-dialog';
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
  onAddActivity?: (
    name: string,
    opts?: { description?: string; schedule?: StoredSchedule; energy?: number; category?: string },
  ) => Activity;
  onEditSchedule?: (activityId: string) => void;
  isNew?: boolean;
  energyMax?: number;
}

export function CardDetail({
  card,
  categories,
  onSave,
  onDelete,
  onClose,
  onOpenSettings,
  onAddActivity,
  onEditSchedule,
  isNew,
  energyMax,
}: CardDetailProps) {
  const [editing, setEditing] = useState(card);
  const [newNote, setNewNote] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [schedule, setSchedule] = useState<Partial<StoredSchedule>>({ repeatFrequency: 'P1D' });
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
    if (isNew && isRecurring && onAddActivity) {
      onAddActivity(editing.title.trim(), {
        description: editing.description || undefined,
        schedule: {
          ...schedule,
          repeatFrequency: schedule.repeatFrequency ?? 'P1D',
        } as StoredSchedule,
        energy: editing.energy,
        category: editing.category || undefined,
      });
      onClose();
      return;
    }
    const pendingTask = newNote.trim();
    const finalTasks = pendingTask ? [...editing.tasks, pendingTask] : editing.tasks;
    onSave({ ...editing, tasks: finalTasks, updatedAt: new Date().toISOString() });
    onClose();
  };

  const handleStatusChange = (newStatus: ColumnStatus) => {
    setEditing((prev) => {
      const updated = { ...prev, status: newStatus };
      // Reset scheduledDate to today when re-activating a card
      const reactivating =
        (prev.status === STATUS.GROUNDED && newStatus === STATUS.CHARGING) ||
        (prev.status === STATUS.POWERED &&
          (newStatus === STATUS.LIVE || newStatus === STATUS.CHARGING));
      if (reactivating) {
        updated.scheduledDate = toISODate(new Date());
      }
      return updated;
    });
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
    : (VALID_TRANSITIONS[editing.status] ?? []);

  return (
    <ResponsiveDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveDialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        {/* Header -- title + close */}
        <ResponsiveDialogTitle className="sr-only">
          {editing.title || 'Card details'}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription className="sr-only">
          {isNew ? 'Create a new card' : 'Edit card details'}
        </ResponsiveDialogDescription>

        {/* Title */}
        <div className="mb-4">
          {isPowered && !isNew ? (
            <p className="font-body text-ohm-text text-base font-medium">{editing.title}</p>
          ) : (
            <Input
              ref={titleRef}
              value={editing.title}
              onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }))}
              aria-label="Card title"
              placeholder={isNew ? "What's the idea?" : undefined}
              className={`${accent.border} bg-ohm-bg font-body text-ohm-text placeholder:text-ohm-muted/50 text-base font-medium ${accent.ring} focus-visible:ring-offset-0`}
            />
          )}
        </div>

        {/* Description */}
        <div className="mb-3">
          <label
            htmlFor="card-description"
            className="font-display text-ohm-muted mb-1 block text-xs tracking-widest uppercase"
          >
            Description
          </label>
          {isPowered && !isNew ? (
            <p className="font-body text-ohm-muted text-base">
              {editing.description || <span className="text-ohm-muted/40 italic">None</span>}
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
              rows={2}
              className={`resize-none ${accent.border} bg-ohm-bg font-body text-ohm-text placeholder:text-ohm-muted/50 text-base ${accent.ring} focus-visible:ring-offset-0`}
            />
          )}
        </div>

        {/* Tasks */}
        <div className="mb-3">
          <span className="font-display text-ohm-muted mb-2 flex items-center gap-1 text-xs tracking-widest uppercase">
            <List size={10} />
            Tasks
          </span>
          {editing.tasks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {editing.tasks.map((note, index) => (
                <div key={index} className="flex items-center gap-2">
                  {isPowered ? (
                    <span className="border-ohm-border bg-ohm-bg font-body text-ohm-text min-w-0 flex-1 rounded-md border px-3 py-2 text-base">
                      {note}
                    </span>
                  ) : (
                    <Input
                      value={note}
                      onChange={(e) => handleUpdateNote(index, e.target.value)}
                      className={`flex-1 ${accent.border} bg-ohm-bg font-body text-ohm-text text-base ${accent.ring} focus-visible:ring-offset-0`}
                    />
                  )}
                  {!isPowered && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveNote(index)}
                      className="text-ohm-live/60 hover:text-ohm-live h-9 w-9 shrink-0 hover:bg-transparent"
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
                className={`flex-1 ${accent.border} bg-ohm-bg font-body text-ohm-text placeholder:text-ohm-muted/50 text-base ${accent.ring} focus-visible:ring-offset-0`}
              />
              <Button
                type="submit"
                disabled={!newNote.trim()}
                className="bg-ohm-spark/20 font-display text-ohm-spark hover:bg-ohm-spark/30 active:bg-ohm-spark/40 text-sm tracking-wider uppercase"
              >
                Add
              </Button>
            </form>
          )}
          {editing.tasks.length === 0 && isPowered && (
            <p className="font-body text-ohm-muted/40 text-sm italic">No tasks</p>
          )}
        </div>

        {/* Energy tag */}
        <div className="mb-3">
          <span className="font-display text-ohm-muted mb-2 block text-xs tracking-widest uppercase">
            Energy
          </span>
          {isPowered && !isNew ? (
            <span
              className="font-display text-base font-bold"
              style={{ color: energyColor(editing.energy, undefined, energyMax) }}
            >
              {editing.energy}
            </span>
          ) : (
            <EnergySlider
              value={editing.energy}
              onChange={(v) => setEditing((prev) => ({ ...prev, energy: v }))}
              max={energyMax}
            />
          )}
        </div>

        {/* Scheduled date / Recurring toggle */}
        <div className="mb-3">
          <span className="font-display text-ohm-muted mb-2 flex items-center gap-1 text-xs tracking-widest uppercase">
            <Calendar size={10} />
            Scheduled
            {isNew && onAddActivity && (
              <button
                type="button"
                onClick={() => setIsRecurring((v) => !v)}
                className={`ml-2 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                  isRecurring
                    ? 'bg-ohm-spark/20 text-ohm-spark'
                    : 'bg-ohm-border/50 text-ohm-muted hover:text-ohm-text'
                }`}
              >
                <Repeat size={9} />
                Repeat
              </button>
            )}
            {!isNew && editing.activityInstanceId && onEditSchedule && (
              <button
                type="button"
                onClick={() => onEditSchedule(editing.activityInstanceId!)}
                className="bg-ohm-border/50 text-ohm-muted hover:text-ohm-text ml-2 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] transition-colors"
              >
                <Settings size={9} />
                Edit schedule
              </button>
            )}
          </span>
          {isRecurring && isNew ? (
            <ScheduleEditor schedule={schedule} onChange={setSchedule} />
          ) : editing.activityInstanceId ? (
            <p className="font-body text-ohm-muted text-base">
              {editing.scheduledDate
                ? formatDateLabel(editing.scheduledDate, toISODate(new Date()), true)
                : 'None'}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <DatePicker
                value={editing.scheduledDate}
                onChange={(date) => setEditing((prev) => ({ ...prev, scheduledDate: date }))}
                max={isPowered ? toISODate(new Date()) : undefined}
                accent={accent}
              />
              {editing.scheduledDate && !isPowered && (
                <button
                  type="button"
                  onClick={() => setEditing((prev) => ({ ...prev, scheduledDate: undefined }))}
                  className="text-ohm-muted hover:text-ohm-text text-xs underline decoration-dotted"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category */}
        {!isPowered && (
          <div className="mb-4">
            <span className="font-display text-ohm-muted mb-2 block text-xs tracking-widest uppercase">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing((prev) => ({ ...prev, category: '' }))}
                className={`font-body text-sm ${
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
                  className={`font-body text-sm ${
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
                className="border-ohm-text/20 text-ohm-text/70 hover:text-ohm-text focus-visible:ring-ring rounded-md border p-1.5 transition-colors focus-visible:ring-1 focus-visible:outline-hidden"
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
            <span className="font-display text-ohm-muted mb-1 block text-xs tracking-widest uppercase">
              Category
            </span>
            <p className="font-body text-ohm-muted text-base">{editing.category}</p>
          </div>
        )}

        {/* Status -- contextual transitions only (hidden for new cards) */}
        {!isNew && availableTransitions.length > 0 && (
          <div className="mb-5">
            <span className="font-display text-ohm-muted mb-2 block text-xs tracking-widest uppercase">
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
                    className={`${targetAccent.border} bg-ohm-bg font-body text-ohm-muted hover:text-ohm-text text-sm uppercase`}
                  >
                    {col.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-ohm-border flex items-center justify-between border-t pt-3">
          {!isNew ? (
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="font-display text-ohm-live hover:text-ohm-live/80 text-sm tracking-wider uppercase hover:bg-transparent"
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
                className="font-display text-ohm-muted hover:text-ohm-text text-sm tracking-wider uppercase"
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="font-display text-ohm-muted hover:text-ohm-text text-sm tracking-wider uppercase"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isNew && !editing.title.trim()}
                  className="bg-ohm-powered/20 font-display text-ohm-powered hover:bg-ohm-powered/30 active:bg-ohm-powered/40 text-sm tracking-wider uppercase"
                >
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Timestamps -- only for existing cards */}
        {!isNew && (
          <div className="font-body text-ohm-muted/60 mt-3 text-xs">
            Created {new Date(card.createdAt).toLocaleDateString()} &middot; Updated{' '}
            {new Date(card.updatedAt).toLocaleDateString()}
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
