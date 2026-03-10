import { createLocalStorage } from '../../.toolbox/lib/local-storage-sync';
import type { OhmBoard } from '../types/board';
import {
  createDefaultBoard,
  COLUMNS,
  STATUS,
  ENERGY_MIN,
  ENERGY_MAX,
  ENERGY_DEFAULT,
} from '../types/board';

/** Coerce invalid field values to safe defaults -- index-range validation */
export function sanitizeBoard(board: OhmBoard): OhmBoard {
  // Migrate from per-column capacities to unified energy budget
  const legacy = board as Record<string, unknown>;
  if ('chargingCapacity' in legacy && !('energyBudget' in legacy)) {
    const charging = typeof legacy.chargingCapacity === 'number' ? legacy.chargingCapacity : 12;
    const grounded = typeof legacy.groundedCapacity === 'number' ? legacy.groundedCapacity : 6;
    board.energyBudget = charging + grounded;
    delete legacy.chargingCapacity;
    delete legacy.groundedCapacity;
  }
  if (typeof board.energyBudget !== 'number' || !(board.energyBudget >= 1)) {
    board.energyBudget = 42;
  }
  if (typeof board.liveCapacity !== 'number' || !(board.liveCapacity >= 1)) {
    board.liveCapacity = 6;
  }

  if (!board.categoriesUpdatedAt) {
    board.categoriesUpdatedAt = board.lastSaved;
  }
  if (!board.capacitiesUpdatedAt) {
    board.capacitiesUpdatedAt = board.lastSaved;
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
