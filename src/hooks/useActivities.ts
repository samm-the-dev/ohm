import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../db';
import type { Activity, ActivityInstance, ActivityStatus } from '../types/activity';
import type { StoredSchedule } from '../types/schedule';
import { ACTIVITY_STATUS } from '../types/activity';
import { generateInstances, toISODate } from '../utils/schedule-utils';
import { generateId } from '../utils/board-utils';
import { WINDOW_DEFAULT } from '../types/board';

interface UseActivitiesOptions {
  /** Activity templates (from board state, synced via Drive) */
  activities: Activity[];
  /** Functional updater for activities (writes to board state) */
  setActivities: (updater: (prev: Activity[]) => Activity[]) => void;
  /** Rolling window size in days */
  windowSize?: number;
}

export function useActivities({
  activities,
  setActivities,
  windowSize = WINDOW_DEFAULT,
}: UseActivitiesOptions) {
  const [instances, setInstances] = useState<ActivityInstance[]>([]);

  const loadInstances = useCallback(async () => {
    const insts = await db.instances.toArray();
    setInstances(insts);
  }, []);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  /** Create a new activity with an optional schedule */
  const addActivity = useCallback(
    (
      name: string,
      opts?: {
        description?: string;
        schedule?: StoredSchedule;
        energy?: number;
        category?: string;
      },
    ): Activity => {
      const activity: Activity = {
        id: generateId(),
        sourceId: 'ohm',
        name,
        description: opts?.description,
        schedule: opts?.schedule,
        energy: opts?.energy,
        category: opts?.category,
      };
      setActivities((prev) => [...prev, activity]);
      return activity;
    },
    [setActivities],
  );

  /** Update an existing activity */
  const updateActivity = useCallback(
    (id: string, changes: Partial<Omit<Activity, 'id'>>) => {
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
    },
    [setActivities],
  );

  /** Delete an activity and all its instances + dismissals */
  const deleteActivity = useCallback(
    async (id: string) => {
      setActivities((prev) => prev.filter((a) => a.id !== id));
      await db.instances.where('activityId').equals(id).delete();
      await db.dismissedInstances.where('activityId').equals(id).delete();
      await loadInstances();
    },
    [setActivities, loadInstances],
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

      const existingInstances = await db.instances.toArray();

      // Load dismissed instances and build lookup set
      const allDismissed = await db.dismissedInstances.toArray();
      const dismissedKeys = new Set(allDismissed.map((d) => d.id));

      // Auto-cleanup: prune dismissals for past dates (no longer relevant)
      const staleDismissalIds = allDismissed
        .filter((d) => d.scheduledDate < todayStr)
        .map((d) => d.id);
      if (staleDismissalIds.length > 0) {
        await db.dismissedInstances.bulkDelete(staleDismissalIds);
        for (const id of staleDismissalIds) dismissedKeys.delete(id);
      }

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
      const dupeIdSet = new Set(dupeIds);
      const dedupedInstances = existingInstances.filter((i) => !dupeIdSet.has(i.id));
      const newInstances: ActivityInstance[] = [];
      for (const activity of activities) {
        newInstances.push(
          ...generateInstances(activity, today, windowEnd, dedupedInstances, dismissedKeys),
        );
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

      if (changed) await loadInstances();

      return expired.map((inst) => inst.id);
    } finally {
      refreshingRef.current = false;
    }
  }, [windowSize, activities, loadInstances]);

  /** Claim an instance (move to Active/Live) */
  const claimInstance = useCallback(
    async (instanceId: string) => {
      await db.instances.update(instanceId, {
        status: ACTIVITY_STATUS.ACTIVE,
        claimedAt: new Date().toISOString(),
      });
      await loadInstances();
    },
    [loadInstances],
  );

  /** Complete an instance (move to Completed/Powered) */
  const completeInstance = useCallback(
    async (instanceId: string) => {
      await db.instances.update(instanceId, {
        status: ACTIVITY_STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
      });
      await loadInstances();
    },
    [loadInstances],
  );

  /** Skip an instance (move to Failed/Grounded) */
  const skipInstance = useCallback(
    async (instanceId: string) => {
      await db.instances.update(instanceId, {
        status: ACTIVITY_STATUS.FAILED,
      });
      await loadInstances();
    },
    [loadInstances],
  );

  /** Dismiss a recurring instance (soft delete — prevents regeneration) */
  const dismissInstance = useCallback(
    async (instanceId: string) => {
      const instance = await db.instances.get(instanceId);
      if (!instance) return;

      const dismissalId = `${instance.activityId}:${instance.scheduledDate}`;
      await db.transaction('rw', [db.instances, db.dismissedInstances], async () => {
        await db.dismissedInstances.put({
          id: dismissalId,
          activityId: instance.activityId,
          scheduledDate: instance.scheduledDate,
          dismissedAt: new Date().toISOString(),
        });
        await db.instances.delete(instanceId);
      });
      await loadInstances();
    },
    [loadInstances],
  );

  /** Column-status → instance-status mapping (Grounded=0, Charging=1, Live=2, Powered=3) */
  const COLUMN_TO_INSTANCE: Record<number, ActivityStatus> = {
    0: ACTIVITY_STATUS.FAILED,
    1: ACTIVITY_STATUS.POTENTIAL,
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
      await loadInstances();
    },
    [loadInstances],
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
    dismissInstance,
    syncInstanceToColumn,
  };
}
