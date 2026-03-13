import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsPage, type SettingsPageProps } from './SettingsPage';

const noop = () => {};

function defaultProps(overrides?: Partial<SettingsPageProps>): SettingsPageProps {
  return {
    isOpen: true,
    onClose: vi.fn(),
    categories: ['Work', 'Personal'],
    onAddCategory: noop,
    onRemoveCategory: noop,
    onRenameCategory: noop,
    energyBudget: 6,
    liveCapacity: 3,
    onSetEnergyBudget: noop,
    onSetLiveCapacity: noop,
    board: {
      cards: [],
      categories: ['Work', 'Personal'],
      liveCapacity: 3,
      energyBudget: 6,
      lastSaved: '',
    } as SettingsPageProps['board'],
    onReplaceBoard: noop,
    ...overrides,
  };
}

describe('SettingsPage a11y', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('dialog role', () => {
    it('renders with role="dialog" and aria-label', () => {
      render(<SettingsPage {...defaultProps()} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Settings');
    });

    it('does not render when closed', () => {
      render(<SettingsPage {...defaultProps({ isOpen: false })} />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('ARIA tabs', () => {
    it('renders a tablist with correct tab roles', () => {
      render(<SettingsPage {...defaultProps()} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('marks only the active tab as aria-selected with tabIndex 0', () => {
      render(<SettingsPage {...defaultProps()} />);
      const tabs = screen.getAllByRole('tab');
      const board = tabs.find((t) => t.id === 'tab-board')!;
      const schedule = tabs.find((t) => t.id === 'tab-schedule')!;
      const data = tabs.find((t) => t.id === 'tab-data')!;

      expect(board).toHaveAttribute('aria-selected', 'true');
      expect(board).toHaveAttribute('tabindex', '0');
      expect(schedule).toHaveAttribute('aria-selected', 'false');
      expect(schedule).toHaveAttribute('tabindex', '-1');
      expect(data).toHaveAttribute('aria-selected', 'false');
      expect(data).toHaveAttribute('tabindex', '-1');
    });

    it('links tabs to tabpanel via aria-controls', () => {
      render(<SettingsPage {...defaultProps()} />);
      const boardTab = screen.getByRole('tab', { selected: true });
      const panelId = boardTab.getAttribute('aria-controls');
      expect(panelId).toBe('tabpanel-board');
      expect(screen.getByRole('tabpanel')).toHaveAttribute('id', panelId);
    });

    it('tabpanel has aria-labelledby pointing to active tab', () => {
      render(<SettingsPage {...defaultProps()} />);
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', 'tab-board');
    });
  });

  describe('arrow key navigation', () => {
    it('ArrowRight moves to next tab', () => {
      render(<SettingsPage {...defaultProps()} />);
      const boardTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(boardTab, { key: 'ArrowRight' });

      const scheduleTab = document.getElementById('tab-schedule')!;
      expect(scheduleTab).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(scheduleTab);
    });

    it('ArrowLeft wraps from first to last tab', () => {
      render(<SettingsPage {...defaultProps()} />);
      const boardTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(boardTab, { key: 'ArrowLeft' });

      const dataTab = document.getElementById('tab-data')!;
      expect(dataTab).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(dataTab);
    });

    it('ArrowRight wraps from last to first tab', () => {
      render(<SettingsPage {...defaultProps()} />);
      // Navigate to Data tab first
      const boardTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(boardTab, { key: 'ArrowLeft' }); // now on Data

      const dataTab = document.getElementById('tab-data')!;
      fireEvent.keyDown(dataTab, { key: 'ArrowRight' }); // should wrap to Board

      const newBoardTab = document.getElementById('tab-board')!;
      expect(newBoardTab).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(newBoardTab);
    });
  });

  describe('Escape to close', () => {
    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<SettingsPage {...defaultProps({ onClose })} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('focus management', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('focuses the active tab button on open', () => {
      render(<SettingsPage {...defaultProps()} />);
      expect(document.activeElement).toBe(document.getElementById('tab-board'));
    });

    it('focuses the newly active tab button on tab switch', () => {
      render(<SettingsPage {...defaultProps()} />);
      fireEvent.click(screen.getAllByRole('tab')[1]!); // click Schedule
      act(() => vi.runAllTimers());
      expect(document.activeElement).toBe(document.getElementById('tab-schedule'));
    });
  });
});
