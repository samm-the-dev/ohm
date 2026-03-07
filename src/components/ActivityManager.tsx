import { useState } from 'react';
import { Plus, Trash2, Calendar, X } from 'lucide-react';
import type { Activity } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import type { EnergyTag } from '../types/board';
import { ENERGY_CONFIG, ENERGY_CLASSES } from '../types/board';
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

interface ScheduleEditorProps {
  schedule: Partial<StoredSchedule>;
  onChange: (schedule: Partial<StoredSchedule>) => void;
}

function ScheduleEditor({ schedule, onChange }: ScheduleEditorProps) {
  const toggleDay = (day: string) => {
    const current = schedule.byDay ?? [];
    const next = current.includes(day as never)
      ? current.filter((d) => d !== day)
      : [...current, day as (typeof current)[number]];
    onChange({ ...schedule, byDay: next.length > 0 ? next : undefined });
  };

  return (
    <div className="flex flex-col gap-2">
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
      {!schedule.byDay && (
        <p className="font-body text-ohm-muted/40 text-[10px]">No days selected — runs daily</p>
      )}
    </div>
  );
}

interface ActivityFormProps {
  initial?: Activity;
  onSubmit: (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: EnergyTag },
  ) => void;
  onCancel: () => void;
}

function ActivityForm({ initial, onSubmit, onCancel }: ActivityFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [energy, setEnergy] = useState<EnergyTag | undefined>(initial?.energy);
  const [schedule, setSchedule] = useState<Partial<StoredSchedule>>(
    initial?.schedule ?? { repeatFrequency: 'P1W' },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, {
      description: description.trim() || undefined,
      schedule: {
        repeatFrequency: schedule.byDay ? 'P1W' : 'P1D',
        ...schedule,
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
        autoFocus
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
          {ENERGY_CONFIG.map((config, index) => {
            const Icon = config.icon;
            const active = energy === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setEnergy(active ? undefined : (index as EnergyTag))}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                  active ? 'bg-ohm-text/10 text-ohm-text' : 'text-ohm-muted hover:text-ohm-text'
                }`}
              >
                <span className={ENERGY_CLASSES[index]!.text}>
                  <Icon size={10} />
                </span>
                {config.label}
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
    opts?: { description?: string; schedule?: StoredSchedule; energy?: EnergyTag },
  ) => Promise<Activity>;
  onUpdate: (id: string, changes: Partial<Omit<Activity, 'id'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ActivityManager({ activities, onAdd, onUpdate, onDelete }: ActivityManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = async (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: EnergyTag },
  ) => {
    await onAdd(name, opts);
    setShowForm(false);
  };

  const handleUpdate = async (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: EnergyTag },
  ) => {
    if (!editingId) return;
    await onUpdate(editingId, { name, ...opts });
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
                  {activity.schedule?.byDay
                    ? activity.schedule.byDay.map((d) => (d as string).slice(0, 3)).join(', ')
                    : 'Daily'}
                  {activity.energy !== undefined && (
                    <span className={`ml-1.5 ${ENERGY_CLASSES[activity.energy]!.text}`}>
                      {ENERGY_CONFIG[activity.energy]!.label}
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
