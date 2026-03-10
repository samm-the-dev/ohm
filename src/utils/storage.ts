import { createLocalStorage } from '../../.toolbox/lib/local-storage-sync';
import type { OhmBoard } from '../types/board';
import {
  createDefaultBoard,
  COLUMNS,
  STATUS,
  ENERGY_MIN,
  ENERGY_MAX,
  ENERGY_DEFAULT,
  WINDOW_MIN,
  WINDOW_MAX,
  BUDGET_DEFAULT,
  LIVE_DEFAULT,
} from '../types/board';

/** Coerce invalid field values to safe defaults -- index-range validation */
export function sanitizeBoard(board: OhmBoard): OhmBoard {
  if (typeof board.energyBudget !== 'number' || !(board.energyBudget >= 1)) {
    board.energyBudget = BUDGET_DEFAULT;
  }
  if (typeof board.liveCapacity !== 'number' || !(board.liveCapacity >= 1)) {
    board.liveCapacity = LIVE_DEFAULT;
  }

  if (board.windowSize != null) {
    if (typeof board.windowSize !== 'number' || !Number.isFinite(board.windowSize)) {
      delete board.windowSize;
    } else {
      board.windowSize = Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, board.windowSize));
    }
  }
  if (board.timeFeatures != null && typeof board.timeFeatures !== 'boolean') {
    board.timeFeatures = !!board.timeFeatures;
  }
  if (board.autoBudget != null && typeof board.autoBudget !== 'boolean') {
    board.autoBudget = !!board.autoBudget;
  }

  if (!board.categoriesUpdatedAt) {
    board.categoriesUpdatedAt = board.lastSaved;
  }
  if (!board.capacitiesUpdatedAt) {
    board.capacitiesUpdatedAt = board.lastSaved;
  }

  // Ensure activities is a valid array
  if (board.activities != null && !Array.isArray(board.activities)) {
    board.activities = [];
  }
  if (board.activities) {
    board.activities = board.activities
      .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
      .map((a) => (typeof a.sourceId === 'string' ? a : { ...a, sourceId: 'ohm' }));
  }

  for (const card of board.cards) {
    if (typeof card.energy !== 'number' || card.energy < ENERGY_MIN || card.energy > ENERGY_MAX) {
      card.energy = ENERGY_DEFAULT;
    }
    if (typeof card.status !== 'number' || card.status < 0 || card.status >= COLUMNS.length) {
      card.status = STATUS.CHARGING;
    }

    if (!Array.isArray(card.tasks)) {
      card.tasks = [];
    }
  }
  return board;
}

const localSync = createLocalStorage<OhmBoard>({
  storageKey: 'ohm-board',
  logPrefix: '[Ohm]',
  version: 1,
  sanitize: sanitizeBoard,
  createDefault: createDefaultBoard,
});

export const { saveToLocal, loadFromLocal, clearLocal } = localSync;
