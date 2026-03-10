import Dexie, { type EntityTable } from 'dexie';
import type { Activity, ActivityInstance, DismissedInstance } from './types/activity';

const db = new Dexie('ohm') as Dexie & {
  activities: EntityTable<Activity, 'id'>;
  instances: EntityTable<ActivityInstance, 'id'>;
  dismissedInstances: EntityTable<DismissedInstance, 'id'>;
};

db.version(1).stores({
  activities: 'id, sourceId, *schedule.byDay',
  instances: 'id, activityId, scheduledDate, status, [activityId+scheduledDate]',
});

db.version(2).stores({
  activities: 'id, sourceId, *schedule.byDay',
  instances: 'id, activityId, scheduledDate, status, [activityId+scheduledDate]',
  dismissedInstances: 'id, activityId, scheduledDate',
});

export { db };
