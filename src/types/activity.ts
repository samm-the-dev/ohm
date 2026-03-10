import type { ActionStatusType } from 'schema-dts';
import type { StoredSchedule } from './schedule';

/** Activity instance lifecycle -- aligned with schema.org actionStatus */
export const ACTIVITY_STATUS = {
  POTENTIAL: 'PotentialActionStatus',
  ACTIVE: 'ActiveActionStatus',
  COMPLETED: 'CompletedActionStatus',
  FAILED: 'FailedActionStatus',
} as const satisfies Record<string, ActionStatusType>;

export type ActivityStatus = (typeof ACTIVITY_STATUS)[keyof typeof ACTIVITY_STATUS];

/** Template for a recurring activity */
export interface Activity {
  /** GUID */
  id: string;
  /** "ohm" for native, companion appId, or "connector:<name>" */
  sourceId: string;
  name: string;
  description?: string;
  schedule?: StoredSchedule;
  /** ohm-specific: energy cost of this activity */
  energy?: number;
  /** ohm-specific: category label */
  category?: string;
  /** App-defined metadata */
  meta?: Record<string, unknown>;
}

/** Single occurrence of an activity */
export interface ActivityInstance {
  /** GUID */
  id: string;
  /** FK to Activity */
  activityId: string;
  /** ISO date of this occurrence */
  scheduledDate: string;
  status: ActivityStatus;
  /** ISO timestamp -- when moved to Live */
  claimedAt?: string;
  /** ISO timestamp -- when moved to Powered */
  completedAt?: string;
  /** Instance-specific metadata */
  meta?: Record<string, unknown>;
  consumedBy?: ConsumptionRecord[];
}

/** Record of a dismissed recurring instance (soft delete) */
export interface DismissedInstance {
  /** Compound key: `${activityId}:${scheduledDate}` */
  id: string;
  activityId: string;
  /** ISO date */
  scheduledDate: string;
  /** ISO timestamp */
  dismissedAt: string;
}

/** Tracks which apps have consumed an activity instance */
export interface ConsumptionRecord {
  appId: string;
  /** ISO timestamp */
  consumedAt: string;
}
