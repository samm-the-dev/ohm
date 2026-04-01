import { createLocalStorage } from '../../.toolbox/lib/local-storage-sync';
import type { OhmBoard } from '../types/board';
import {
  createDefaultBoard,
  COLUMNS,
  STATUS,
  ENERGY_MIN,
  ENERGY_MAX_DEFAULT,
  ENERGY_DEFAULT,
  WINDOW_MIN,
  WINDOW_MAX,
  BUDGET_DEFAULT,
  LIVE_DEFAULT,
  DAILY_LIMIT_DEFAULT,
} from '../types/board';
import { storageService } from './storage-service';

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
  // Strip legacy timeFeatures field from old boards
  delete (board as unknown as Record<string, unknown>).timeFeatures;
  if (board.autoBudget != null && typeof board.autoBudget !== 'boolean') {
    board.autoBudget = !!board.autoBudget;
  }
  if (board.energyMax != null) {
    if (typeof board.energyMax !== 'number' || !Number.isFinite(board.energyMax)) {
      delete board.energyMax;
    } else {
      board.energyMax = Math.min(20, Math.max(ENERGY_MIN + 1, Math.round(board.energyMax)));
    }
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

  const maxEnergy = board.energyMax ?? ENERGY_MAX_DEFAULT;
  for (const card of board.cards) {
    if (typeof card.energy !== 'number' || card.energy < ENERGY_MIN) {
      card.energy = ENERGY_DEFAULT;
    } else if (card.energy > maxEnergy) {
      card.energy = maxEnergy;
    }
    if (typeof card.status !== 'number' || card.status < 0 || card.status >= COLUMNS.length) {
      card.status = STATUS.CHARGING;
    }

    if (!Array.isArray(card.tasks)) {
      card.tasks = [];
    }

    // Strip archivedAt from non-Powered cards (defensive cleanup)
    if (card.archivedAt && card.status !== STATUS.POWERED) {
      delete card.archivedAt;
    }
  }

  // Prune archived cards older than 14 days
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const pruneThreshold = fourteenDaysAgo.toISOString();
  board.cards = board.cards.filter((c) => !c.archivedAt || c.archivedAt > pruneThreshold);

  // Default dailyLimit if missing
  if (typeof board.dailyLimit !== 'number' || board.dailyLimit < 1) {
    board.dailyLimit = DAILY_LIMIT_DEFAULT;
  }

  // Default funSettings if missing or non-object
  if (!board.funSettings || typeof board.funSettings !== 'object') {
    board.funSettings = {};
  }

  return board;
}

const storage = await storageService;

const localSync = createLocalStorage<OhmBoard>({
  storageKey: 'ohm-board',
  logPrefix: '[Ohm]',
  version: 1,
  sanitize: sanitizeBoard,
  createDefault: createDefaultBoard,
  storage,
});

const { saveToLocal: rawSave, loadFromLocal, clearLocal, recoverFromStorage } = localSync;

/** Strip non-edited activity cards -- they get re-materialized from Dexie on load */
export function stripTransientCards(board: OhmBoard): OhmBoard {
  const persistCards = board.cards.filter((c) => !c.activityInstanceId || c.edited);
  return persistCards.length === board.cards.length ? board : { ...board, cards: persistCards };
}

const saveToLocal = (board: OhmBoard) => {
  rawSave(stripTransientCards(board));
};

export { saveToLocal, loadFromLocal, clearLocal, recoverFromStorage };
