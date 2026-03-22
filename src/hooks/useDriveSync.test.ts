import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createDefaultBoard } from '../types/board';
import type { OhmBoard } from '../types/board';
import { createCard } from '../utils/board-utils';

const {
  mockInitDriveAuth,
  mockSilentRefresh,
  mockRequestAccessToken,
  mockDisconnectDrive,
  mockIsAuthenticated,
  mockLoadFromDrive,
  mockSaveToDrive,
} = vi.hoisted(() => ({
  mockInitDriveAuth: vi.fn<() => boolean>().mockReturnValue(true),
  mockSilentRefresh: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
  mockRequestAccessToken: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
  mockDisconnectDrive: vi.fn(),
  mockIsAuthenticated: vi.fn<() => boolean>().mockReturnValue(false),
  mockLoadFromDrive: vi.fn<() => Promise<OhmBoard | null>>().mockResolvedValue(null),
  mockSaveToDrive: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
}));

vi.mock('../utils/google-drive', () => ({
  initDriveAuth: mockInitDriveAuth,
  silentRefresh: mockSilentRefresh,
  requestAccessToken: mockRequestAccessToken,
  disconnectDrive: mockDisconnectDrive,
  isAuthenticated: mockIsAuthenticated,
  loadFromDrive: mockLoadFromDrive,
  saveToDrive: mockSaveToDrive,
}));

vi.mock('../config/drive', () => ({
  DRIVE_CLIENT_ID: 'test-client-id',
}));

vi.mock('../utils/restore-points', () => ({
  createRestorePoint: vi.fn(),
  mergeBoards: vi.fn((_local: OhmBoard, remote: OhmBoard) => remote),
}));

vi.mock('../utils/storage', () => ({
  stripTransientCards: (board: OhmBoard) => board,
}));

vi.mock('../utils/toast', () => ({
  toastSyncResult: vi.fn(),
}));

// Dynamically import after mocks are registered
const { useDriveSync } = await import('./useDriveSync');

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockInitDriveAuth.mockReturnValue(true);
  mockSilentRefresh.mockResolvedValue(null);
});

describe('useDriveSync', () => {
  describe('recovery prompt (empty board, no sync flag)', () => {
    it('shows recovery prompt when board is empty and Drive is available', async () => {
      const emptyBoard = createDefaultBoard();
      const onBoardLoaded = vi.fn();

      const { result } = renderHook(() => useDriveSync(emptyBoard, onBoardLoaded));

      await waitFor(() => {
        expect(result.current.needsReconnect).toBe(true);
        expect(result.current.recoveryPrompt).toBe(true);
      });
    });

    it('does not show recovery prompt when board has cards', async () => {
      const board = createDefaultBoard();
      board.cards = [createCard('Test card')];
      const onBoardLoaded = vi.fn();

      const { result } = renderHook(() => useDriveSync(board, onBoardLoaded));

      // Wait for init to complete (initDriveAuth is called synchronously in the effect)
      await waitFor(() => {
        expect(mockInitDriveAuth).toHaveBeenCalled();
      });

      expect(result.current.needsReconnect).toBe(false);
      expect(result.current.recoveryPrompt).toBe(false);
    });

    it('does not show recovery prompt when sync flag exists (uses reconnect path instead)', async () => {
      localStorage.setItem('ohm-drive-synced', '1');
      const emptyBoard = createDefaultBoard();
      const onBoardLoaded = vi.fn();

      const { result } = renderHook(() => useDriveSync(emptyBoard, onBoardLoaded));

      await waitFor(() => {
        // Should show needsReconnect but NOT recoveryPrompt
        expect(result.current.needsReconnect).toBe(true);
        expect(result.current.recoveryPrompt).toBe(false);
      });
    });

    it('clears recovery prompt after successful connect', async () => {
      const emptyBoard = createDefaultBoard();
      const remoteBoard = createDefaultBoard();
      remoteBoard.cards = [createCard('Remote card')];
      const onBoardLoaded = vi.fn();

      mockRequestAccessToken.mockResolvedValue('test-token');
      mockLoadFromDrive.mockResolvedValue(remoteBoard);

      const { result } = renderHook(() => useDriveSync(emptyBoard, onBoardLoaded));

      await waitFor(() => {
        expect(result.current.recoveryPrompt).toBe(true);
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.recoveryPrompt).toBe(false);
      expect(result.current.needsReconnect).toBe(false);
      expect(result.current.driveConnected).toBe(true);
      // Dismiss flag should be cleared when user connects
      expect(localStorage.getItem('ohm-drive-dismissed')).toBeNull();
    });

    it('dismissRecovery hides banner and persists dismissal', async () => {
      const emptyBoard = createDefaultBoard();
      const onBoardLoaded = vi.fn();

      const { result } = renderHook(() => useDriveSync(emptyBoard, onBoardLoaded));

      await waitFor(() => {
        expect(result.current.recoveryPrompt).toBe(true);
      });

      act(() => {
        result.current.dismissRecovery();
      });

      expect(result.current.needsReconnect).toBe(false);
      expect(result.current.recoveryPrompt).toBe(false);
      expect(localStorage.getItem('ohm-drive-dismissed')).toBe('1');
    });

    it('does not show recovery prompt when previously dismissed', async () => {
      localStorage.setItem('ohm-drive-dismissed', '1');
      const emptyBoard = createDefaultBoard();
      const onBoardLoaded = vi.fn();

      const { result } = renderHook(() => useDriveSync(emptyBoard, onBoardLoaded));

      await waitFor(() => {
        expect(mockInitDriveAuth).toHaveBeenCalled();
      });

      expect(result.current.needsReconnect).toBe(false);
      expect(result.current.recoveryPrompt).toBe(false);
    });
  });

  describe('standard reconnect (sync flag exists)', () => {
    it('auto-connects when silent refresh succeeds', async () => {
      localStorage.setItem('ohm-drive-synced', '1');
      mockSilentRefresh.mockResolvedValue('refreshed-token');
      mockLoadFromDrive.mockResolvedValue(null);

      const emptyBoard = createDefaultBoard();
      const onBoardLoaded = vi.fn();

      const { result } = renderHook(() => useDriveSync(emptyBoard, onBoardLoaded));

      await waitFor(() => {
        expect(result.current.driveConnected).toBe(true);
      });

      expect(result.current.needsReconnect).toBe(false);
    });
  });
});
