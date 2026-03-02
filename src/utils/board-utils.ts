import type { OhmCard, OhmBoard, ColumnStatus } from '../types/board';
import { STATUS, ENERGY, ENERGY_SEGMENTS } from '../types/board';

/** Generate a short unique ID */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a new card with minimal input (quick capture) */
export function createCard(
  title: string,
  overrides?: Partial<Pick<OhmCard, 'description' | 'energy' | 'category'>>,
): OhmCard {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title,
    description: overrides?.description ?? '',
    status: STATUS.CHARGING,
    tasks: [],
    energy: overrides?.energy ?? ENERGY.MED,
    category: overrides?.category ?? '',
    createdAt: now,
    updatedAt: now,
    sortOrder: Date.now(),
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

/** Capacity field names indexed by ColumnStatus (Powered has no capacity) */
const CAPACITY_FIELDS = [
  'chargingCapacity', // STATUS.CHARGING = 0
  'groundedCapacity', // STATUS.GROUNDED = 1
  'liveCapacity', // STATUS.LIVE = 2
  null, // STATUS.POWERED = 3 (no capacity)
] as const satisfies readonly (keyof OhmBoard | null)[];

/** Get column capacity usage in energy segments. Returns null for columns without capacity. */
export function getColumnCapacity(
  board: OhmBoard,
  status: ColumnStatus,
): { used: number; total: number } | null {
  const field = CAPACITY_FIELDS[status];
  if (!field) return null;
  const used = board.cards
    .filter((c) => c.status === status)
    .reduce((sum, c) => sum + ENERGY_SEGMENTS[c.energy]!, 0);
  return { used, total: board[field] };
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
