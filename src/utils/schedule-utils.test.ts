import { describe, it, expect } from 'vitest';
import type { StoredSchedule } from '../types/schedule';
import type { Activity, ActivityInstance } from '../types/activity';
import { ACTIVITY_STATUS } from '../types/activity';
import { matchesSchedule, generateInstances, toISODate } from './schedule-utils';

function makeSchedule(overrides: Partial<StoredSchedule> = {}): StoredSchedule {
  return { repeatFrequency: 'P1D', ...overrides };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    sourceId: 'ohm',
    name: 'Test activity',
    ...overrides,
  };
}

describe('toISODate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('matchesSchedule', () => {
  it('matches when no constraints are set', () => {
    const schedule = makeSchedule();
    expect(matchesSchedule(new Date(2026, 2, 7), schedule)).toBe(true);
  });

  it('rejects all days for P1W with no byDay', () => {
    const schedule = makeSchedule({ repeatFrequency: 'P1W' });
    expect(matchesSchedule(new Date(2026, 2, 9), schedule)).toBe(false);
    expect(matchesSchedule(new Date(2026, 2, 10), schedule)).toBe(false);
  });

  it('filters by byDay', () => {
    const schedule = makeSchedule({ byDay: ['Monday', 'Wednesday', 'Friday'] });
    // 2026-03-09 is a Monday
    expect(matchesSchedule(new Date(2026, 2, 9), schedule)).toBe(true);
    // 2026-03-10 is a Tuesday
    expect(matchesSchedule(new Date(2026, 2, 10), schedule)).toBe(false);
    // 2026-03-11 is a Wednesday
    expect(matchesSchedule(new Date(2026, 2, 11), schedule)).toBe(true);
  });

  it('filters by byMonth', () => {
    const schedule = makeSchedule({ byMonth: [1, 6] });
    expect(matchesSchedule(new Date(2026, 0, 15), schedule)).toBe(true); // Jan
    expect(matchesSchedule(new Date(2026, 5, 15), schedule)).toBe(true); // Jun
    expect(matchesSchedule(new Date(2026, 2, 15), schedule)).toBe(false); // Mar
  });

  it('filters by byMonthDay', () => {
    const schedule = makeSchedule({ byMonthDay: [1, 15] });
    expect(matchesSchedule(new Date(2026, 2, 1), schedule)).toBe(true);
    expect(matchesSchedule(new Date(2026, 2, 15), schedule)).toBe(true);
    expect(matchesSchedule(new Date(2026, 2, 7), schedule)).toBe(false);
  });

  it('respects startDate', () => {
    const schedule = makeSchedule({ startDate: '2026-03-10' });
    expect(matchesSchedule(new Date(2026, 2, 9), schedule)).toBe(false);
    expect(matchesSchedule(new Date(2026, 2, 10), schedule)).toBe(true);
  });

  it('respects endDate', () => {
    const schedule = makeSchedule({ endDate: '2026-03-10' });
    expect(matchesSchedule(new Date(2026, 2, 10), schedule)).toBe(true);
    expect(matchesSchedule(new Date(2026, 2, 11), schedule)).toBe(false);
  });

  it('combines multiple constraints', () => {
    const schedule = makeSchedule({
      byDay: ['Monday'],
      byMonth: [3], // March
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
    // 2026-03-09 is Monday in March
    expect(matchesSchedule(new Date(2026, 2, 9), schedule)).toBe(true);
    // 2026-03-10 is Tuesday in March
    expect(matchesSchedule(new Date(2026, 2, 10), schedule)).toBe(false);
    // 2026-04-06 is Monday but April
    expect(matchesSchedule(new Date(2026, 3, 6), schedule)).toBe(false);
  });
});

describe('generateInstances', () => {
  it('generates instances for matching days in window', () => {
    const activity = makeActivity({
      schedule: makeSchedule({ byDay: ['Monday', 'Wednesday', 'Friday'] }),
    });
    // 2026-03-09 (Mon) through 2026-03-15 (Sun)
    const instances = generateInstances(activity, new Date(2026, 2, 9), new Date(2026, 2, 15), []);
    expect(instances.map((i) => i.scheduledDate)).toEqual([
      '2026-03-09',
      '2026-03-11',
      '2026-03-13',
    ]);
    expect(instances[0].activityId).toBe('act-1');
    expect(instances[0].status).toBe(ACTIVITY_STATUS.POTENTIAL);
  });

  it('skips excepted dates', () => {
    const activity = makeActivity({
      schedule: makeSchedule({
        byDay: ['Monday', 'Wednesday', 'Friday'],
        exceptDate: ['2026-03-11'],
      }),
    });
    const instances = generateInstances(activity, new Date(2026, 2, 9), new Date(2026, 2, 15), []);
    expect(instances.map((i) => i.scheduledDate)).toEqual(['2026-03-09', '2026-03-13']);
  });

  it('skips dates with existing instances', () => {
    const activity = makeActivity({
      schedule: makeSchedule({ byDay: ['Monday', 'Wednesday', 'Friday'] }),
    });
    const existing: ActivityInstance[] = [
      {
        id: 'existing-1',
        activityId: 'act-1',
        scheduledDate: '2026-03-09',
        status: ACTIVITY_STATUS.COMPLETED,
      },
    ];
    const instances = generateInstances(
      activity,
      new Date(2026, 2, 9),
      new Date(2026, 2, 15),
      existing,
    );
    expect(instances.map((i) => i.scheduledDate)).toEqual(['2026-03-11', '2026-03-13']);
  });

  it('returns empty array when activity has no schedule', () => {
    const activity = makeActivity({ schedule: undefined });
    const instances = generateInstances(activity, new Date(2026, 2, 9), new Date(2026, 2, 15), []);
    expect(instances).toEqual([]);
  });

  it('generates daily instances', () => {
    const activity = makeActivity({
      schedule: makeSchedule({ repeatFrequency: 'P1D' }),
    });
    const instances = generateInstances(activity, new Date(2026, 2, 9), new Date(2026, 2, 11), []);
    expect(instances).toHaveLength(3);
    expect(instances.map((i) => i.scheduledDate)).toEqual([
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
    ]);
  });

  it('respects schedule startDate within the window', () => {
    const activity = makeActivity({
      schedule: makeSchedule({
        repeatFrequency: 'P1D',
        startDate: '2026-03-10',
      }),
    });
    const instances = generateInstances(activity, new Date(2026, 2, 9), new Date(2026, 2, 11), []);
    expect(instances.map((i) => i.scheduledDate)).toEqual(['2026-03-10', '2026-03-11']);
  });

  it('each instance gets a unique id', () => {
    const activity = makeActivity({
      schedule: makeSchedule({ repeatFrequency: 'P1D' }),
    });
    const instances = generateInstances(activity, new Date(2026, 2, 9), new Date(2026, 2, 11), []);
    const ids = new Set(instances.map((i) => i.id));
    expect(ids.size).toBe(3);
  });

  it('ignores existing instances for other activities', () => {
    const activity = makeActivity({
      schedule: makeSchedule({ byDay: ['Monday'] }),
    });
    const existing: ActivityInstance[] = [
      {
        id: 'other-1',
        activityId: 'other-activity',
        scheduledDate: '2026-03-09',
        status: ACTIVITY_STATUS.POTENTIAL,
      },
    ];
    const instances = generateInstances(
      activity,
      new Date(2026, 2, 9),
      new Date(2026, 2, 15),
      existing,
    );
    expect(instances.map((i) => i.scheduledDate)).toEqual(['2026-03-09']);
  });
});
