import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardDetail } from './CardDetail';
import type { OhmCard } from '../types/board';
import { STATUS, ENERGY_DEFAULT } from '../types/board';

// Stub responsive dialog to render children directly (avoids Vaul/Radix portal issues)
vi.mock('./ui/responsive-dialog', () => ({
  ResponsiveDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h2 className={className}>{children}</h2>,
  ResponsiveDialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <p className={className}>{children}</p>,
}));

// Stub DatePicker to avoid calendar dep in tests
vi.mock('./ui/date-picker', () => ({
  DatePicker: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (v: string | undefined) => void;
  }) => (
    <input
      type="date"
      data-testid="date-picker"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  ),
}));

function makeCard(overrides?: Partial<OhmCard>): OhmCard {
  return {
    id: 'card-1',
    title: 'Test card',
    description: '',
    energy: ENERGY_DEFAULT,
    status: STATUS.CHARGING,
    category: '',
    tasks: [],
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function defaultProps(overrides?: Record<string, unknown>) {
  return {
    card: makeCard(),
    categories: [],
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}

describe('CardDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('edit schedule button', () => {
    it('shows "Edit schedule" for activity instance cards when onEditSchedule is provided', () => {
      render(
        <CardDetail
          {...defaultProps({
            card: makeCard({ activityInstanceId: 'inst-123' }),
            onEditSchedule: vi.fn(),
          })}
        />,
      );
      expect(screen.getByText('Edit schedule')).toBeInTheDocument();
    });

    it('does not show "Edit schedule" for non-activity cards', () => {
      render(
        <CardDetail
          {...defaultProps({
            onEditSchedule: vi.fn(),
          })}
        />,
      );
      expect(screen.queryByText('Edit schedule')).toBeNull();
    });

    it('does not show "Edit schedule" when onEditSchedule is not provided', () => {
      render(
        <CardDetail
          {...defaultProps({
            card: makeCard({ activityInstanceId: 'inst-123' }),
          })}
        />,
      );
      expect(screen.queryByText('Edit schedule')).toBeNull();
    });

    it('calls onEditSchedule with the activityInstanceId when clicked', () => {
      const onEditSchedule = vi.fn();
      render(
        <CardDetail
          {...defaultProps({
            card: makeCard({ activityInstanceId: 'inst-456' }),
            onEditSchedule,
          })}
        />,
      );
      fireEvent.click(screen.getByText('Edit schedule'));
      expect(onEditSchedule).toHaveBeenCalledWith('inst-456');
    });

    it('does not show "Edit schedule" for new cards', () => {
      render(
        <CardDetail
          {...defaultProps({
            card: makeCard({ activityInstanceId: 'inst-123' }),
            isNew: true,
            onEditSchedule: vi.fn(),
          })}
        />,
      );
      expect(screen.queryByText('Edit schedule')).toBeNull();
    });
  });

  describe('recurring toggle (new card)', () => {
    it('shows "Repeat" toggle for new cards when onAddActivity is provided', () => {
      render(
        <CardDetail
          {...defaultProps({
            isNew: true,
            onAddActivity: vi.fn(),
          })}
        />,
      );
      expect(screen.getByText('Repeat')).toBeInTheDocument();
    });

    it('does not show "Repeat" for existing cards', () => {
      render(
        <CardDetail
          {...defaultProps({
            onAddActivity: vi.fn(),
          })}
        />,
      );
      expect(screen.queryByText('Repeat')).toBeNull();
    });

    it('calls onAddActivity (not onSave) when saving a recurring new card', () => {
      const onAddActivity = vi.fn().mockReturnValue({ id: 'act-1' });
      const onSave = vi.fn();
      const onClose = vi.fn();
      render(
        <CardDetail
          {...defaultProps({
            isNew: true,
            onAddActivity,
            onSave,
            onClose,
          })}
        />,
      );

      // Type a title
      const titleInput = screen.getByLabelText('Card title');
      fireEvent.change(titleInput, { target: { value: 'Daily standup' } });

      // Toggle recurring
      fireEvent.click(screen.getByText('Repeat'));

      // Save
      fireEvent.click(screen.getByText('Save'));

      expect(onAddActivity).toHaveBeenCalledWith(
        'Daily standup',
        expect.objectContaining({
          schedule: expect.objectContaining({ repeatFrequency: 'P1D' }),
        }),
      );
      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
