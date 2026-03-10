import { describe, it, expect } from 'vitest';
import { STATUS, ENERGY_DEFAULT } from '../types/board';
import type { OhmBoard, OhmCard } from '../types/board';
import { mergeBoards } from './restore-points';

function makeCard(overrides: Partial<OhmCard> = {}): OhmCard {
  return {
    id: 'test-1',
    title: 'Test card',
    description: '',
    status: STATUS.CHARGING,
    tasks: [],
    energy: ENERGY_DEFAULT,
    category: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
    ...overrides,
  };
}

function makeBoard(overrides: Partial<OhmBoard> = {}): OhmBoard {
  return {
    version: 1,
    cards: [],
    categories: [],
    energyBudget: 18,
    liveCapacity: 6,
    lastSaved: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mergeBoards', () => {
  describe('card merging', () => {
    it('keeps newer card when both boards have the same id', () => {
      const local = makeBoard({
        cards: [makeCard({ id: 'a', title: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' })],
      });
      const imported = makeBoard({
        cards: [makeCard({ id: 'a', title: 'New', updatedAt: '2026-06-01T00:00:00.000Z' })],
      });
      const merged = mergeBoards(local, imported);
      expect(merged.cards).toHaveLength(1);
      expect(merged.cards[0].title).toBe('New');
    });

    it('keeps local card when it is newer', () => {
      const local = makeBoard({
        cards: [makeCard({ id: 'a', title: 'Local', updatedAt: '2026-06-01T00:00:00.000Z' })],
      });
      const imported = makeBoard({
        cards: [makeCard({ id: 'a', title: 'Imported', updatedAt: '2026-01-01T00:00:00.000Z' })],
      });
      const merged = mergeBoards(local, imported);
      expect(merged.cards[0].title).toBe('Local');
    });

    it('includes cards unique to each board when local card is newer than remote snapshot', () => {
      const local = makeBoard({
        cards: [makeCard({ id: 'local-only', createdAt: '2026-06-02T00:00:00.000Z' })],
      });
      const imported = makeBoard({
        cards: [makeCard({ id: 'import-only' })],
        lastSaved: '2026-06-01T00:00:00.000Z',
      });
      const merged = mergeBoards(local, imported);
      const ids = merged.cards.map((c) => c.id).sort();
      expect(ids).toEqual(['import-only', 'local-only']);
    });

    it('drops local-only card that was deleted remotely (createdAt before remote lastSaved)', () => {
      const local = makeBoard({
        cards: [makeCard({ id: 'deleted-remote', createdAt: '2026-01-01T00:00:00.000Z' })],
      });
      const imported = makeBoard({
        cards: [],
        lastSaved: '2026-06-01T00:00:00.000Z',
      });
      const merged = mergeBoards(local, imported);
      expect(merged.cards).toHaveLength(0);
    });

    it('keeps local-only card created after remote snapshot (new offline card)', () => {
      const local = makeBoard({
        cards: [makeCard({ id: 'offline-new', createdAt: '2026-06-15T00:00:00.000Z' })],
      });
      const imported = makeBoard({
        cards: [],
        lastSaved: '2026-06-01T00:00:00.000Z',
      });
      const merged = mergeBoards(local, imported);
      expect(merged.cards).toHaveLength(1);
      expect(merged.cards[0].id).toBe('offline-new');
    });
  });

  describe('category merging', () => {
    it('unions categories from both boards', () => {
      const local = makeBoard({ categories: ['Work', 'Personal'] });
      const imported = makeBoard({ categories: ['Personal', 'Creative'] });
      const merged = mergeBoards(local, imported);
      expect(merged.categories.sort()).toEqual(['Creative', 'Personal', 'Work']);
    });

    it('deduplicates categories', () => {
      const local = makeBoard({ categories: ['A', 'B'] });
      const imported = makeBoard({ categories: ['A', 'B'] });
      const merged = mergeBoards(local, imported);
      expect(merged.categories).toEqual(['A', 'B']);
    });
  });

  describe('capacity merging', () => {
    it('takes imported capacities when they are newer', () => {
      const local = makeBoard({
        energyBudget: 10,
        liveCapacity: 4,
        capacitiesUpdatedAt: '2026-01-01T00:00:00.000Z',
      });
      const imported = makeBoard({
        energyBudget: 20,
        liveCapacity: 8,
        capacitiesUpdatedAt: '2026-06-01T00:00:00.000Z',
      });
      const merged = mergeBoards(local, imported);
      expect(merged.energyBudget).toBe(20);
      expect(merged.liveCapacity).toBe(8);
    });

    it('keeps local capacities when they are newer', () => {
      const local = makeBoard({
        energyBudget: 24,
        liveCapacity: 8,
        capacitiesUpdatedAt: '2026-06-01T00:00:00.000Z',
      });
      const imported = makeBoard({
        energyBudget: 18,
        liveCapacity: 4,
        capacitiesUpdatedAt: '2026-01-01T00:00:00.000Z',
      });
      const merged = mergeBoards(local, imported);
      expect(merged.energyBudget).toBe(24);
      expect(merged.liveCapacity).toBe(8);
    });
  });

  describe('time features merging', () => {
    it('preserves local timeFeatures when set', () => {
      const local = makeBoard({ timeFeatures: true, windowSize: 14 });
      const imported = makeBoard({});
      const merged = mergeBoards(local, imported);
      expect(merged.timeFeatures).toBe(true);
      expect(merged.windowSize).toBe(14);
    });

    it('falls back to imported timeFeatures when local is unset', () => {
      const local = makeBoard({});
      const imported = makeBoard({ timeFeatures: true, windowSize: 7 });
      const merged = mergeBoards(local, imported);
      expect(merged.timeFeatures).toBe(true);
      expect(merged.windowSize).toBe(7);
    });
  });
});
