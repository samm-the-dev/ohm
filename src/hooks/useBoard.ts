import { useState, useCallback, useEffect, useRef } from 'react';
import type { OhmBoard, OhmCard, ColumnStatus } from '../types/board';
import { WINDOW_MIN, WINDOW_MAX, WINDOW_DEFAULT } from '../types/board';
import type { Activity } from '../types/activity';
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
    (
      title: string,
      overrides?: Partial<
        Pick<
          OhmCard,
          'description' | 'energy' | 'category' | 'activityInstanceId' | 'scheduledDate'
        >
      >,
    ) => {
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

  /** Delete multiple cards in a single state update */
  const deleteCards = useCallback((cardIds: string[]) => {
    if (cardIds.length === 0) return;
    const idSet = new Set(cardIds);
    setBoard((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => !idSet.has(c.id)),
      lastSaved: new Date().toISOString(),
    }));
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

  /** Update energy budget for the rolling window */
  const setEnergyBudget = useCallback((budget: number) => {
    const now = new Date().toISOString();
    setBoard((prev) => ({
      ...prev,
      energyBudget: Math.max(1, budget),
      capacitiesUpdatedAt: now,
      lastSaved: now,
    }));
  }, []);

  /** Update Live column capacity */
  const setLiveCapacity = useCallback((capacity: number) => {
    const now = new Date().toISOString();
    setBoard((prev) => {
      const newLive = Math.max(1, capacity);
      return {
        ...prev,
        liveCapacity: newLive,
        ...(prev.autoBudget ? { energyBudget: (prev.windowSize ?? WINDOW_DEFAULT) * newLive } : {}),
        capacitiesUpdatedAt: now,
        lastSaved: now,
      };
    });
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

  /** Remove a category from the board and clear it from any cards and activities using it */
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
        activities: prev.activities?.map((a) =>
          a.category === category ? { ...a, category: undefined } : a,
        ),
        categoriesUpdatedAt: now,
        lastSaved: now,
      };
    });
  }, []);

  /** Rename a category and update all cards and activities using it */
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
        activities: prev.activities?.map((a) =>
          a.category === oldName ? { ...a, category: trimmed } : a,
        ),
        categoriesUpdatedAt: now,
        lastSaved: now,
      };
    });
  }, []);

  /** Toggle time features on/off. Disabling also turns off autoBudget. */
  const setTimeFeatures = useCallback((enabled: boolean) => {
    const now = new Date().toISOString();
    setBoard((prev) => ({
      ...prev,
      timeFeatures: enabled,
      ...(!enabled && prev.autoBudget ? { autoBudget: false } : {}),
      lastSaved: now,
    }));
  }, []);

  /** Update rolling window size */
  const setWindowSize = useCallback((size: number) => {
    const now = new Date().toISOString();
    setBoard((prev) => {
      const newSize = Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, size));
      return {
        ...prev,
        windowSize: newSize,
        ...(prev.autoBudget ? { energyBudget: newSize * prev.liveCapacity } : {}),
        lastSaved: now,
      };
    });
  }, []);

  /** Toggle auto-budget (Total = Window x Live) */
  const setAutoBudget = useCallback((enabled: boolean) => {
    const now = new Date().toISOString();
    setBoard((prev) => ({
      ...prev,
      autoBudget: enabled,
      ...(enabled ? { energyBudget: (prev.windowSize ?? WINDOW_DEFAULT) * prev.liveCapacity } : {}),
      capacitiesUpdatedAt: now,
      lastSaved: now,
    }));
  }, []);

  /** Atomically add cards for activity instances not yet linked to a card.
   *  Uses functional update so it's safe under React strict mode double-runs. */
  const materializeInstances = useCallback(
    (
      specs: Array<{
        title: string;
        energy: OhmCard['energy'];
        category?: string;
        activityInstanceId: string;
        scheduledDate: string;
      }>,
    ) => {
      if (specs.length === 0) return;
      setBoard((prev) => {
        const linkedIds = new Set(prev.cards.map((c) => c.activityInstanceId).filter(Boolean));
        const newCards = specs
          .filter((s) => !linkedIds.has(s.activityInstanceId))
          .map((s) =>
            createCard(s.title, {
              energy: s.energy,
              category: s.category ?? '',
              activityInstanceId: s.activityInstanceId,
              scheduledDate: s.scheduledDate,
            }),
          );
        if (newCards.length === 0) return prev;
        return {
          ...prev,
          cards: [...prev.cards, ...newCards],
          lastSaved: new Date().toISOString(),
        };
      });
    },
    [],
  );

  /** Update activities array (functional updater to avoid stale closures) */
  const setActivities = useCallback((updater: (prev: Activity[]) => Activity[]) => {
    const now = new Date().toISOString();
    setBoard((prev) => ({
      ...prev,
      activities: updater(prev.activities ?? []),
      activitiesUpdatedAt: now,
      lastSaved: now,
    }));
  }, []);

  /** Replace the entire board (used by Drive sync when remote is newer, or import).
   *  When activities differ, clears Dexie instances and strips stale activityInstanceId
   *  references from cards so the materialization flow cleanly regenerates them. */
  const replaceBoard = useCallback(
    (newBoard: OhmBoard) => {
      const prevIds = new Set((board.activities ?? []).map((a) => a.id));
      const nextIds = new Set((newBoard.activities ?? []).map((a) => a.id));
      const activitiesChanged =
        prevIds.size !== nextIds.size || [...prevIds].some((id) => !nextIds.has(id));

      if (activitiesChanged) {
        const cleaned: OhmBoard = {
          ...newBoard,
          cards: newBoard.cards.map((c) =>
            c.activityInstanceId ? { ...c, activityInstanceId: undefined } : c,
          ),
        };
        setBoard(cleaned);
        saveToLocal(cleaned);

        // Clear stale Dexie instances — refreshWindow will regenerate them
        void (async () => {
          const { db } = await import('../db');
          await db.instances.clear();
        })();
      } else {
        setBoard(newBoard);
        saveToLocal(newBoard);
      }
    },
    [board.activities],
  );

  return {
    board,
    quickAdd,
    move,
    updateCard,
    deleteCard,
    deleteCards,
    restoreCard,
    reorder,
    reorderBatch,
    setEnergyBudget,
    setLiveCapacity,
    addCategory,
    removeCategory,
    renameCategory,
    setTimeFeatures,
    setWindowSize,
    setAutoBudget,
    setActivities,
    materializeInstances,
    replaceBoard,
  };
}
