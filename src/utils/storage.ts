import type { OhmBoard } from '../types/board';
import { createDefaultBoard, ENERGY_CONFIG, COLUMNS, STATUS, ENERGY } from '../types/board';

const STORAGE_KEY = 'ohm-board';

/** Coerce invalid field values to safe defaults -- index-range validation */
export function sanitizeBoard(board: OhmBoard): OhmBoard {
  if (typeof board.chargingCapacity !== 'number' || board.chargingCapacity < 1) {
    board.chargingCapacity = 12;
  }
  if (typeof board.liveCapacity !== 'number' || board.liveCapacity < 1) {
    board.liveCapacity = 6;
  }
  if (typeof board.groundedCapacity !== 'number' || board.groundedCapacity < 1) {
    board.groundedCapacity = 6;
  }

  if (!board.categoriesUpdatedAt) {
    board.categoriesUpdatedAt = board.lastSaved;
  }
  if (!board.capacitiesUpdatedAt) {
    board.capacitiesUpdatedAt = board.lastSaved;
  }

  for (const card of board.cards) {
    if (typeof card.energy !== 'number' || card.energy < 0 || card.energy >= ENERGY_CONFIG.length) {
      card.energy = ENERGY.MED;
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

/** Save board to localStorage (fallback / offline mode) */
export function saveToLocal(board: OhmBoard): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch (e) {
    console.error('[Ohm] Failed to save to localStorage:', e);
  }
}

/** Load board from localStorage */
export function loadFromLocal(): OhmBoard {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OhmBoard;
      if (parsed.version === 1) {
        return sanitizeBoard(parsed);
      }
    }
  } catch (e) {
    console.error('[Ohm] Failed to load from localStorage:', e);
  }
  return createDefaultBoard();
}

/** Clear local storage */
export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[Ohm] Failed to clear localStorage:', e);
  }
}
