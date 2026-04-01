import type { OhmCard, OhmBoard, ColumnStatus } from '../types/board';
import { STATUS, ENERGY_DEFAULT, DAILY_LIMIT_DEFAULT } from '../types/board';
import { toISODate } from './schedule-utils';

/** A group of cards sharing the same scheduledDate (or unscheduled). */
export interface DayGroup {
  /** Date string (YYYY-MM-DD) or 'unscheduled' */
  key: string;
  /** Human-readable label: "Today", "Tomorrow", "Wed Mar 12", "Unscheduled" */
  label: string;
  cards: OhmCard[];
  energyTotal: number;
  isPast: boolean;
  isToday: boolean;
}

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
    ...(newStatus === STATUS.LIVE ? { scheduledDate: toISODate(now) } : {}),
    ...(newStatus === STATUS.GROUNDED ? { scheduledDate: undefined } : {}),
    updatedAt: now.toISOString(),
  };
}

/** Get cards for a specific column, sorted by scheduledDate (ascending, unscheduled last)
 *  then sortOrder as tiebreaker within the same date group. */
export function getColumnCards(board: OhmBoard, status: ColumnStatus): OhmCard[] {
  return board.cards
    .filter((c) => c.status === status && !c.archivedAt)
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
  const todayStr = today ?? toISODate(new Date());
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

/** Per-day item count and average energy for the BudgetBar.
 *  Counts cards (not energy) per day in the forward window.
 *  Live cards are assigned to today. Grounded cards excluded. */
export function getDailyItemCounts(
  board: OhmBoard,
  todayStr: string,
  windowEnd: string,
): Array<{ date: string; count: number; avgEnergy: number }> {
  const limit = board.dailyLimit ?? DAILY_LIMIT_DEFAULT;
  const byDate = new Map<string, { count: number; totalEnergy: number }>();

  for (const card of board.cards) {
    if (card.status === STATUS.GROUNDED || card.archivedAt) continue;
    let date: string;
    if (card.status === STATUS.LIVE) {
      date = todayStr;
    } else if (card.status === STATUS.POWERED) {
      date = cardEffectiveDate(card);
    } else {
      if (!card.scheduledDate) continue;
      date = card.scheduledDate;
    }
    if (date < todayStr || date > windowEnd) continue;
    const entry = byDate.get(date) ?? { count: 0, totalEnergy: 0 };
    entry.count++;
    entry.totalEnergy += card.energy;
    byDate.set(date, entry);
  }

  const result: Array<{ date: string; count: number; avgEnergy: number }> = [];
  const current = new Date(todayStr + 'T00:00:00');
  const end = new Date(windowEnd + 'T00:00:00');
  while (current <= end) {
    const iso = toISODate(current);
    const entry = byDate.get(iso);
    const count = entry?.count ?? 0;
    const avgEnergy = count > 0 ? entry!.totalEnergy / count : 0;
    result.push({ date: iso, count, avgEnergy });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

/** Total item count across a forward window (excludes Grounded). */
export function getTotalItemCount(
  board: OhmBoard,
  todayStr: string,
  windowEnd: string,
): { count: number; limit: number } {
  const dailyLimit = board.dailyLimit ?? DAILY_LIMIT_DEFAULT;
  let count = 0;
  for (const card of board.cards) {
    if (card.status === STATUS.GROUNDED || card.archivedAt) continue;
    if (card.status === STATUS.LIVE) {
      count++;
      continue;
    }
    if (card.status === STATUS.POWERED) {
      const d = cardEffectiveDate(card);
      if (d >= todayStr && d <= windowEnd) count++;
      continue;
    }
    // Charging
    if (card.scheduledDate && card.scheduledDate >= todayStr && card.scheduledDate <= windowEnd) {
      count++;
    }
  }
  // Total limit = dailyLimit * number of days in window
  const start = new Date(todayStr + 'T00:00:00');
  const end = new Date(windowEnd + 'T00:00:00');
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return { count, limit: dailyLimit * days };
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

/** Format a date label relative to today: "Today", "Tomorrow", "Wed Mar 12", etc. */
function formatDayLabel(dateStr: string, today: string, tomorrow: string): string {
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Group already-sorted cards by scheduledDate into DayGroup[].
 *  Cards without a scheduledDate go into an "Unscheduled" group at the end. */
export function groupCardsByDate(cards: OhmCard[], today: string, desc = false): DayGroup[] {
  const tomorrowDate = new Date(today + 'T00:00:00');
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

  const groupMap = new Map<string, OhmCard[]>();
  for (const card of cards) {
    const key = card.scheduledDate ?? 'unscheduled';
    const list = groupMap.get(key);
    if (list) list.push(card);
    else groupMap.set(key, [card]);
  }

  const groups: DayGroup[] = [];
  for (const [key, groupCards] of groupMap) {
    if (key === 'unscheduled') continue; // added last
    groups.push({
      key,
      label: formatDayLabel(key, today, tomorrow),
      cards: groupCards,
      energyTotal: groupCards.reduce((sum, c) => sum + c.energy, 0),
      isPast: key < today,
      isToday: key === today,
    });
  }

  groups.sort((a, b) => (desc ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));

  const unscheduled = groupMap.get('unscheduled');
  if (unscheduled) {
    groups.push({
      key: 'unscheduled',
      label: 'Unscheduled',
      cards: unscheduled,
      energyTotal: unscheduled.reduce((sum, c) => sum + c.energy, 0),
      isPast: false,
      isToday: false,
    });
  }

  return groups;
}

/** Get all non-Grounded cards for a specific date, sorted by status then sortOrder. */
export function getCardsForDate(board: OhmBoard, date: string): OhmCard[] {
  return board.cards
    .filter((c) => c.status !== STATUS.GROUNDED && c.scheduledDate === date)
    .sort((a, b) => a.status - b.status || a.sortOrder - b.sortOrder);
}
