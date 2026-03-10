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

/** Move a card to a new column.
 *  Live sets scheduledDate to today (counts toward daily energy).
 *  Grounded clears scheduledDate (paused = no date). */
export function moveCard(card: OhmCard, newStatus: ColumnStatus): OhmCard {
  const now = new Date();
  return {
    ...card,
    status: newStatus,
    ...(newStatus === STATUS.LIVE ? { scheduledDate: now.toISOString().slice(0, 10) } : {}),
    ...(newStatus === STATUS.GROUNDED ? { scheduledDate: undefined } : {}),
    updatedAt: now.toISOString(),
  };
}

/** Get cards for a specific column, sorted by scheduledDate (ascending, unscheduled last)
 *  then sortOrder as tiebreaker within the same date group. */
export function getColumnCards(board: OhmBoard, status: ColumnStatus): OhmCard[] {
  return board.cards
    .filter((c) => c.status === status)
    .sort((a, b) => {
      const dateA = a.scheduledDate ?? '\uffff';
      const dateB = b.scheduledDate ?? '\uffff';
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
}

/** Get Live column capacity (WIP limit). Returns null for all other columns.
 *  Includes today's Powered cards — energy spent today counts against capacity. */
export function getColumnCapacity(
  board: OhmBoard,
  status: ColumnStatus,
  today?: string,
): { used: number; total: number } | null {
  if (status !== STATUS.LIVE) return null;
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const used = board.cards
    .filter(
      (c) =>
        c.status === STATUS.LIVE ||
        (c.status === STATUS.POWERED && cardEffectiveDate(c) === todayStr),
    )
    .reduce((sum, c) => sum + c.energy, 0);
  return { used, total: board.liveCapacity };
}

/** Get total energy usage for the rolling window vs. the budget.
 *  Grounded cards are paused/deferred and never count.
 *  Live cards always count (active now).
 *  Powered cards count if their effective date falls within the window.
 *  Charging cards count if they have no date or their date is within the window.
 *  When no window is provided (time features off), counts all non-Grounded cards. */
export function getTotalCapacity(
  board: OhmBoard,
  windowStart?: string,
  windowEnd?: string,
): { used: number; total: number } {
  const used = board.cards
    .filter((c) => {
      if (c.status === STATUS.GROUNDED) return false;
      if (!windowStart || !windowEnd) return true;
      if (c.status === STATUS.LIVE) return true;
      // Powered: count if effective date is in window
      if (c.status === STATUS.POWERED) {
        const d = cardEffectiveDate(c);
        return d >= windowStart && d <= windowEnd;
      }
      // Charging: count if no date or date is in window
      if (!c.scheduledDate) return true;
      return c.scheduledDate >= windowStart && c.scheduledDate <= windowEnd;
    })
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

/** Get per-day energy usage for a date window (excludes Grounded). Returns entries sorted by date. */
export function getDailyEnergy(
  board: OhmBoard,
  windowStart: string,
  windowEnd: string,
): Array<{ date: string; used: number }> {
  // Build a map of date -> total energy (exclude Grounded — paused/deferred)
  const byDate = new Map<string, number>();
  for (const card of board.cards) {
    if (!card.scheduledDate || card.status === STATUS.GROUNDED) continue;
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
