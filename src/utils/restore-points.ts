import type { OhmBoard } from '../types/board';
import { sanitizeBoard } from './storage';

const RP_KEY = 'ohm-restore-points';
const MAX_RESTORE_POINTS = 10;

export interface RestorePoint {
  id: string;
  label: string;
  createdAt: string;
  board: OhmBoard;
}

/** Load all restore points from localStorage */
export function getRestorePoints(): RestorePoint[] {
  try {
    const raw = localStorage.getItem(RP_KEY);
    if (raw) return JSON.parse(raw) as RestorePoint[];
  } catch (e) {
    console.error('[Ohm] Failed to load restore points:', e);
  }
  return [];
}

/** Save a snapshot of the board. Evicts oldest if over limit. */
export function createRestorePoint(board: OhmBoard, label: string): void {
  try {
    const points = getRestorePoints();
    const now = new Date().toISOString();
    points.push({ id: now, label, createdAt: now, board: structuredClone(board) });
    // Evict oldest beyond limit
    while (points.length > MAX_RESTORE_POINTS) points.shift();
    localStorage.setItem(RP_KEY, JSON.stringify(points));
  } catch (e) {
    console.error('[Ohm] Failed to create restore point:', e);
  }
}

/** Delete a restore point by ID */
export function deleteRestorePoint(id: string): void {
  try {
    const points = getRestorePoints().filter((p) => p.id !== id);
    localStorage.setItem(RP_KEY, JSON.stringify(points));
  } catch (e) {
    console.error('[Ohm] Failed to delete restore point:', e);
  }
}

/** Trigger a JSON file download of the board */
export function exportBoard(board: OhmBoard): void {
  const json = JSON.stringify(board, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ohm-board-${date}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Parse and validate a JSON file as an OhmBoard */
export async function importBoard(file: File): Promise<OhmBoard> {
  const text = await file.text();
  const parsed = JSON.parse(text) as OhmBoard;
  if (parsed.version !== 1 || !Array.isArray(parsed.cards)) {
    throw new Error('Invalid board file');
  }
  return sanitizeBoard(parsed);
}

/** Smart merge: match cards by id, keep newer; union categories; newer capacities */
export function mergeBoards(local: OhmBoard, imported: OhmBoard): OhmBoard {
  const now = new Date().toISOString();

  // -- Cards: match by id, keep newer updatedAt --
  const localById = new Map<string, import('../types/board').OhmCard>();
  for (const card of local.cards) {
    localById.set(card.id, card);
  }

  const mergedCards: import('../types/board').OhmCard[] = [];
  const matchedIds = new Set<string>();

  for (const importedCard of imported.cards) {
    const localCard = localById.get(importedCard.id);
    if (localCard) {
      matchedIds.add(importedCard.id);
      // Keep whichever was updated more recently
      mergedCards.push(importedCard.updatedAt > localCard.updatedAt ? importedCard : localCard);
    } else {
      // Card only in import -- add it
      mergedCards.push(importedCard);
    }
  }

  // Cards only in local: keep if created after the remote snapshot (new offline card),
  // discard if created before (was deleted on the remote side).
  const remoteSnapshot = imported.lastSaved;
  for (const card of local.cards) {
    if (!matchedIds.has(card.id)) {
      if (card.createdAt >= remoteSnapshot) {
        mergedCards.push(card);
      }
    }
  }

  // -- Categories: union --
  const mergedCategories = Array.from(new Set([...local.categories, ...imported.categories]));
  const categoriesChanged = mergedCategories.length !== local.categories.length;

  // -- Capacities: take from whichever board has a newer capacitiesUpdatedAt --
  const localCapTs = local.capacitiesUpdatedAt ?? local.lastSaved;
  const importCapTs = imported.capacitiesUpdatedAt ?? imported.lastSaved;
  const useImportedCapacities = importCapTs > localCapTs;

  return {
    version: 1,
    cards: mergedCards,
    categories: mergedCategories,
    categoriesUpdatedAt: categoriesChanged ? now : (local.categoriesUpdatedAt ?? local.lastSaved),
    energyBudget: useImportedCapacities ? imported.energyBudget : local.energyBudget,
    liveCapacity: useImportedCapacities ? imported.liveCapacity : local.liveCapacity,
    capacitiesUpdatedAt: useImportedCapacities ? importCapTs : localCapTs,
    timeFeatures: local.timeFeatures ?? imported.timeFeatures,
    windowSize: local.windowSize ?? imported.windowSize,
    autoBudget: local.autoBudget ?? imported.autoBudget,
    lastSaved: now,
  };
}
