import { useState, useCallback, useEffect, useRef } from 'react';
import type { OhmBoard, OhmCard, ColumnStatus } from '../types/board';
import { STATUS } from '../types/board';
import { loadFromLocal, saveToLocal } from '../utils/storage';
import {
  createCard,
  moveCard,
  addCardToBoard,
  updateCardInBoard,
  removeCardFromBoard,
} from '../utils/board-utils';

/** Debounce save to avoid excessive writes */
function useDebouncedSave(board: OhmBoard, delayMs = 500) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      saveToLocal(board);
    }, delayMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [board, delayMs]);
}

export function useBoard() {
  const [board, setBoard] = useState<OhmBoard>(() => loadFromLocal());

  // Auto-save on changes
  useDebouncedSave(board);

  /** Quick-add a card to Charging (minimal friction, optional details) */
  const quickAdd = useCallback(
    (title: string, overrides?: Partial<Pick<OhmCard, 'description' | 'energy' | 'category'>>) => {
      const card = createCard(title, overrides);
      setBoard((prev) => addCardToBoard(prev, card));
      return card;
    },
    [],
  );

  /** Move a card to a new status */
  const move = useCallback((cardId: string, newStatus: ColumnStatus) => {
    setBoard((prev) => {
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card) return prev;
      const updated = moveCard(card, newStatus);
      return updateCardInBoard(prev, updated);
    });
  }, []);

  /** Update any card fields */
  const updateCard = useCallback((updatedCard: OhmCard) => {
    setBoard((prev) => updateCardInBoard(prev, updatedCard));
  }, []);

  /** Delete a card */
  const deleteCard = useCallback((cardId: string) => {
    setBoard((prev) => removeCardFromBoard(prev, cardId));
  }, []);

  /** Restore a previously deleted card (idempotent — no-op if already present) */
  const restoreCard = useCallback((card: OhmCard) => {
    setBoard((prev) => {
      if (prev.cards.some((c) => c.id === card.id)) return prev;
      return addCardToBoard(prev, card);
    });
  }, []);

  /** Reorder a card within a column */
  const reorder = useCallback((cardId: string, newSortOrder: number) => {
    setBoard((prev) => {
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card) return prev;
      return updateCardInBoard(prev, {
        ...card,
        sortOrder: newSortOrder,
        updatedAt: new Date().toISOString(),
      });
    });
  }, []);

  /** Reorder multiple cards at once (assign sequential sort orders) */
  const reorderBatch = useCallback((orderedIds: string[], draggedId: string) => {
    setBoard((prev) => {
      const now = new Date().toISOString();
      return {
        ...prev,
        cards: prev.cards.map((c) => {
          const newIndex = orderedIds.indexOf(c.id);
          if (newIndex === -1) return c;
          return {
            ...c,
            sortOrder: newIndex,
            updatedAt: c.id === draggedId ? now : c.updatedAt,
          };
        }),
        lastSaved: now,
      };
    });
  }, []);

  /** Update column capacity (energy segments) */
  const setCapacity = useCallback((status: ColumnStatus, capacity: number) => {
    const field =
      status === STATUS.CHARGING
        ? 'chargingCapacity'
        : status === STATUS.LIVE
          ? 'liveCapacity'
          : status === STATUS.GROUNDED
            ? 'groundedCapacity'
            : null;
    if (!field) return;
    const now = new Date().toISOString();
    setBoard((prev) => ({ ...prev, [field]: capacity, capacitiesUpdatedAt: now, lastSaved: now }));
  }, []);

  /** Add a category to the board */
  const addCategory = useCallback((category: string) => {
    setBoard((prev) => {
      if (prev.categories.includes(category)) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        categories: [...prev.categories, category],
        categoriesUpdatedAt: now,
        lastSaved: now,
      };
    });
  }, []);

  /** Remove a category from the board and clear it from any cards using it */
  const removeCategory = useCallback((category: string) => {
    setBoard((prev) => {
      if (!prev.categories.includes(category)) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        categories: prev.categories.filter((c) => c !== category),
        cards: prev.cards.map((card) =>
          card.category === category ? { ...card, category: '', updatedAt: now } : card,
        ),
        categoriesUpdatedAt: now,
        lastSaved: now,
      };
    });
  }, []);

  /** Rename a category and update all cards using it */
  const renameCategory = useCallback((oldName: string, newName: string) => {
    setBoard((prev) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return prev;
      if (!prev.categories.includes(oldName)) return prev;
      if (prev.categories.includes(trimmed)) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        categories: prev.categories.map((c) => (c === oldName ? trimmed : c)),
        cards: prev.cards.map((card) =>
          card.category === oldName ? { ...card, category: trimmed, updatedAt: now } : card,
        ),
        categoriesUpdatedAt: now,
        lastSaved: now,
      };
    });
  }, []);

  /** Replace the entire board (used by Drive sync when remote is newer) */
  const replaceBoard = useCallback((newBoard: OhmBoard) => {
    setBoard(newBoard);
    saveToLocal(newBoard);
  }, []);

  return {
    board,
    quickAdd,
    move,
    updateCard,
    deleteCard,
    restoreCard,
    reorder,
    reorderBatch,
    setCapacity,
    addCategory,
    removeCategory,
    renameCategory,
    replaceBoard,
  };
}
