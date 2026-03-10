import type { DayOfWeek } from 'schema-dts';

/**
 * Narrowed schedule type for Dexie storage.
 * Mirrors schema.org ScheduleBase field names with simplified types
 * (no SchemaValue wrappers, no Role unions).
 */
export interface StoredSchedule {
  /** ISO 8601 duration: "P1W" (weekly), "P1D" (daily) */
  repeatFrequency: string;
  /** Days of the week: "Monday", "Wednesday", "Friday" */
  byDay?: DayOfWeek[];
  /** Months of the year (1-12) */
  byMonth?: number[];
  /** Days of the month (1-31) */
  byMonthDay?: number[];
  /** ISO date -- when recurrence begins */
  startDate?: string;
  /** ISO date -- when recurrence ends (undefined = ongoing) */
  endDate?: string;
  /** Time of day in "HH:mm" format */
  startTime?: string;
  /** ISO 8601 duration: "PT90M" (90 minutes) */
  duration?: string;
  /** ISO dates where recurrence is skipped */
  exceptDate?: string[];
  /** IANA timezone: "America/Chicago" */
  scheduleTimezone?: string;
}
