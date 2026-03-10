import { describe, it, expect } from 'vitest';
import { STATUS, ENERGY_DEFAULT, createDefaultBoard } from '../types/board';
import type { OhmCard, OhmBoard } from '../types/board';
import {
  createCard,
  moveCard,
  getColumnCards,
  getColumnCapacity,
  getTotalCapacity,
  getDailyEnergy,
  cardEffectiveDate,
  getTrailingPowered,
  getExpiredPowered,
  addCardToBoard,
  updateCardInBoard,
  removeCardFromBoard,
} from './board-utils';

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
  return { ...createDefaultBoard(), ...overrides };
}

describe('createCard', () => {
  it('creates a card in Charging with default energy', () => {
    const card = createCard('New idea');
    expect(card.title).toBe('New idea');
    expect(card.status).toBe(STATUS.CHARGING);
    expect(card.energy).toBe(ENERGY_DEFAULT);
    expect(card.description).toBe('');
    expect(card.tasks).toEqual([]);
    expect(card.id).toBeTruthy();
  });

  it('applies overrides', () => {
    const card = createCard('Big task', { energy: 6, category: 'Work' });
    expect(card.energy).toBe(6);
    expect(card.category).toBe('Work');
  });
});

describe('moveCard', () => {
  it('changes status and updates timestamp', () => {
    const card = makeCard();
    const moved = moveCard(card, STATUS.LIVE);
    expect(moved.status).toBe(STATUS.LIVE);
    expect(moved.updatedAt).not.toBe(card.updatedAt);
  });

  it('returns a new object (immutable)', () => {
    const card = makeCard();
    const moved = moveCard(card, STATUS.GROUNDED);
    expect(moved).not.toBe(card);
    expect(card.status).toBe(STATUS.CHARGING);
  });
});

describe('getColumnCards', () => {
  it('filters and sorts cards by column', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', status: STATUS.CHARGING, sortOrder: 2 }),
        makeCard({ id: 'b', status: STATUS.LIVE, sortOrder: 0 }),
        makeCard({ id: 'c', status: STATUS.CHARGING, sortOrder: 1 }),
      ],
    });
    const charging = getColumnCards(board, STATUS.CHARGING);
    expect(charging.map((c) => c.id)).toEqual(['c', 'a']);
  });

  it('sorts by scheduledDate ascending, unscheduled last', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', status: STATUS.CHARGING, sortOrder: 0 }),
        makeCard({ id: 'b', status: STATUS.CHARGING, sortOrder: 1, scheduledDate: '2026-03-11' }),
        makeCard({ id: 'c', status: STATUS.CHARGING, sortOrder: 2, scheduledDate: '2026-03-09' }),
      ],
    });
    const charging = getColumnCards(board, STATUS.CHARGING);
    // c (Mar 9), b (Mar 11), a (unscheduled → last)
    expect(charging.map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('uses sortOrder as tiebreaker within same date', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', status: STATUS.CHARGING, sortOrder: 2, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'b', status: STATUS.CHARGING, sortOrder: 1, scheduledDate: '2026-03-09' }),
      ],
    });
    const charging = getColumnCards(board, STATUS.CHARGING);
    expect(charging.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('returns empty array for empty column', () => {
    const board = makeBoard();
    expect(getColumnCards(board, STATUS.LIVE)).toEqual([]);
  });
});

describe('getColumnCapacity', () => {
  it('sums energy for Live column', () => {
    const board = makeBoard({
      liveCapacity: 10,
      cards: [
        makeCard({ id: 'a', status: STATUS.LIVE, energy: 1 }),
        makeCard({ id: 'b', status: STATUS.LIVE, energy: 5 }),
      ],
    });
    expect(getColumnCapacity(board, STATUS.LIVE)).toEqual({ used: 6, total: 10 });
  });

  it('includes today Powered cards in Live capacity', () => {
    const board = makeBoard({
      liveCapacity: 10,
      cards: [
        makeCard({ id: 'a', status: STATUS.LIVE, energy: 2 }),
        makeCard({ id: 'b', status: STATUS.POWERED, energy: 3, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'c', status: STATUS.POWERED, energy: 4, scheduledDate: '2026-03-08' }),
      ],
    });
    // Live(2) + today's Powered(3) = 5; yesterday's Powered excluded
    expect(getColumnCapacity(board, STATUS.LIVE, '2026-03-09')).toEqual({ used: 5, total: 10 });
  });

  it('uses cardEffectiveDate fallback for Powered cards without scheduledDate', () => {
    const board = makeBoard({
      liveCapacity: 10,
      cards: [
        makeCard({ id: 'a', status: STATUS.LIVE, energy: 2 }),
        makeCard({
          id: 'b',
          status: STATUS.POWERED,
          energy: 3,
          updatedAt: '2026-03-09T12:00:00.000Z',
        }),
      ],
    });
    // Powered card has no scheduledDate but updatedAt is today → counts
    expect(getColumnCapacity(board, STATUS.LIVE, '2026-03-09')).toEqual({ used: 5, total: 10 });
  });

  it('returns null for non-Live columns', () => {
    const board = makeBoard();
    expect(getColumnCapacity(board, STATUS.CHARGING)).toBeNull();
    expect(getColumnCapacity(board, STATUS.GROUNDED)).toBeNull();
    expect(getColumnCapacity(board, STATUS.POWERED)).toBeNull();
  });
});

describe('getTotalCapacity', () => {
  it('excludes Grounded cards from used total', () => {
    const board = makeBoard({
      energyBudget: 42,
      cards: [
        makeCard({ id: 'a', status: STATUS.CHARGING, energy: 2 }),
        makeCard({ id: 'b', status: STATUS.LIVE, energy: 4 }),
        makeCard({ id: 'c', status: STATUS.POWERED, energy: 6 }),
        makeCard({ id: 'd', status: STATUS.GROUNDED, energy: 3 }),
      ],
    });
    // Charging(2) + Live(4) + Powered(6) = 12, Grounded excluded
    expect(getTotalCapacity(board)).toEqual({ used: 12, total: 42 });
  });

  it('returns zero used when board is empty', () => {
    const board = makeBoard({ energyBudget: 42 });
    expect(getTotalCapacity(board)).toEqual({ used: 0, total: 42 });
  });

  describe('with window (time features)', () => {
    const WIN_START = '2026-03-08';
    const WIN_END = '2026-03-11';

    it('includes Powered cards inside the window', () => {
      const board = makeBoard({
        energyBudget: 20,
        cards: [makeCard({ status: STATUS.POWERED, energy: 4, scheduledDate: '2026-03-09' })],
      });
      expect(getTotalCapacity(board, WIN_START, WIN_END)).toEqual({ used: 4, total: 20 });
    });

    it('excludes Powered cards outside the window', () => {
      const board = makeBoard({
        energyBudget: 20,
        cards: [makeCard({ status: STATUS.POWERED, energy: 4, scheduledDate: '2026-03-01' })],
      });
      expect(getTotalCapacity(board, WIN_START, WIN_END)).toEqual({ used: 0, total: 20 });
    });

    it('always includes Live cards regardless of date', () => {
      const board = makeBoard({
        energyBudget: 20,
        cards: [makeCard({ status: STATUS.LIVE, energy: 3 })],
      });
      expect(getTotalCapacity(board, WIN_START, WIN_END)).toEqual({ used: 3, total: 20 });
    });

    it('always excludes Grounded cards', () => {
      const board = makeBoard({
        energyBudget: 20,
        cards: [makeCard({ status: STATUS.GROUNDED, energy: 5, scheduledDate: '2026-03-09' })],
      });
      expect(getTotalCapacity(board, WIN_START, WIN_END)).toEqual({ used: 0, total: 20 });
    });

    it('includes Charging cards without a date', () => {
      const board = makeBoard({
        energyBudget: 20,
        cards: [makeCard({ status: STATUS.CHARGING, energy: 2 })],
      });
      expect(getTotalCapacity(board, WIN_START, WIN_END)).toEqual({ used: 2, total: 20 });
    });

    it('excludes Charging cards with a date outside the window', () => {
      const board = makeBoard({
        energyBudget: 20,
        cards: [makeCard({ status: STATUS.CHARGING, energy: 2, scheduledDate: '2026-03-20' })],
      });
      expect(getTotalCapacity(board, WIN_START, WIN_END)).toEqual({ used: 0, total: 20 });
    });

    it('includes Charging cards with a date inside the window', () => {
      const board = makeBoard({
        energyBudget: 20,
        cards: [makeCard({ status: STATUS.CHARGING, energy: 2, scheduledDate: '2026-03-09' })],
      });
      expect(getTotalCapacity(board, WIN_START, WIN_END)).toEqual({ used: 2, total: 20 });
    });
  });
});

describe('cardEffectiveDate', () => {
  it('returns scheduledDate when set', () => {
    const card = makeCard({ scheduledDate: '2026-03-10' });
    expect(cardEffectiveDate(card)).toBe('2026-03-10');
  });

  it('falls back to updatedAt date when no scheduledDate', () => {
    const card = makeCard({ updatedAt: '2026-03-09T14:30:00.000Z' });
    expect(cardEffectiveDate(card)).toBe('2026-03-09');
  });
});

describe('getTrailingPowered', () => {
  it('sums energy of Powered cards within the window', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', status: STATUS.POWERED, energy: 3, scheduledDate: '2026-03-08' }),
        makeCard({ id: 'b', status: STATUS.POWERED, energy: 5, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'c', status: STATUS.CHARGING, energy: 2, scheduledDate: '2026-03-09' }),
      ],
    });
    const result = getTrailingPowered(board, '2026-03-08', '2026-03-09');
    expect(result.used).toBe(8);
    expect(result.cards).toHaveLength(2);
  });

  it('excludes Powered cards outside the window', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', status: STATUS.POWERED, energy: 4, scheduledDate: '2026-03-01' }),
        makeCard({ id: 'b', status: STATUS.POWERED, energy: 2, scheduledDate: '2026-03-09' }),
      ],
    });
    const result = getTrailingPowered(board, '2026-03-08', '2026-03-09');
    expect(result.used).toBe(2);
    expect(result.cards).toHaveLength(1);
  });
});

describe('getExpiredPowered', () => {
  it('finds Powered cards before the window start', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', status: STATUS.POWERED, energy: 3, scheduledDate: '2026-03-01' }),
        makeCard({ id: 'b', status: STATUS.POWERED, energy: 5, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'c', status: STATUS.CHARGING, energy: 2, scheduledDate: '2026-03-01' }),
      ],
    });
    const expired = getExpiredPowered(board, '2026-03-08');
    expect(expired).toHaveLength(1);
    expect(expired[0].id).toBe('a');
  });
});

describe('addCardToBoard', () => {
  it('appends a card immutably', () => {
    const board = makeBoard();
    const card = makeCard();
    const updated = addCardToBoard(board, card);
    expect(updated.cards).toHaveLength(1);
    expect(updated.cards[0]).toBe(card);
    expect(updated).not.toBe(board);
  });

  it('does not mutate the original board', () => {
    const board = makeBoard();
    addCardToBoard(board, makeCard());
    expect(board.cards).toHaveLength(0);
  });
});

describe('updateCardInBoard', () => {
  it('replaces matching card by id', () => {
    const card = makeCard({ id: 'x', title: 'Old' });
    const board = makeBoard({ cards: [card] });
    const updated = updateCardInBoard(board, { ...card, title: 'New' });
    expect(updated.cards[0].title).toBe('New');
  });

  it('leaves non-matching cards untouched', () => {
    const a = makeCard({ id: 'a' });
    const b = makeCard({ id: 'b' });
    const board = makeBoard({ cards: [a, b] });
    const updated = updateCardInBoard(board, { ...a, title: 'Changed' });
    expect(updated.cards[1]).toBe(b);
  });
});

describe('getDailyEnergy', () => {
  it('returns per-day energy for scheduled cards', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', energy: 2, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'b', energy: 4, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'c', energy: 3, scheduledDate: '2026-03-11' }),
      ],
    });
    const result = getDailyEnergy(board, '2026-03-09', '2026-03-11');
    expect(result).toEqual([
      { date: '2026-03-09', used: 6 },
      { date: '2026-03-10', used: 0 },
      { date: '2026-03-11', used: 3 },
    ]);
  });

  it('excludes cards outside the window', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', energy: 5, scheduledDate: '2026-03-08' }),
        makeCard({ id: 'b', energy: 2, scheduledDate: '2026-03-09' }),
      ],
    });
    const result = getDailyEnergy(board, '2026-03-09', '2026-03-09');
    expect(result).toEqual([{ date: '2026-03-09', used: 2 }]);
  });

  it('skips cards without scheduledDate', () => {
    const board = makeBoard({
      cards: [makeCard({ id: 'a', energy: 3 })],
    });
    const result = getDailyEnergy(board, '2026-03-09', '2026-03-09');
    expect(result).toEqual([{ date: '2026-03-09', used: 0 }]);
  });

  it('excludes Grounded cards from daily totals', () => {
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', status: STATUS.LIVE, energy: 2, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'b', status: STATUS.GROUNDED, energy: 5, scheduledDate: '2026-03-09' }),
        makeCard({ id: 'c', status: STATUS.POWERED, energy: 3, scheduledDate: '2026-03-09' }),
      ],
    });
    const result = getDailyEnergy(board, '2026-03-09', '2026-03-09');
    // Live(2) + Powered(3) = 5, Grounded excluded
    expect(result).toEqual([{ date: '2026-03-09', used: 5 }]);
  });
});

describe('removeCardFromBoard', () => {
  it('removes card by id', () => {
    const board = makeBoard({ cards: [makeCard({ id: 'a' }), makeCard({ id: 'b' })] });
    const updated = removeCardFromBoard(board, 'a');
    expect(updated.cards).toHaveLength(1);
    expect(updated.cards[0].id).toBe('b');
  });

  it('returns unchanged board if id not found', () => {
    const board = makeBoard({ cards: [makeCard({ id: 'a' })] });
    const updated = removeCardFromBoard(board, 'nonexistent');
    expect(updated.cards).toHaveLength(1);
  });
});
