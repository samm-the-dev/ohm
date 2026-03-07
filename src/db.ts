import Dexie, { type EntityTable } from 'dexie';
import type { Activity, ActivityInstance } from './types/activity';

const db = new Dexie('ohm') as Dexie & {
  activities: EntityTable<Activity, 'id'>;
  instances: EntityTable<ActivityInstance, 'id'>;
};

db.version(1).stores({
  activities: 'id, sourceId, *schedule.byDay',
  instances: 'id, activityId, scheduledDate, status, [activityId+scheduledDate]',
});

export { db };
