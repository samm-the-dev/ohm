import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { db } from '../db';
import { ACTIVITY_STATUS } from '../types/activity';
import { useActivities } from './useActivities';

beforeEach(async () => {
  await db.instances.clear();
  await db.activities.clear();
});

describe('useActivities', () => {
  it('starts with empty arrays', () => {
    const { result } = renderHook(() => useActivities());
    expect(result.current.activities).toEqual([]);
    expect(result.current.instances).toEqual([]);
  });

  describe('addActivity', () => {
    it('creates an activity and updates state', async () => {
      const { result } = renderHook(() => useActivities());
      await act(async () => {
        await result.current.addActivity('Morning run');
      });
      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0]!.name).toBe('Morning run');
      expect(result.current.activities[0]!.sourceId).toBe('ohm');
    });

    it('accepts optional description, schedule, and energy', async () => {
      const { result } = renderHook(() => useActivities());
      await act(async () => {
        await result.current.addActivity('Yoga', {
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
      const { result } = renderHook(() => useActivities());
      let created: Awaited<ReturnType<typeof result.current.addActivity>> | undefined;
      await act(async () => {
        created = await result.current.addActivity('Test');
      });
      expect(created).toBeDefined();
      expect(created!.name).toBe('Test');
      expect(created!.id).toBeTruthy();
    });
  });

  describe('updateActivity', () => {
    it('updates an existing activity', async () => {
      const { result } = renderHook(() => useActivities());
      let id: string;
      await act(async () => {
        const a = await result.current.addActivity('Old name');
        id = a.id;
      });
      await act(async () => {
        await result.current.updateActivity(id!, { name: 'New name' });
      });
      expect(result.current.activities[0]!.name).toBe('New name');
    });
  });

  describe('deleteActivity', () => {
    it('removes the activity and its instances', async () => {
      const { result } = renderHook(() => useActivities());
      let id: string;
      await act(async () => {
        const a = await result.current.addActivity('To delete', {
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
      const { result } = renderHook(() => useActivities());
      await act(async () => {
        await result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      // Default window = 7 days, daily = 7 instances
      expect(result.current.instances).toHaveLength(7);
      expect(result.current.instances[0]!.status).toBe(ACTIVITY_STATUS.POTENTIAL);
    });

    it('does not duplicate instances on repeated calls', async () => {
      const { result } = renderHook(() => useActivities());
      await act(async () => {
        await result.current.addActivity('Daily', {
          schedule: { repeatFrequency: 'P1D' },
        });
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      expect(result.current.instances).toHaveLength(7);
    });

    it('skips activities without schedules', async () => {
      const { result } = renderHook(() => useActivities());
      await act(async () => {
        await result.current.addActivity('No schedule');
      });
      await act(async () => {
        await result.current.refreshWindow();
      });
      expect(result.current.instances).toHaveLength(0);
    });

    it('respects custom window size', async () => {
      const { result } = renderHook(() => useActivities(3));
      await act(async () => {
        await result.current.addActivity('Daily', {
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
      const hook = renderHook(() => useActivities());
      await act(async () => {
        await hook.result.current.addActivity('Daily', {
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
  });
});
