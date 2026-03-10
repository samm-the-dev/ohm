import { describe, it, expect } from 'vitest';
import { STATUS, ENERGY_DEFAULT } from '../types/board';
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
    expect(result.energyBudget).toBe(42);
    expect(result.liveCapacity).toBe(6);
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

  it('clamps out-of-range energy to default', () => {
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
    expect(result.cards[0].energy).toBe(ENERGY_DEFAULT);
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
});
