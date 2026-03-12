import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayFocusDialog } from './DayFocusDialog';
import { STATUS, createDefaultBoard } from '../types/board';
import type { OhmBoard, OhmCard } from '../types/board';

function makeCard(overrides: Partial<OhmCard> = {}): OhmCard {
  return {
    id: 'test-1',
    title: 'Test card',
    description: '',
    status: STATUS.CHARGING,
    tasks: [],
    energy: 4,
    category: 'Work',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
    ...overrides,
  };
}

function makeBoard(overrides: Partial<OhmBoard> = {}): OhmBoard {
  return { ...createDefaultBoard(), ...overrides };
}

const defaultProps = {
  date: '2026-03-11',
  todayStr: '2026-03-11',
  energyMax: 7,
  onReschedule: vi.fn(),
  onClose: vi.fn(),
};

describe('DayFocusDialog', () => {
  it('shows empty state when no cards match the date', () => {
    render(<DayFocusDialog {...defaultProps} board={makeBoard()} />);
    expect(screen.getByText('No cards scheduled for this day')).toBeInTheDocument();
  });

  it('shows cards grouped by status', () => {
    const board = makeBoard({
      cards: [
        makeCard({
          id: 'a',
          title: 'Charging task',
          status: STATUS.CHARGING,
          scheduledDate: '2026-03-11',
        }),
        makeCard({ id: 'b', title: 'Live task', status: STATUS.LIVE, scheduledDate: '2026-03-11' }),
      ],
    });
    render(<DayFocusDialog {...defaultProps} board={board} />);
    expect(screen.getByText('Charging task')).toBeInTheDocument();
    expect(screen.getByText('Live task')).toBeInTheDocument();
    // Status labels appear in both group headers and card badges
    expect(screen.getAllByText('Charging').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Live').length).toBeGreaterThanOrEqual(1);
  });

  it('excludes grounded cards', () => {
    const board = makeBoard({
      cards: [
        makeCard({
          id: 'a',
          title: 'Grounded task',
          status: STATUS.GROUNDED,
          scheduledDate: '2026-03-11',
        }),
        makeCard({ id: 'b', title: 'Live task', status: STATUS.LIVE, scheduledDate: '2026-03-11' }),
      ],
    });
    render(<DayFocusDialog {...defaultProps} board={board} />);
    expect(screen.queryByText('Grounded task')).not.toBeInTheDocument();
    expect(screen.getByText('Live task')).toBeInTheDocument();
  });

  it('calls onReschedule with tomorrow date when Tomorrow button is clicked', () => {
    const onReschedule = vi.fn();
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', title: 'Task', status: STATUS.CHARGING, scheduledDate: '2026-03-11' }),
      ],
    });
    render(<DayFocusDialog {...defaultProps} board={board} onReschedule={onReschedule} />);
    const tomorrowBtn = screen.getByTitle('Move to tomorrow');
    fireEvent.click(tomorrowBtn);
    expect(onReschedule).toHaveBeenCalledWith('a', '2026-03-12');
  });

  it('calls onReschedule with undefined when Clear button is clicked', () => {
    const onReschedule = vi.fn();
    const board = makeBoard({
      cards: [
        makeCard({ id: 'a', title: 'Task', status: STATUS.CHARGING, scheduledDate: '2026-03-11' }),
      ],
    });
    render(<DayFocusDialog {...defaultProps} board={board} onReschedule={onReschedule} />);
    const clearBtn = screen.getByTitle('Clear scheduled date');
    fireEvent.click(clearBtn);
    expect(onReschedule).toHaveBeenCalledWith('a', undefined);
  });

  it('shows Today as header label when date equals todayStr', () => {
    const board = makeBoard({
      cards: [makeCard({ id: 'a', status: STATUS.LIVE, scheduledDate: '2026-03-11' })],
    });
    render(<DayFocusDialog {...defaultProps} board={board} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('hides action buttons for powered cards', () => {
    const board = makeBoard({
      cards: [
        makeCard({
          id: 'a',
          title: 'Done task',
          status: STATUS.POWERED,
          scheduledDate: '2026-03-11',
        }),
      ],
    });
    render(<DayFocusDialog {...defaultProps} board={board} />);
    expect(screen.getByText('Done task')).toBeInTheDocument();
    expect(screen.queryByTitle('Move to tomorrow')).not.toBeInTheDocument();
  });
});
