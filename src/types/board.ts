/** Named status indices — positions in the COLUMNS array.
 *  Order: Grounded (deferred shelf) | Charging | Live | Powered */
export const STATUS = { GROUNDED: 0, CHARGING: 1, LIVE: 2, POWERED: 3 } as const;
export type ColumnStatus = (typeof STATUS)[keyof typeof STATUS];

/** Continuous energy scale 1-6 (value IS the weight) */
export const ENERGY_MIN = 1;
export const ENERGY_MAX = 6;
export const ENERGY_DEFAULT = 3;

/** Rolling window size limits and default */
export const WINDOW_MIN = 1;
export const WINDOW_MAX = 7;
export const WINDOW_DEFAULT = 4;

/** Default live capacity and energy budget */
export const LIVE_DEFAULT = 10;
export const BUDGET_DEFAULT = WINDOW_DEFAULT * LIVE_DEFAULT;

/** Interpolate hue from green (120) at energy 1 to red (0) at energy 6 */
export function energyColor(value: number): string {
  const ratio = Math.min(Math.max((value - ENERGY_MIN) / (ENERGY_MAX - ENERGY_MIN), 0), 1);
  const hue = 120 * (1 - ratio);
  return `hsl(${hue}, 80%, 50%)`;
}

/** A single card on the board */
export interface OhmCard {
  id: string;
  title: string;
  /** Free-form notes or context about the card */
  description: string;
  status: ColumnStatus;
  /** User-managed tasks — persists across column moves */
  tasks: string[];
  /** Energy cost 1-6 (value is the weight) */
  energy: number;
  /** Optional project/category tag */
  category: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp — last time the card was touched */
  updatedAt: string;
  /** Sort order within its column */
  sortOrder: number;
  /** ISO date -- when this card is scheduled (time features) */
  scheduledDate?: string;
  /** Links this card to a generated activity instance */
  activityInstanceId?: string;
}

/** Column definition */
export interface OhmColumn {
  label: string;
  description: string;
  color: string;
  /** Hex color for runtime use (toasts, canvas, etc.) */
  hex: string;
}

/** Full board state — what gets persisted to Google Drive */
export interface OhmBoard {
  version: 1;
  cards: OhmCard[];
  /** User-defined categories */
  categories: string[];
  /** Total energy budget across all columns for the rolling window */
  energyBudget: number;
  /** Energy limit for Live column (today's active work) */
  liveCapacity: number;
  /** ISO timestamp — last time categories were added/removed */
  categoriesUpdatedAt?: string;
  /** ISO timestamp — last time any capacity was changed */
  capacitiesUpdatedAt?: string;
  /** ISO timestamp of last save */
  lastSaved: string;
  /** Enable rolling window + schedule features */
  timeFeatures?: boolean;
  /** Rolling window size in days (default 4) */
  windowSize?: number;
  /** Auto-calculate energyBudget = windowSize * liveCapacity */
  autoBudget?: boolean;
  /** Recurring activity templates (synced via Drive) */
  activities?: import('./activity').Activity[];
  /** ISO timestamp — last time activities were changed */
  activitiesUpdatedAt?: string;
}

/** Column config — static definition, indexed by ColumnStatus.
 *  Order: Grounded (deferred shelf) | Charging → Live → Powered (active flow) */
export const COLUMNS: readonly OhmColumn[] = [
  {
    label: 'Grounded',
    description: 'Paused or deferred -- saved for later',
    color: 'ohm-grounded',
    hex: '#6366f1',
  },
  {
    label: 'Charging',
    description: 'Captured ideas -- shape with a clear next step',
    color: 'ohm-charging',
    hex: '#f97316',
  },
  {
    label: 'Live',
    description: 'Actively working on it',
    color: 'ohm-live',
    hex: '#ef4444',
  },
  {
    label: 'Powered',
    description: 'Done -- circuit complete',
    color: 'ohm-powered',
    hex: '#22c55e',
  },
];

/** Accent Tailwind classes per column status -- static strings so JIT detects them */
export const STATUS_CLASSES: readonly {
  border: string;
  ring: string;
}[] = [
  {
    border: 'border-ohm-grounded/30',
    ring: 'focus-visible:ring-ohm-grounded/20',
  },
  {
    border: 'border-ohm-charging/30',
    ring: 'focus-visible:ring-ohm-charging/20',
  },
  {
    border: 'border-ohm-live/30',
    ring: 'focus-visible:ring-ohm-live/20',
  },
  {
    border: 'border-ohm-powered/30',
    ring: 'focus-visible:ring-ohm-powered/20',
  },
];

/** Spark accent -- used for new card creation (not tied to a column status) */
export const SPARK_HEX = '#fbbf24';
export const SPARK_CLASSES = {
  border: 'border-ohm-spark/30',
  ring: 'focus-visible:ring-ohm-spark/20',
} as const;

/** Valid transitions from each status (indexed by ColumnStatus) */
export const VALID_TRANSITIONS: readonly (readonly ColumnStatus[])[] = [
  [STATUS.LIVE, STATUS.POWERED], // grounded -> live, powered
  [STATUS.GROUNDED, STATUS.LIVE, STATUS.POWERED], // charging -> any
  [STATUS.GROUNDED, STATUS.POWERED], // live -> grounded, powered
  [STATUS.CHARGING], // powered -> charging
];

/** Create a default empty board */
export function createDefaultBoard(): OhmBoard {
  return {
    version: 1,
    cards: [],
    categories: ['Personal', 'Creative', 'Home'],
    energyBudget: BUDGET_DEFAULT,
    liveCapacity: LIVE_DEFAULT,
    lastSaved: new Date().toISOString(),
  };
}
