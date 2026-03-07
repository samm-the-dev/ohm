import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { Activity, ActivityInstance } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import type { EnergyTag } from '../types/board';
import { ACTIVITY_STATUS } from '../types/activity';
import { generateInstances } from '../utils/schedule-utils';
import { generateId } from '../utils/board-utils';

const DEFAULT_WINDOW_SIZE = 7;

export function useActivities(windowSize = DEFAULT_WINDOW_SIZE) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [instances, setInstances] = useState<ActivityInstance[]>([]);

  const loadAll = useCallback(async () => {
    const [acts, insts] = await Promise.all([db.activities.toArray(), db.instances.toArray()]);
    setActivities(acts);
    setInstances(insts);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** Create a new activity with an optional schedule */
  const addActivity = useCallback(
    async (
      name: string,
      opts?: { description?: string; schedule?: StoredSchedule; energy?: EnergyTag },
    ): Promise<Activity> => {
      const activity: Activity = {
        id: generateId(),
        sourceId: 'ohm',
        name,
        description: opts?.description,
        schedule: opts?.schedule,
        energy: opts?.energy,
      };
      await db.activities.add(activity);
      await loadAll();
      return activity;
    },
    [loadAll],
  );

  /** Update an existing activity */
  const updateActivity = useCallback(
    async (id: string, changes: Partial<Omit<Activity, 'id'>>) => {
      await db.activities.update(id, changes);
      await loadAll();
    },
    [loadAll],
  );

  /** Delete an activity and all its instances */
  const deleteActivity = useCallback(
    async (id: string) => {
      await db.transaction('rw', db.activities, db.instances, async () => {
        await db.activities.delete(id);
        await db.instances.where('activityId').equals(id).delete();
      });
      await loadAll();
    },
    [loadAll],
  );

  /** Generate missing instances for all scheduled activities within the rolling window */
  const refreshWindow = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + windowSize - 1);

    const allActivities = await db.activities.toArray();
    const existingInstances = await db.instances.toArray();

    const newInstances: ActivityInstance[] = [];
    for (const activity of allActivities) {
      newInstances.push(...generateInstances(activity, today, windowEnd, existingInstances));
    }

    if (newInstances.length > 0) {
      await db.instances.bulkAdd(newInstances);
      await loadAll();
    }
  }, [windowSize, loadAll]);

  /** Claim an instance (move to Active/Live) */
  const claimInstance = useCallback(
    async (instanceId: string) => {
      await db.instances.update(instanceId, {
        status: ACTIVITY_STATUS.ACTIVE,
        claimedAt: new Date().toISOString(),
      });
      await loadAll();
    },
    [loadAll],
  );

  /** Complete an instance (move to Completed/Powered) */
  const completeInstance = useCallback(
    async (instanceId: string) => {
      await db.instances.update(instanceId, {
        status: ACTIVITY_STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
      });
      await loadAll();
    },
    [loadAll],
  );

  /** Skip an instance (move to Failed/Grounded) */
  const skipInstance = useCallback(
    async (instanceId: string) => {
      await db.instances.update(instanceId, {
        status: ACTIVITY_STATUS.FAILED,
      });
      await loadAll();
    },
    [loadAll],
  );

  return {
    activities,
    instances,
    addActivity,
    updateActivity,
    deleteActivity,
    refreshWindow,
    claimInstance,
    completeInstance,
    skipInstance,
  };
}
