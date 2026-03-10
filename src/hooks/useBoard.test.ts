import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { STATUS } from '../types/board';
import { useBoard } from './useBoard';

beforeEach(() => {
  localStorage.clear();
});

describe('useBoard', () => {
  it('initializes with a default board', () => {
    const { result } = renderHook(() => useBoard());
    expect(result.current.board.cards).toEqual([]);
    expect(result.current.board.categories).toEqual(['Personal', 'Creative', 'Home']);
  });

  describe('quickAdd', () => {
    it('adds a card to Charging', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('New task');
      });
      expect(result.current.board.cards).toHaveLength(1);
      expect(result.current.board.cards[0].title).toBe('New task');
      expect(result.current.board.cards[0].status).toBe(STATUS.CHARGING);
    });

    it('applies energy override', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('Big task', { energy: 6 });
      });
      expect(result.current.board.cards[0].energy).toBe(6);
    });

    it('returns the created card', () => {
      const { result } = renderHook(() => useBoard());
      let card: ReturnType<typeof result.current.quickAdd>;
      act(() => {
        card = result.current.quickAdd('Test');
      });
      expect(card!.id).toBeTruthy();
      expect(card!.title).toBe('Test');
    });
  });

  describe('move', () => {
    it('moves a card to a new column', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('Task');
      });
      const id = result.current.board.cards[0].id;
      act(() => {
        result.current.move(id, STATUS.LIVE);
      });
      expect(result.current.board.cards[0].status).toBe(STATUS.LIVE);
    });

    it('no-ops for nonexistent card id', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('Task');
      });
      const before = result.current.board;
      act(() => {
        result.current.move('nonexistent', STATUS.LIVE);
      });
      expect(result.current.board).toBe(before);
    });
  });

  describe('updateCard', () => {
    it('updates card fields', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('Original');
      });
      const card = result.current.board.cards[0];
      act(() => {
        result.current.updateCard({ ...card, title: 'Updated' });
      });
      expect(result.current.board.cards[0].title).toBe('Updated');
    });
  });

  describe('deleteCard', () => {
    it('removes a card', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('To delete');
      });
      const id = result.current.board.cards[0].id;
      act(() => {
        result.current.deleteCard(id);
      });
      expect(result.current.board.cards).toHaveLength(0);
    });
  });

  describe('restoreCard', () => {
    it('re-adds a previously deleted card', () => {
      const { result } = renderHook(() => useBoard());
      let card: ReturnType<typeof result.current.quickAdd>;
      act(() => {
        card = result.current.quickAdd('Restore me');
      });
      act(() => {
        result.current.deleteCard(card!.id);
      });
      expect(result.current.board.cards).toHaveLength(0);
      act(() => {
        result.current.restoreCard(card!);
      });
      expect(result.current.board.cards).toHaveLength(1);
      expect(result.current.board.cards[0].title).toBe('Restore me');
    });

    it('no-ops if card already exists', () => {
      const { result } = renderHook(() => useBoard());
      let card: ReturnType<typeof result.current.quickAdd>;
      act(() => {
        card = result.current.quickAdd('Already here');
      });
      act(() => {
        result.current.restoreCard(card!);
      });
      expect(result.current.board.cards).toHaveLength(1);
    });
  });

  describe('categories', () => {
    it('adds a category', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.addCategory('Work');
      });
      expect(result.current.board.categories).toContain('Work');
    });

    it('does not add duplicate categories', () => {
      const { result } = renderHook(() => useBoard());
      const before = result.current.board.categories.length;
      act(() => {
        result.current.addCategory('Personal');
      });
      expect(result.current.board.categories.length).toBe(before);
    });

    it('removes a category and clears it from cards', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('Tagged', { category: 'Personal' });
      });
      act(() => {
        result.current.removeCategory('Personal');
      });
      expect(result.current.board.categories).not.toContain('Personal');
      expect(result.current.board.cards[0].category).toBe('');
    });

    it('renames a category across all cards', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('Tagged', { category: 'Personal' });
      });
      act(() => {
        result.current.renameCategory('Personal', 'Private');
      });
      expect(result.current.board.categories).toContain('Private');
      expect(result.current.board.categories).not.toContain('Personal');
      expect(result.current.board.cards[0].category).toBe('Private');
    });

    it('rejects rename to existing category name', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.addCategory('Work');
      });
      const before = result.current.board;
      act(() => {
        result.current.renameCategory('Personal', 'Work');
      });
      expect(result.current.board).toBe(before);
    });
  });

  describe('setEnergyBudget', () => {
    it('updates the energy budget', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.setEnergyBudget(24);
      });
      expect(result.current.board.energyBudget).toBe(24);
    });

    it('clamps to minimum of 1', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.setEnergyBudget(0);
      });
      expect(result.current.board.energyBudget).toBe(1);
    });
  });

  describe('setLiveCapacity', () => {
    it('updates the live capacity', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.setLiveCapacity(10);
      });
      expect(result.current.board.liveCapacity).toBe(10);
    });

    it('clamps to minimum of 1', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.setLiveCapacity(-5);
      });
      expect(result.current.board.liveCapacity).toBe(1);
    });
  });

  describe('reorderBatch', () => {
    it('assigns sequential sort orders', () => {
      const { result } = renderHook(() => useBoard());
      act(() => {
        result.current.quickAdd('A');
        result.current.quickAdd('B');
        result.current.quickAdd('C');
      });
      const [a, b, c] = result.current.board.cards;
      act(() => {
        result.current.reorderBatch([c.id, a.id, b.id], c.id);
      });
      const cards = result.current.board.cards;
      const sorted = [...cards].sort((x, y) => x.sortOrder - y.sortOrder);
      expect(sorted.map((card) => card.id)).toEqual([c.id, a.id, b.id]);
    });
  });
});
