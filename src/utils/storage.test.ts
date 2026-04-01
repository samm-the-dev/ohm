import { describe, it, expect } from 'vitest';
import {
  STATUS,
  ENERGY_DEFAULT,
  ENERGY_MAX_DEFAULT,
  BUDGET_DEFAULT,
  LIVE_DEFAULT,
  DAILY_LIMIT_DEFAULT,
} from '../types/board';
import type { OhmBoard } from '../types/board';
import { sanitizeBoard } from './storage';

function makeBoard(overrides: Partial<OhmBoard> = {}): OhmBoard {
  return {
    version: 1,
    cards: [],
    categories: [],
    energyBudget: 42,
    liveCapacity: 6,
    lastSaved: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sanitizeBoard', () => {
  it('passes through a valid board unchanged', () => {
    const board = makeBoard({
      categoriesUpdatedAt: '2026-01-01T00:00:00.000Z',
      capacitiesUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    const result = sanitizeBoard(board);
    expect(result.energyBudget).toBe(42);
    expect(result.liveCapacity).toBe(6);
  });

  it('resets invalid capacities to defaults', () => {
    const board = makeBoard({ energyBudget: -1, liveCapacity: 0 });
    const result = sanitizeBoard(board);
    expect(result.energyBudget).toBe(BUDGET_DEFAULT);
    expect(result.liveCapacity).toBe(LIVE_DEFAULT);
  });

  it('backfills missing timestamp fields from lastSaved', () => {
    const board = makeBoard();
    const result = sanitizeBoard(board);
    expect(result.categoriesUpdatedAt).toBe(board.lastSaved);
    expect(result.capacitiesUpdatedAt).toBe(board.lastSaved);
  });

  it('does not overwrite existing timestamp fields', () => {
    const board = makeBoard({
      categoriesUpdatedAt: '2026-06-01T00:00:00.000Z',
      capacitiesUpdatedAt: '2026-06-01T00:00:00.000Z',
    });
    const result = sanitizeBoard(board);
    expect(result.categoriesUpdatedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(result.capacitiesUpdatedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('clamps out-of-range energy to energyMax', () => {
    const board = makeBoard({
      cards: [
        {
          id: 'a',
          title: 'Test',
          description: '',
          status: STATUS.CHARGING,
          tasks: [],
          energy: 99 as never,
          category: '',
          createdAt: '',
          updatedAt: '',
          sortOrder: 0,
        },
      ],
    });
    const result = sanitizeBoard(board);
    expect(result.cards[0].energy).toBe(ENERGY_MAX_DEFAULT);
  });

  it('clamps energy to custom energyMax when set', () => {
    const board = makeBoard({
      energyMax: 5,
      cards: [
        {
          id: 'a',
          title: 'Test',
          description: '',
          status: STATUS.CHARGING,
          tasks: [],
          energy: 10 as never,
          category: '',
          createdAt: '',
          updatedAt: '',
          sortOrder: 0,
        },
      ],
    });
    const result = sanitizeBoard(board);
    expect(result.cards[0].energy).toBe(5);
  });

  it('clamps out-of-range status to CHARGING', () => {
    const board = makeBoard({
      cards: [
        {
          id: 'a',
          title: 'Test',
          description: '',
          status: -1 as never,
          tasks: [],
          energy: 1,
          category: '',
          createdAt: '',
          updatedAt: '',
          sortOrder: 0,
        },
      ],
    });
    const result = sanitizeBoard(board);
    expect(result.cards[0].status).toBe(STATUS.CHARGING);
  });

  it('initializes missing tasks array', () => {
    const board = makeBoard({
      cards: [
        {
          id: 'a',
          title: 'Test',
          description: '',
          status: STATUS.CHARGING,
          tasks: undefined as never,
          energy: ENERGY_DEFAULT,
          category: '',
          createdAt: '',
          updatedAt: '',
          sortOrder: 0,
        },
      ],
    });
    const result = sanitizeBoard(board);
    expect(result.cards[0].tasks).toEqual([]);
  });

  it('defaults dailyLimit to 3 when missing', () => {
    const board = makeBoard();
    const result = sanitizeBoard(board);
    expect(result.dailyLimit).toBe(DAILY_LIMIT_DEFAULT);
  });

  it('preserves existing dailyLimit', () => {
    const board = makeBoard({ dailyLimit: 5 });
    const result = sanitizeBoard(board);
    expect(result.dailyLimit).toBe(5);
  });

  it('defaults funSettings to empty object when missing', () => {
    const board = makeBoard();
    const result = sanitizeBoard(board);
    expect(result.funSettings).toEqual({});
  });

  it('preserves existing funSettings', () => {
    const board = makeBoard({ funSettings: { dailyTheme: true } });
    const result = sanitizeBoard(board);
    expect(result.funSettings).toEqual({ dailyTheme: true });
  });

  it('prunes archived cards older than 14 days', () => {
    const old = new Date();
    old.setDate(old.getDate() - 15);
    const board = makeBoard({
      cards: [
        {
          id: 'old',
          title: 'Old',
          description: '',
          status: STATUS.POWERED,
          tasks: [],
          energy: 1,
          category: '',
          createdAt: '',
          updatedAt: '',
          sortOrder: 0,
          archivedAt: old.toISOString(),
        },
        {
          id: 'recent',
          title: 'Recent',
          description: '',
          status: STATUS.POWERED,
          tasks: [],
          energy: 1,
          category: '',
          createdAt: '',
          updatedAt: '',
          sortOrder: 0,
          archivedAt: new Date().toISOString(),
        },
      ],
    });
    const result = sanitizeBoard(board);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].id).toBe('recent');
  });

  it('strips archivedAt from non-Powered cards', () => {
    const board = makeBoard({
      cards: [
        {
          id: 'a',
          title: 'Charging card',
          description: '',
          status: STATUS.CHARGING,
          tasks: [],
          energy: 1,
          category: '',
          createdAt: '',
          updatedAt: '',
          sortOrder: 0,
          archivedAt: new Date().toISOString(),
        },
      ],
    });
    const result = sanitizeBoard(board);
    expect(result.cards[0].archivedAt).toBeUndefined();
  });
});
