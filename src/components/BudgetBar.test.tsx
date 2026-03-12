import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BudgetBar } from './BudgetBar';

const defaultProps = {
  daily: [
    { date: '2026-03-11', used: 4 },
    { date: '2026-03-12', used: 2 },
    { date: '2026-03-13', used: 0 },
  ],
  dayLimit: 10,
  total: { used: 6, total: 40 },
  todayStr: '2026-03-11',
  onDayClick: vi.fn(),
};

describe('BudgetBar', () => {
  it('renders daily segments as clickable buttons', () => {
    render(<BudgetBar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('calls onDayClick with the correct date when a segment is clicked', () => {
    const onDayClick = vi.fn();
    render(<BudgetBar {...defaultProps} onDayClick={onDayClick} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // second day
    expect(onDayClick).toHaveBeenCalledWith('2026-03-12');
  });

  it('displays total usage', () => {
    render(<BudgetBar {...defaultProps} />);
    expect(screen.getByText('6/40')).toBeInTheDocument();
  });

  it('renders without daily segments when daily is empty', () => {
    render(<BudgetBar {...defaultProps} daily={[]} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('6/40')).toBeInTheDocument();
  });

  it('highlights today segment with bold text', () => {
    render(<BudgetBar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // First button is today — check for bold class
    const todayLabel = buttons[0].querySelector('.font-bold');
    expect(todayLabel).toBeInTheDocument();
  });
});
