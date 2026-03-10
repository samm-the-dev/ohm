import { useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import type { Activity } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import { ENERGY_MIN, ENERGY_MAX, energyColor } from '../types/board';
import { EnergyIcon } from './ui/energy-icons';
import { Button } from './ui/button';
import { Input } from './ui/input';

const DAY_OPTIONS = [
  { label: 'Sun', value: 'Sunday' },
  { label: 'Mon', value: 'Monday' },
  { label: 'Tue', value: 'Tuesday' },
  { label: 'Wed', value: 'Wednesday' },
  { label: 'Thu', value: 'Thursday' },
  { label: 'Fri', value: 'Friday' },
  { label: 'Sat', value: 'Saturday' },
] as const;

const ORDINAL_OPTIONS = [
  { label: '1st', value: 1 },
  { label: '2nd', value: 2 },
  { label: '3rd', value: 3 },
  { label: '4th', value: 4 },
  { label: '5th', value: 5 },
  { label: 'Last', value: -1 },
] as const;

const ORDINAL_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
  4: '4th',
  5: '5th',
  [-1]: 'Last',
};

const FREQ_OPTIONS = [
  { label: 'Daily', value: 'P1D' },
  { label: 'Weekly', value: 'P1W' },
  { label: 'Monthly', value: 'P1M' },
] as const;

interface ScheduleEditorProps {
  schedule: Partial<StoredSchedule>;
  onChange: (schedule: Partial<StoredSchedule>) => void;
}

type MonthlyMode = 'days' | 'ordinal';

/** Keyword aliases for byMonthDay values */
const DAY_KEYWORDS: Record<string, number> = { first: 1, last: -1 };

/** Parse a single token into day numbers. Supports:
 *  - Keywords: "first" (→ 1), "last" (→ -1)
 *  - Integers: "1"–"31"
 *  - Ranges: "10-15", "20-last" (expands to all days in range; "last" → 31 + -1 sentinel) */
function parseToken(token: string): number[] {
  const trimmed = token.trim().toLowerCase();
  if (trimmed in DAY_KEYWORDS) return [DAY_KEYWORDS[trimmed]!];

  const rangeMatch = trimmed.match(/^(\w+)-(\w+)$/);
  if (rangeMatch) {
    const startRaw = rangeMatch[1]!.toLowerCase();
    const endRaw = rangeMatch[2]!.toLowerCase();

    const start = startRaw in DAY_KEYWORDS ? 1 : parseInt(startRaw, 10);
    const endIsLast = endRaw === 'last';
    const end = endIsLast ? 31 : endRaw in DAY_KEYWORDS ? 1 : parseInt(endRaw, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end > 31 || start > end) return [];

    const days = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    if (endIsLast) days.push(-1); // -1 sentinel for dynamic last day
    return days;
  }

  const n = parseInt(trimmed, 10);
  return !isNaN(n) && n >= 1 && n <= 31 ? [n] : [];
}

/** Parse a comma-separated string of day numbers, keywords, or ranges into sorted unique ints.
 *  Examples: "1, 15", "first, last", "10-15", "1, 10-15, last" */
export function parseDayInput(input: string): number[] | undefined {
  const days = input.split(',').flatMap(parseToken);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : undefined;
}

function ScheduleEditor({ schedule, onChange }: ScheduleEditorProps) {
  const freq = schedule.repeatFrequency ?? 'P1D';

  // Infer monthly mode from existing data
  const inferredMode: MonthlyMode = schedule.bySetPos ? 'ordinal' : 'days';
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>(inferredMode);
  const [dayInput, setDayInput] = useState(
    schedule.byMonthDay?.map((d) => (d === -1 ? 'last' : d)).join(', ') ?? '',
  );

  const setFreq = (value: string) => {
    const next: Partial<StoredSchedule> = { ...schedule, repeatFrequency: value };
    // Clear irrelevant fields when switching frequency
    if (value !== 'P1W' && value !== 'P1M') delete next.byDay;
    if (value !== 'P1M') {
      delete next.byMonthDay;
      delete next.bySetPos;
    }
    onChange(next);
  };

  const toggleDay = (day: string) => {
    const current = schedule.byDay ?? [];
    const next = current.includes(day as never)
      ? current.filter((d) => d !== day)
      : [...current, day as (typeof current)[number]];
    onChange({ ...schedule, byDay: next.length > 0 ? next : undefined });
  };

  const switchMonthlyMode = (mode: MonthlyMode) => {
    setMonthlyMode(mode);
    // Clear the other mode's fields
    if (mode === 'days') {
      const next = { ...schedule };
      delete next.byDay;
      delete next.bySetPos;
      onChange(next);
    } else {
      const next = { ...schedule };
      delete next.byMonthDay;
      setDayInput('');
      onChange(next);
    }
  };

  const handleDayInputChange = (value: string) => {
    setDayInput(value);
    const days = parseDayInput(value);
    onChange({ ...schedule, byMonthDay: days });
  };

  const dayInputInvalid = dayInput.trim().length > 0 && !parseDayInput(dayInput);

  const toggleSetPos = (pos: number) => {
    const current = schedule.bySetPos ?? [];
    const next = current.includes(pos) ? current.filter((p) => p !== pos) : [...current, pos];
    onChange({ ...schedule, bySetPos: next.length > 0 ? next : undefined });
  };

  const chipClass = (active: boolean) =>
    `font-body rounded-full px-2 py-0.5 text-[10px] transition-colors ${
      active
        ? 'bg-ohm-spark/20 text-ohm-spark'
        : 'bg-ohm-border/50 text-ohm-muted hover:text-ohm-text'
    }`;

  return (
    <div className="flex flex-col gap-2">
      {/* Frequency selector */}
      <div className="flex gap-1">
        {FREQ_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFreq(value)}
            className={chipClass(freq === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Weekly: day-of-week picker */}
      {freq === 'P1W' && (
        <div className="flex flex-wrap gap-1">
          {DAY_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleDay(value)}
              className={chipClass(!!schedule.byDay?.includes(value as never))}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Monthly: mode tabs + inputs */}
      {freq === 'P1M' && (
        <div className="flex flex-col gap-2">
          {/* Mode tabs */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => switchMonthlyMode('days')}
              className={chipClass(monthlyMode === 'days')}
            >
              By date
            </button>
            <button
              type="button"
              onClick={() => switchMonthlyMode('ordinal')}
              className={chipClass(monthlyMode === 'ordinal')}
            >
              By weekday
            </button>
          </div>

          {monthlyMode === 'days' ? (
            <div className="flex flex-col gap-1">
              <Input
                value={dayInput}
                onChange={(e) => handleDayInputChange(e.target.value)}
                placeholder="e.g. 1, 15, 10-20, first, last"
                aria-label="Days of month"
                aria-invalid={dayInputInvalid || undefined}
                className={`bg-ohm-bg font-body text-ohm-text placeholder:text-ohm-muted/40 px-3 py-1.5 text-sm focus-visible:ring-offset-0 ${
                  dayInputInvalid
                    ? 'border-ohm-live focus-visible:ring-ohm-live/20'
                    : 'border-ohm-border focus-visible:ring-ohm-spark/20'
                }`}
              />
              {dayInputInvalid && (
                <p className="font-body text-ohm-live text-[10px]">
                  Use day numbers (1-31), ranges (10-20), or keywords (first, last)
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* Ordinal position */}
              <div className="flex flex-wrap gap-1">
                {ORDINAL_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSetPos(value)}
                    className={chipClass(!!schedule.bySetPos?.includes(value))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Day of week */}
              <div className="flex flex-wrap gap-1">
                {DAY_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={chipClass(!!schedule.byDay?.includes(value as never))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityFormProps {
  initial?: Activity;
  categories?: string[];
  onSubmit: (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: number; category?: string },
  ) => void;
  onCancel: () => void;
}

function ActivityForm({ initial, categories, onSubmit, onCancel }: ActivityFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [energy, setEnergy] = useState<number | undefined>(initial?.energy);
  const [category, setCategory] = useState(initial?.category ?? '');
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
      category: category || undefined,
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

      {/* Category */}
      {categories && categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-ohm-muted text-[10px] tracking-widest uppercase">
            Category
          </span>
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(active ? '' : cat)}
                className={`font-body rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                  active ? 'bg-ohm-text/10 text-ohm-text' : 'text-ohm-muted hover:text-ohm-text'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

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
  categories?: string[];
  onAdd: (
    name: string,
    opts?: { description?: string; schedule?: StoredSchedule; energy?: number; category?: string },
  ) => Activity;
  onUpdate: (id: string, changes: Partial<Omit<Activity, 'id'>>) => void;
  onDelete: (id: string) => void | Promise<void>;
}

export function ActivityManager({
  activities,
  categories,
  onAdd,
  onUpdate,
  onDelete,
}: ActivityManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: number; category?: string },
  ) => {
    onAdd(name, opts);
    setShowForm(false);
  };

  const handleUpdate = (
    name: string,
    opts: { description?: string; schedule?: StoredSchedule; energy?: number; category?: string },
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
              categories={categories}
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
                    ? activity.schedule.bySetPos && activity.schedule.byDay
                      ? `${activity.schedule.bySetPos.map((p) => ORDINAL_LABELS[p] ?? `${p}th`).join(', ')} ${activity.schedule.byDay.map((d) => (d as string).slice(0, 3)).join(', ')}`
                      : `Monthly: ${activity.schedule.byMonthDay?.map((d) => (d === -1 ? 'last' : d)).join(', ') ?? '?'}`
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
          <ActivityForm
            categories={categories}
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}
