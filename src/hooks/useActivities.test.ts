import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { db } from '../db';
import type { Activity } from '../types/activity';
import { ACTIVITY_STATUS } from '../types/activity';
import { WINDOW_DEFAULT } from '../types/board';
import { useActivities } from './useActivities';

/** Wrapper hook that provides board-state-backed activities + setActivities */
function useTestActivities(windowSize?: number) {
  const [activities, setActivitiesRaw] = useState<Activity[]>([]);
  const setActivities = (updater: (prev: Activity[]) => Activity[]) => setActivitiesRaw(updater);
  return useActivities({
    activities,
    setActivities,
    windowSize: windowSize ?? WINDOW_DEFAULT,
  });
}

beforeEach(async () => {
  await db.instances.clear();
  await db.activities.clear();
  await db.dismissedInstances.clear();
});

describe('useActivities', () => {
  it('starts with empty arrays', () => {
    const { result } = renderHook(() => useTestActivities());
    expect(result.current.activities).toEqual([]);
    expect(result.current.instances).toEqual([]);
  });

  describe('addActivity', () => {
    it('creates an activity and updates state', async () => {
      const { result } = renderHook(() => useTestActivities());
      await act(async () => {
        result.current.addActivity('Morning run');
      });
      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0]!.name).toBe('Morning run');
      expect(result.current.activities[0]!.sourceId).toBe('ohm');
    });

    it('accepts optional description, schedule, and energy', async () => {
      const { result } = renderHook(() => useTestActivities());
      await act(async () => {
        result.current.addActivity('Yoga', {
          description: 'Morning yoga',
          schedule: { repeatFrequency: 'P1D' },
          energy: 1,
        });
      });
      const activity = result.current.activities[0]!;
      expect(activity.description).toBe('Morning yoga');
      expect(activity.schedule?.repeatFrequency).toBe('P1D');
      expect(activity.energy).toBe(1);
    });

    it('returns the created activity', async () => {
      const { result } = renderHook(() => useTestActivities());
      let created: ReturnType<typeof result.current.addActivity> | undefined;
      await act(async () => {
        created = result.current.addActivity('Test');
      });
      expect(created).toBeDefined();
      expect(created!.name).toBe('Test');
      expect(created!.id).toBeTruthy();
    });
  });

  describe('updateActivity', () => {
    it('updates an existing activity', async () => {
      const { result } = renderHook(() => useTestActivities());
      let id: string;
      await act(async () => {
        const a = result.current.addActivity('Old name');
        id = a.id;
      });
      await act(async () => {
        result.current.updateActivity(id!, { name: 'New name' });
      });
      expect(result.current.activities[0]!.name).toBe('New name');
    });
  });

  describe('deleteActivity', () => {
    it('removes the activity and its instances', async () => {
      const { result } = renderHook(() => useTestActivities());
      let id: string;
      await act(async () => {
        const a = result.current.addActivity('To delete', {
          schedule: { repeatFrequency: 'P1D' },
        });
        id = a.id;
      });
      // Generate some instances
      await act(async () => {
        await result.current.refreshWindow();
      });
      expect(result.current.instances.length).toBeGreaterThan(0);

      await act(async () => {
        await result.current.deleteActivity(id!);
      });
      expect(result.current.activities).toHaveLength(0);
      expect(result.current.instances).toHaveLength(0);
    });
  });

  describe('refreshWindow', () => {
    it('generates instances for scheduled activities', async () => {
      const { result } = renderHook(() => useTestActivities());
      await act(async () => {
        result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      // Default window = WINDOW_DEFAULT days, daily = WINDOW_DEFAULT instances
      expect(result.current.instances).toHaveLength(WINDOW_DEFAULT);
      expect(result.current.instances[0]!.status).toBe(ACTIVITY_STATUS.POTENTIAL);
    });

    it('does not duplicate instances on repeated calls', async () => {
      const { result } = renderHook(() => useTestActivities());
      await act(async () => {
        result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      expect(result.current.instances).toHaveLength(WINDOW_DEFAULT);
    });

    it('demotes expired Potential instances to Failed', async () => {
      const { result } = renderHook(() => useTestActivities());
      await act(async () => {
        result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      // Manually insert an instance with a past scheduledDate
      await db.instances.add({
        id: 'expired-1',
        activityId: result.current.activities[0]!.id,
        scheduledDate: '2020-01-01',
        status: ACTIVITY_STATUS.POTENTIAL,
      });
      await act(async () => {
        const expiredIds = await result.current.refreshWindow();
        expect(expiredIds).toContain('expired-1');
      });
      const expired = result.current.instances.find((i) => i.id === 'expired-1')!;
      expect(expired.status).toBe(ACTIVITY_STATUS.FAILED);
    });

    it('returns expired instance IDs from refreshWindow', async () => {
      const { result } = renderHook(() => useTestActivities());
      await act(async () => {
        result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      let expiredIds: string[] = [];
      await act(async () => {
        expiredIds = await result.current.refreshWindow();
      });
      // No expired instances on first run (all generated for today+)
      expect(expiredIds).toEqual([]);
    });

    it('skips activities without schedules', async () => {
      const { result } = renderHook(() => useTestActivities());
      await act(async () => {
        result.current.addActivity('No schedule');
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      expect(result.current.instances).toHaveLength(0);
    });

    it('respects custom window size', async () => {
      const { result } = renderHook(() => useTestActivities(3));
      await act(async () => {
        result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      expect(result.current.instances).toHaveLength(3);
    });
  });

  describe('instance lifecycle', () => {
    async function setupWithInstance() {
      const hook = renderHook(() => useTestActivities());
      await act(async () => {
        hook.result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      await act(async () => {
        await hook.result.current.refreshWindow();
      });
      return hook;
    }

    it('claimInstance sets status to Active and records claimedAt', async () => {
      const { result } = await setupWithInstance();
      const instanceId = result.current.instances[0]!.id;
      await act(async () => {
        await result.current.claimInstance(instanceId);
      });
      const updated = result.current.instances.find((i) => i.id === instanceId)!;
      expect(updated.status).toBe(ACTIVITY_STATUS.ACTIVE);
      expect(updated.claimedAt).toBeTruthy();
    });

    it('completeInstance sets status to Completed and records completedAt', async () => {
      const { result } = await setupWithInstance();
      const instanceId = result.current.instances[0]!.id;
      await act(async () => {
        await result.current.completeInstance(instanceId);
      });
      const updated = result.current.instances.find((i) => i.id === instanceId)!;
      expect(updated.status).toBe(ACTIVITY_STATUS.COMPLETED);
      expect(updated.completedAt).toBeTruthy();
    });

    it('skipInstance sets status to Failed', async () => {
      const { result } = await setupWithInstance();
      const instanceId = result.current.instances[0]!.id;
      await act(async () => {
        await result.current.skipInstance(instanceId);
      });
      const updated = result.current.instances.find((i) => i.id === instanceId)!;
      expect(updated.status).toBe(ACTIVITY_STATUS.FAILED);
    });

    it('dismissInstance removes the instance and prevents regeneration', async () => {
      const { result } = await setupWithInstance();
      const instance = result.current.instances[0]!;
      const instanceCount = result.current.instances.length;

      await act(async () => {
        await result.current.dismissInstance(instance.id);
      });

      // Instance is removed
      expect(result.current.instances).toHaveLength(instanceCount - 1);
      expect(result.current.instances.find((i) => i.id === instance.id)).toBeUndefined();

      // Dismissal record exists in DB
      const dismissals = await db.dismissedInstances.toArray();
      expect(dismissals).toHaveLength(1);
      expect(dismissals[0]!.activityId).toBe(instance.activityId);
      expect(dismissals[0]!.scheduledDate).toBe(instance.scheduledDate);

      // refreshWindow does NOT recreate the dismissed instance
      await act(async () => {
        await result.current.refreshWindow();
      });
      expect(
        result.current.instances.find((i) => i.scheduledDate === instance.scheduledDate),
      ).toBeUndefined();
      expect(result.current.instances).toHaveLength(instanceCount - 1);
    });

    it('auto-cleans dismissals for past dates during refreshWindow', async () => {
      const { result } = await setupWithInstance();

      // Manually insert a stale dismissal (past date)
      await db.dismissedInstances.put({
        id: `${result.current.activities[0]!.id}:2020-01-01`,
        activityId: result.current.activities[0]!.id,
        scheduledDate: '2020-01-01',
        dismissedAt: new Date().toISOString(),
      });
      expect(await db.dismissedInstances.count()).toBe(1);

      await act(async () => {
        await result.current.refreshWindow();
      });

      // Stale dismissal should be pruned
      expect(await db.dismissedInstances.count()).toBe(0);
    });

    it('deleteActivity also removes dismissal records', async () => {
      const { result } = await setupWithInstance();
      const activity = result.current.activities[0]!;
      const instance = result.current.instances[0]!;

      // Dismiss an instance first
      await act(async () => {
        await result.current.dismissInstance(instance.id);
      });
      expect(await db.dismissedInstances.count()).toBe(1);

      // Delete the activity
      await act(async () => {
        await result.current.deleteActivity(activity.id);
      });

      // Dismissal records are cleaned up
      expect(await db.dismissedInstances.count()).toBe(0);
    });

    it('syncInstanceToColumn maps column status to instance status', async () => {
      const { result } = await setupWithInstance();
      const instanceId = result.current.instances[0]!.id;

      // Charging (1) → Potential
      await act(async () => {
        await result.current.syncInstanceToColumn(instanceId, 1);
      });
      expect(result.current.instances.find((i) => i.id === instanceId)!.status).toBe(
        ACTIVITY_STATUS.POTENTIAL,
      );

      // Live (2) → Active + claimedAt
      await act(async () => {
        await result.current.syncInstanceToColumn(instanceId, 2);
      });
      let updated = result.current.instances.find((i) => i.id === instanceId)!;
      expect(updated.status).toBe(ACTIVITY_STATUS.ACTIVE);
      expect(updated.claimedAt).toBeTruthy();

      // Powered (3) → Completed + completedAt
      await act(async () => {
        await result.current.syncInstanceToColumn(instanceId, 3);
      });
      updated = result.current.instances.find((i) => i.id === instanceId)!;
      expect(updated.status).toBe(ACTIVITY_STATUS.COMPLETED);
      expect(updated.completedAt).toBeTruthy();

      // Grounded (0) → Failed
      await act(async () => {
        await result.current.syncInstanceToColumn(instanceId, 0);
      });
      expect(result.current.instances.find((i) => i.id === instanceId)!.status).toBe(
        ACTIVITY_STATUS.FAILED,
      );
    });
  });
});
