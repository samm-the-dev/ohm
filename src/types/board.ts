import type { ComponentType } from 'react';
import { EnergySmall, EnergyMedium, EnergyLarge } from '../components/ui/energy-icons';

/** Named status indices — positions in the COLUMNS array */
export const STATUS = { CHARGING: 0, GROUNDED: 1, LIVE: 2, POWERED: 3 } as const;
export type ColumnStatus = (typeof STATUS)[keyof typeof STATUS];

/** Named energy indices — positions in the ENERGY_CONFIG array */
export const ENERGY = { LOW: 0, MED: 1, HIGH: 2 } as const;
export type EnergyTag = (typeof ENERGY)[keyof typeof ENERGY];

/** A single card on the board */
export interface OhmCard {
  id: string;
  title: string;
  /** Free-form notes or context about the card */
  description: string;
  status: ColumnStatus;
  /** User-managed tasks — persists across column moves */
  tasks: string[];
  /** Energy tag for filtering */
  energy: EnergyTag;
  /** Optional project/category tag */
  category: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp — last time the card was touched */
  updatedAt: string;
  /** Sort order within its column */
  sortOrder: number;
}

/** Energy segments per level -- Small=1, Medium=2, Large=3 */
export const ENERGY_SEGMENTS: readonly number[] = [1, 2, 3];

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
  /** Capacity for the Charging column (energy segments) */
  chargingCapacity: number;
  /** Capacity for the Live column (energy segments) */
  liveCapacity: number;
  /** Capacity for the Grounded column (energy segments) */
  groundedCapacity: number;
  /** ISO timestamp — last time categories were added/removed */
  categoriesUpdatedAt?: string;
  /** ISO timestamp — last time any capacity was changed */
  capacitiesUpdatedAt?: string;
  /** ISO timestamp of last save */
  lastSaved: string;
}

/** Column config — static definition, indexed by ColumnStatus */
export const COLUMNS: readonly OhmColumn[] = [
  {
    label: 'Charging',
    description: 'Captured ideas -- shape with a clear next step',
    color: 'ohm-charging',
    hex: '#f97316',
  },
  {
    label: 'Grounded',
    description: 'Defined and ready -- waiting for bandwidth',
    color: 'ohm-grounded',
    hex: '#6366f1',
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

/** Energy tag display config -- indexed by EnergyTag. Labels/icons are theme; code uses generic names. */
export const ENERGY_CONFIG: readonly { label: string; icon: ComponentType<{ size?: number }> }[] = [
  { label: 'Small', icon: EnergySmall },
  { label: 'Medium', icon: EnergyMedium },
  { label: 'Large', icon: EnergyLarge },
];

/** Energy Tailwind classes -- indexed by EnergyTag. Static strings so JIT detects them. */
export const ENERGY_CLASSES: readonly {
  text: string;
  border: string;
  dimBorder: string;
  bg: string;
}[] = [
  {
    text: 'text-ohm-energy-low',
    border: 'border-ohm-energy-low/40',
    dimBorder: 'border-ohm-energy-low/20',
    bg: 'bg-ohm-energy-low/10',
  },
  {
    text: 'text-ohm-energy-med',
    border: 'border-ohm-energy-med/40',
    dimBorder: 'border-ohm-energy-med/20',
    bg: 'bg-ohm-energy-med/10',
  },
  {
    text: 'text-ohm-energy-high',
    border: 'border-ohm-energy-high/40',
    dimBorder: 'border-ohm-energy-high/20',
    bg: 'bg-ohm-energy-high/10',
  },
];

/** Accent Tailwind classes per column status -- static strings so JIT detects them */
export const STATUS_CLASSES: readonly {
  border: string;
  ring: string;
}[] = [
  {
    border: 'border-ohm-charging/30',
    ring: 'focus-visible:ring-ohm-charging/20',
  },
  {
    border: 'border-ohm-grounded/30',
    ring: 'focus-visible:ring-ohm-grounded/20',
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

/** Valid transitions from each status */
export const VALID_TRANSITIONS: readonly (readonly ColumnStatus[])[] = [
  [STATUS.GROUNDED, STATUS.LIVE, STATUS.POWERED], // charging -> any
  [STATUS.LIVE, STATUS.POWERED], // grounded -> live, powered
  [STATUS.GROUNDED, STATUS.POWERED], // live -> grounded, powered
  [STATUS.CHARGING], // powered -> charging
];

/** Create a default empty board */
export function createDefaultBoard(): OhmBoard {
  return {
    version: 1,
    cards: [],
    categories: ['Personal', 'Creative', 'Home'],
    chargingCapacity: 12,
    liveCapacity: 6,
    groundedCapacity: 6,
    lastSaved: new Date().toISOString(),
  };
}
