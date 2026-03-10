import { useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import type { Activity } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import { ENERGY_MIN, ENERGY_MAX, energyColor } from '../types/board';
import { EnergyIcon } from './ui/energy-icons';
import { Button } from './ui/button';
import { Input } from './ui/input';

const DAY_OPTIONS = [
  { label: 'Mon', value: 'Monday' },
  { label: 'Tue', value: 'Tuesday' },
  { label: 'Wed', value: 'Wednesday' },
  { label: 'Thu', value: 'Thursday' },
  { label: 'Fri', value: 'Friday' },
  { label: 'Sat', value: 'Saturday' },
  { label: 'Sun', value: 'Sunday' },
] as const;

const FREQ_OPTIONS = [
  { label: 'Daily', value: 'P1D' },
  { label: 'Weekly', value: 'P1W' },
  { label: 'Monthly', value: 'P1M' },
] as const;

interface ScheduleEditorProps {
  schedule: Partial<StoredSchedule>;
  onChange: (schedule: Partial<StoredSchedule>) => void;
}

function ScheduleEditor({ schedule, onChange }: ScheduleEditorProps) {
  const freq = schedule.repeatFrequency ?? 'P1D';

  const setFreq = (value: string) => {
    const next: Partial<StoredSchedule> = { ...schedule, repeatFrequency: value };
    // Clear irrelevant fields when switching frequency
    if (value !== 'P1W') delete next.byDay;
    if (value !== 'P1M') delete next.byMonthDay;
    onChange(next);
  };

  const toggleDay = (day: string) => {
    const current = schedule.byDay ?? [];
    const next = current.includes(day as never)
      ? current.filter((d) => d !== day)
      : [...current, day as (typeof current)[number]];
    onChange({ ...schedule, byDay: next.length > 0 ? next : undefined });
  };

  const toggleMonthDay = (day: number) => {
    const current = schedule.byMonthDay ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    onChange({ ...schedule, byMonthDay: next.length > 0 ? next : undefined });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Frequency selector */}
      <div className="flex gap-1">
        {FREQ_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFreq(value)}
            className={`font-body rounded-full px-2 py-0.5 text-[10px] transition-colors ${
              freq === value
                ? 'bg-ohm-spark/20 text-ohm-spark'
                : 'bg-ohm-border/50 text-ohm-muted hover:text-ohm-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Weekly: day-of-week picker */}
      {freq === 'P1W' && (
        <div className="flex flex-wrap gap-1">
          {DAY_OPTIONS.map(({ label, value }) => {
            const active = schedule.byDay?.includes(value as never);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`font-body rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                  active
                    ? 'bg-ohm-spark/20 text-ohm-spark'
                    : 'bg-ohm-border/50 text-ohm-muted hover:text-ohm-text'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Monthly: day-of-month picker */}
      {freq === 'P1M' && (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 31 }, (_, i) => {
            const day = i + 1;
            const active = schedule.byMonthDay?.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleMonthDay(day)}
                className={`font-body rounded-full px-1.5 py-0.5 text-[10px] tabular-nums transition-colors ${
                  active
                    ? 'bg-ohm-spark/20 text-ohm-spark'
                    : 'bg-ohm-border/50 text-ohm-muted hover:text-ohm-text'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ActivityFormProps {
  initial?: Activity;
  onSubmit: (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: number },
  ) => void;
  onCancel: () => void;
}

function ActivityForm({ initial, onSubmit, onCancel }: ActivityFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [energy, setEnergy] = useState<number | undefined>(initial?.energy);
  const [schedule, setSchedule] = useState<Partial<StoredSchedule>>(
    initial?.schedule ?? { repeatFrequency: 'P1D' },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, {
      description: description.trim() || undefined,
      schedule: {
        ...schedule,
        repeatFrequency: schedule.repeatFrequency ?? 'P1D',
      } as StoredSchedule,
      energy,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Activity name..."
        aria-label="Activity name"
        className="border-ohm-border bg-ohm-bg font-body text-ohm-text placeholder:text-ohm-muted/40 focus-visible:ring-ohm-spark/20 px-3 py-1.5 text-sm focus-visible:ring-offset-0"
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        aria-label="Activity description"
        className="border-ohm-border bg-ohm-bg font-body text-ohm-text placeholder:text-ohm-muted/40 focus-visible:ring-ohm-spark/20 px-3 py-1.5 text-sm focus-visible:ring-offset-0"
      />

      {/* Energy */}
      <div className="flex items-center gap-2">
        <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
          Energy
        </span>
        <div className="flex gap-1">
          {Array.from({ length: ENERGY_MAX - ENERGY_MIN + 1 }, (_, i) => {
            const value = ENERGY_MIN + i;
            const active = energy === value;
            const color = energyColor(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => setEnergy(active ? undefined : value)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                  active ? 'bg-current/10' : 'text-ohm-muted hover:text-ohm-text'
                }`}
                style={active ? { color } : undefined}
              >
                <EnergyIcon size={10} value={value} />
                {value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule */}
      <div>
        <span className="font-display text-ohm-muted mb-1.5 block text-[10px] tracking-widest uppercase">
          Repeat on
        </span>
        <ScheduleEditor schedule={schedule} onChange={setSchedule} />
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!name.trim()}
          className="bg-ohm-spark/20 font-display text-ohm-spark hover:bg-ohm-spark/30 active:bg-ohm-spark/40 flex-1 text-xs tracking-wider uppercase"
        >
          {initial ? 'Save' : 'Add'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-ohm-border text-ohm-muted hover:text-ohm-text text-xs"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface ActivityManagerProps {
  activities: Activity[];
  onAdd: (
    name: string,
    opts?: { description?: string; schedule?: StoredSchedule; energy?: number },
  ) => Activity;
  onUpdate: (id: string, changes: Partial<Omit<Activity, 'id'>>) => void;
  onDelete: (id: string) => void | Promise<void>;
}

export function ActivityManager({ activities, onAdd, onUpdate, onDelete }: ActivityManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: number },
  ) => {
    onAdd(name, opts);
    setShowForm(false);
  };

  const handleUpdate = (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: number },
  ) => {
    if (!editingId) return;
    onUpdate(editingId, { name, ...opts });
    setEditingId(null);
  };

  return (
    <div className="border-ohm-border mt-5 border-t pt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-ohm-muted" />
          <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
            Activities
          </span>
        </div>
        {!showForm && !editingId && (
          <Button
            variant="outline"
            onClick={() => setShowForm(true)}
            className="border-ohm-border text-ohm-muted hover:text-ohm-text h-6 gap-1 px-2 text-[10px]"
          >
            <Plus size={10} />
            Add
          </Button>
        )}
      </div>

      {/* Activity list */}
      {activities.length === 0 && !showForm && (
        <p className="font-body text-ohm-muted/60 text-[11px]">
          No activities yet. Add one to get started.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {activities.map((activity) =>
          editingId === activity.id ? (
            <ActivityForm
              key={activity.id}
              initial={activity}
              onSubmit={handleUpdate}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={activity.id}
              className="border-ohm-border bg-ohm-bg flex items-center justify-between rounded-md border px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => setEditingId(activity.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="font-body text-ohm-text block truncate text-xs">
                  {activity.name}
                </span>
                <span className="font-body text-ohm-muted/60 text-[10px]">
                  {activity.schedule?.repeatFrequency === 'P1M'
                    ? `Monthly: ${activity.schedule.byMonthDay?.join(', ') ?? '?'}`
                    : activity.schedule?.byDay
                      ? activity.schedule.byDay.map((d) => (d as string).slice(0, 3)).join(', ')
                      : 'Daily'}
                  {activity.energy !== undefined && (
                    <span className="ml-1.5" style={{ color: energyColor(activity.energy) }}>
                      {activity.energy}
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void onDelete(activity.id)}
                className="text-ohm-muted hover:text-ohm-live ml-2 shrink-0 rounded-sm p-1 transition-colors"
                aria-label={`Delete ${activity.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ),
        )}
      </div>

      {/* New activity form */}
      {showForm && (
        <div className="mt-2">
          <ActivityForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
        </div>
      )}
    </div>
  );
}
