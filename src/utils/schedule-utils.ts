import type { DayOfWeek } from 'schema-dts';
import type { StoredSchedule } from '../types/schedule';
import type { Activity, ActivityInstance } from '../types/activity';
import { ACTIVITY_STATUS } from '../types/activity';
import { generateId } from './board-utils';

/** Map JS Date.getDay() (0=Sun) to schema.org DayOfWeek short names */
const DAY_NAMES: readonly DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Format a Date as an ISO date string (YYYY-MM-DD) */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Check if a date matches a schedule's recurrence pattern */
export function matchesSchedule(date: Date, schedule: StoredSchedule): boolean {
  if (schedule.startDate && toISODate(date) < schedule.startDate) return false;
  if (schedule.endDate && toISODate(date) > schedule.endDate) return false;
  if (schedule.byDay) {
    if (!schedule.byDay.includes(DAY_NAMES[date.getDay()]!)) return false;
  } else if (schedule.repeatFrequency === 'P1W') {
    // Weekly with no days specified — nothing can match
    return false;
  }
  if (schedule.byMonth && !schedule.byMonth.includes(date.getMonth() + 1)) return false;
  if (schedule.byMonthDay && !schedule.byMonthDay.includes(date.getDate())) return false;
  return true;
}

/**
 * Generate activity instances for a date window.
 * Skips dates that are excepted or already have an existing instance.
 */
export function generateInstances(
  activity: Activity,
  windowStart: Date,
  windowEnd: Date,
  existingInstances: ActivityInstance[],
): ActivityInstance[] {
  const schedule = activity.schedule;
  if (!schedule) return [];

  const existingDates = new Set(
    existingInstances.filter((i) => i.activityId === activity.id).map((i) => i.scheduledDate),
  );

  const exceptDates = new Set(schedule.exceptDate ?? []);
  const newInstances: ActivityInstance[] = [];
  const current = new Date(windowStart);

  while (current <= windowEnd) {
    const dateStr = toISODate(current);

    if (
      matchesSchedule(current, schedule) &&
      !exceptDates.has(dateStr) &&
      !existingDates.has(dateStr)
    ) {
      newInstances.push({
        id: generateId(),
        activityId: activity.id,
        scheduledDate: dateStr,
        status: ACTIVITY_STATUS.POTENTIAL,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return newInstances;
}
