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

/** Get the ordinal position of a weekday within its month (1-based).
 *  E.g. the 2nd Tuesday → position 2. Also returns negative position from end (-1 = last). */
function weekdayPositionInMonth(date: Date): { pos: number; negPos: number } {
  const day = date.getDate();
  const pos = Math.ceil(day / 7);

  // Negative position: how many of this weekday remain (including this one)?
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const remaining = Math.floor((daysInMonth - day) / 7);
  const negPos = -(remaining + 1);

  return { pos, negPos };
}

/** Check if a date's day-of-month matches a byMonthDay list.
 *  Supports -1 as "last day of the month". */
function matchesByMonthDay(date: Date, byMonthDay: number[]): boolean {
  const day = date.getDate();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return byMonthDay.some((d) => (d === -1 ? day === lastDay : d === day));
}

/** Check if a date matches a schedule's recurrence pattern */
export function matchesSchedule(date: Date, schedule: StoredSchedule): boolean {
  if (schedule.startDate && toISODate(date) < schedule.startDate) return false;
  if (schedule.endDate && toISODate(date) > schedule.endDate) return false;

  if (schedule.repeatFrequency === 'P1W') {
    // Weekly: must have byDay, and date must fall on one of those days
    if (!schedule.byDay || !schedule.byDay.includes(DAY_NAMES[date.getDay()]!)) return false;
  } else if (schedule.repeatFrequency === 'P1M') {
    if (schedule.bySetPos && schedule.byDay) {
      // Ordinal weekday: e.g. "2nd Tuesday", "last Friday"
      if (!schedule.byDay.includes(DAY_NAMES[date.getDay()]!)) return false;
      const { pos, negPos } = weekdayPositionInMonth(date);
      if (!schedule.bySetPos.some((p) => p === pos || p === negPos)) return false;
    } else if (schedule.byMonthDay) {
      if (!matchesByMonthDay(date, schedule.byMonthDay)) return false;
    } else {
      return false; // Monthly with no day spec matches nothing
    }
  }
  // P1D (daily): matches every day (no day/monthDay filter needed)

  // Non-monthly generic filters (byDay for daily, byMonth for any)
  if (schedule.repeatFrequency !== 'P1M' && schedule.byDay) {
    if (!schedule.byDay.includes(DAY_NAMES[date.getDay()]!)) return false;
  }
  if (schedule.byMonth && !schedule.byMonth.includes(date.getMonth() + 1)) return false;
  if (
    schedule.repeatFrequency !== 'P1M' &&
    schedule.byMonthDay &&
    !matchesByMonthDay(date, schedule.byMonthDay)
  )
    return false;
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
  dismissedDates?: Set<string>,
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
      !existingDates.has(dateStr) &&
      !dismissedDates?.has(`${activity.id}:${dateStr}`)
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
