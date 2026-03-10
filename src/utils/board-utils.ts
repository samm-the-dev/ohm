import type { OhmCard, OhmBoard, ColumnStatus } from '../types/board';
import { STATUS, ENERGY_DEFAULT } from '../types/board';

/** Generate a short unique ID */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a new card with minimal input (quick capture) */
export function createCard(
  title: string,
  overrides?: Partial<
    Pick<OhmCard, 'description' | 'energy' | 'category' | 'activityInstanceId' | 'scheduledDate'>
  >,
): OhmCard {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title,
    description: overrides?.description ?? '',
    status: STATUS.CHARGING,
    tasks: [],
    energy: overrides?.energy ?? ENERGY_DEFAULT,
    category: overrides?.category ?? '',
    createdAt: now,
    updatedAt: now,
    sortOrder: Date.now(),
    activityInstanceId: overrides?.activityInstanceId,
    scheduledDate: overrides?.scheduledDate,
  };
}

/** Move a card to a new column */
export function moveCard(card: OhmCard, newStatus: ColumnStatus): OhmCard {
  return {
    ...card,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
}

/** Get cards for a specific column, sorted by sortOrder */
export function getColumnCards(board: OhmBoard, status: ColumnStatus): OhmCard[] {
  return board.cards.filter((c) => c.status === status).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Get Live column capacity (WIP limit). Returns null for all other columns. */
export function getColumnCapacity(
  board: OhmBoard,
  status: ColumnStatus,
): { used: number; total: number } | null {
  if (status !== STATUS.LIVE) return null;
  const used = board.cards
    .filter((c) => c.status === STATUS.LIVE)
    .reduce((sum, c) => sum + c.energy, 0);
  return { used, total: board.liveCapacity };
}

/** Get total energy usage across non-Powered columns vs. the rolling-window budget. */
export function getTotalCapacity(board: OhmBoard): { used: number; total: number } {
  const used = board.cards
    .filter((c) => c.status !== STATUS.POWERED)
    .reduce((sum, c) => sum + c.energy, 0);
  return { used, total: board.energyBudget };
}

/** Effective date for a card: scheduledDate if set, otherwise updatedAt as YYYY-MM-DD. */
export function cardEffectiveDate(card: OhmCard): string {
  return card.scheduledDate ?? card.updatedAt.slice(0, 10);
}

/** Get total energy of Powered cards within a trailing date window. */
export function getTrailingPowered(
  board: OhmBoard,
  windowStart: string,
  windowEnd: string,
): { used: number; cards: OhmCard[] } {
  const cards = board.cards.filter((c) => {
    if (c.status !== STATUS.POWERED) return false;
    const d = cardEffectiveDate(c);
    return d >= windowStart && d <= windowEnd;
  });
  const used = cards.reduce((sum, c) => sum + c.energy, 0);
  return { used, cards };
}

/** Find Powered cards whose effective date is before the trailing window start. */
export function getExpiredPowered(board: OhmBoard, windowStart: string): OhmCard[] {
  return board.cards.filter(
    (c) => c.status === STATUS.POWERED && cardEffectiveDate(c) < windowStart,
  );
}

/** Get per-day energy usage for a date window. Returns entries sorted by date. */
export function getDailyEnergy(
  board: OhmBoard,
  windowStart: string,
  windowEnd: string,
): Array<{ date: string; used: number }> {
  // Build a map of date -> total energy
  const byDate = new Map<string, number>();
  for (const card of board.cards) {
    if (!card.scheduledDate) continue;
    if (card.scheduledDate < windowStart || card.scheduledDate > windowEnd) continue;
    byDate.set(card.scheduledDate, (byDate.get(card.scheduledDate) ?? 0) + card.energy);
  }
  // Fill in all days in the window (even zeros)
  const result: Array<{ date: string; used: number }> = [];
  const current = new Date(windowStart + 'T00:00:00');
  const end = new Date(windowEnd + 'T00:00:00');
  while (current <= end) {
    const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    result.push({ date: iso, used: byDate.get(iso) ?? 0 });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

/** Update a card in the board immutably */
export function updateCardInBoard(board: OhmBoard, updatedCard: OhmCard): OhmBoard {
  return {
    ...board,
    cards: board.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
    lastSaved: new Date().toISOString(),
  };
}

/** Add a card to the board */
export function addCardToBoard(board: OhmBoard, card: OhmCard): OhmBoard {
  return {
    ...board,
    cards: [...board.cards, card],
    lastSaved: new Date().toISOString(),
  };
}

/** Remove a card from the board */
export function removeCardFromBoard(board: OhmBoard, cardId: string): OhmBoard {
  return {
    ...board,
    cards: board.cards.filter((c) => c.id !== cardId),
    lastSaved: new Date().toISOString(),
  };
}
