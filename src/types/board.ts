/** Named status indices — positions in the COLUMNS array.
 *  Order: Grounded (deferred shelf) | Charging | Live | Powered */
export const STATUS = { GROUNDED: 0, CHARGING: 1, LIVE: 2, POWERED: 3 } as const;
export type ColumnStatus = (typeof STATUS)[keyof typeof STATUS];

/** Continuous energy scale — default range 1-7 (value IS the weight).
 *  Boards can override the ceiling via energyMax. */
export const ENERGY_MIN = 1;
export const ENERGY_MAX_DEFAULT = 7;
export const ENERGY_DEFAULT = 4;

/** Rolling window size limits and default */
export const WINDOW_MIN = 1;
export const WINDOW_MAX = 7;
export const WINDOW_DEFAULT = 4;

/** Default live capacity and energy budget */
export const LIVE_DEFAULT = 10;
export const BUDGET_DEFAULT = WINDOW_DEFAULT * LIVE_DEFAULT;

/** Interpolate hue from indigo (239) at ENERGY_MIN through green (~120) to red (0) at max.
 *  Saturation and lightness ease so the cool end is softer and the warm end pops.
 *  Pass `max` to override ENERGY_MAX_DEFAULT (for boards with configurable energy scale). */
export function energyColor(value: number, alpha?: number, max?: number): string {
  const effectiveMax = max ?? ENERGY_MAX_DEFAULT;
  const ratio = Math.min(Math.max((value - ENERGY_MIN) / (effectiveMax - ENERGY_MIN), 0), 1);
  const hue = 239 * (1 - ratio);
  const saturation = 55 + 25 * ratio; // 55% at cool end → 80% at hot end
  const lightness = 60 - 10 * ratio; // 60% at cool end → 50% at hot end
  if (alpha !== undefined) return `hsl(${hue} ${saturation}% ${lightness}% / ${alpha})`;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Budget/capacity meter color — cooler gradient that caps at yellow-orange at 100%.
 *  Over-budget (ratio > 1) smoothly transitions into red.
 *  ratio: 0 (empty) → 1 (at budget) → 2+ (over budget). */
export function budgetColor(ratio: number, alpha?: number): string {
  const clamped = Math.max(ratio, 0);
  // 0 → indigo (239°), 1 → yellow-orange (45°), >1 → red (0°)
  let hue: number;
  if (clamped <= 1) {
    hue = 239 - clamped * (239 - 45);
  } else {
    hue = Math.max(0, 45 - (clamped - 1) * 45);
  }
  const t = Math.min(clamped, 1);
  const saturation = 55 + 25 * t; // 55% at cool end → 80% at warm end
  const lightness = 60 - 10 * t; // 60% at cool end → 50% at warm end
  if (alpha !== undefined) return `hsl(${hue} ${saturation}% ${lightness}% / ${alpha})`;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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
  /** Maximum energy per task (default ENERGY_MAX_DEFAULT). User-configurable scale ceiling. */
  energyMax?: number;
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
