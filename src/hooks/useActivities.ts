import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../db';
import type { Activity, ActivityInstance, ActivityStatus } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import { ACTIVITY_STATUS } from '../types/activity';
import { generateInstances, toISODate } from '../utils/schedule-utils';
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
      opts?: { description?: string; schedule?: StoredSchedule; energy?: number },
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

  // Prevent concurrent refreshWindow calls (React strict mode runs effects twice)
  const refreshingRef = useRef(false);

  /** Generate missing instances for all scheduled activities within the rolling window,
   *  and demote expired Potential instances to Failed. */
  const refreshWindow = useCallback(async () => {
    if (refreshingRef.current) return [];
    refreshingRef.current = true;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = toISODate(today);
      const windowEnd = new Date(today);
      windowEnd.setDate(windowEnd.getDate() + windowSize - 1);

      const allActivities = await db.activities.toArray();
      const existingInstances = await db.instances.toArray();

      // Deduplicate: remove duplicate instances per [activityId, scheduledDate]
      const seen = new Map<string, string>(); // key → first instance id
      const dupeIds: string[] = [];
      for (const inst of existingInstances) {
        const key = `${inst.activityId}:${inst.scheduledDate}`;
        if (seen.has(key)) {
          dupeIds.push(inst.id);
        } else {
          seen.set(key, inst.id);
        }
      }

      // Generate new instances for the window (exclude dupes from existing set)
      const dedupedInstances = existingInstances.filter((i) => !dupeIds.includes(i.id));
      const newInstances: ActivityInstance[] = [];
      for (const activity of allActivities) {
        newInstances.push(...generateInstances(activity, today, windowEnd, dedupedInstances));
      }

      // Demote expired Potential instances (scheduledDate < today) to Failed
      const expired = dedupedInstances.filter(
        (inst) => inst.status === ACTIVITY_STATUS.POTENTIAL && inst.scheduledDate < todayStr,
      );

      let changed = false;
      await db.transaction('rw', db.instances, async () => {
        if (dupeIds.length > 0) {
          await db.instances.bulkDelete(dupeIds);
          changed = true;
        }
        if (newInstances.length > 0) {
          await db.instances.bulkAdd(newInstances);
          changed = true;
        }
        for (const inst of expired) {
          await db.instances.update(inst.id, { status: ACTIVITY_STATUS.FAILED });
          changed = true;
        }
      });

      if (changed) await loadAll();

      return expired.map((inst) => inst.id);
    } finally {
      refreshingRef.current = false;
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

  /** Column-status → instance-status mapping (Charging=0, Grounded=1, Live=2, Powered=3) */
  const COLUMN_TO_INSTANCE: Record<number, ActivityStatus> = {
    0: ACTIVITY_STATUS.POTENTIAL,
    1: ACTIVITY_STATUS.FAILED,
    2: ACTIVITY_STATUS.ACTIVE,
    3: ACTIVITY_STATUS.COMPLETED,
  };

  /** Sync an instance's status to match its linked card's column */
  const syncInstanceToColumn = useCallback(
    async (instanceId: string, columnStatus: number) => {
      const newStatus = COLUMN_TO_INSTANCE[columnStatus];
      if (!newStatus) return;

      const updates: Partial<ActivityInstance> = { status: newStatus };
      if (columnStatus === 2) updates.claimedAt = new Date().toISOString();
      if (columnStatus === 3) updates.completedAt = new Date().toISOString();

      await db.instances.update(instanceId, updates);
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
    syncInstanceToColumn,
  };
}
