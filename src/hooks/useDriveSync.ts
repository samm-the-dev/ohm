import { useState, useEffect, useCallback, useRef } from 'react';
import type { OhmBoard } from '../types/board';
import {
  initDriveAuth,
  requestAccessToken,
  disconnectDrive,
  isAuthenticated,
  loadFromDrive,
  saveToDrive,
} from '../utils/google-drive';
import { DRIVE_CLIENT_ID } from '../config/drive';
import { createRestorePoint } from '../utils/restore-points';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

const SYNC_FLAG_KEY = 'ohm-drive-synced';

function wasPreviouslySynced(): boolean {
  return localStorage.getItem(SYNC_FLAG_KEY) === '1';
}

interface UseDriveSyncReturn {
  driveAvailable: boolean;
  driveConnected: boolean;
  syncStatus: SyncStatus;
  needsReconnect: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  manualSync: () => Promise<void>;
  queueSync: (board: OhmBoard) => void;
}

export function useDriveSync(
  currentBoard: OhmBoard,
  onBoardLoaded: (board: OhmBoard) => void,
): UseDriveSyncReturn {
  const [driveAvailable, setDriveAvailable] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const boardRef = useRef(currentBoard);

  /** Compare remote vs local timestamps and merge the newer version */
  const mergeWithRemote = useCallback(async () => {
    const remote = await loadFromDrive();
    if (remote && remote.lastSaved > boardRef.current.lastSaved) {
      createRestorePoint(boardRef.current, 'Before Drive sync');
      onBoardLoaded(remote);
      setSyncStatus('synced');
    } else {
      const ok = await saveToDrive(boardRef.current);
      setSyncStatus(ok ? 'synced' : 'error');
    }
  }, [onBoardLoaded]);

  // Keep boardRef current
  useEffect(() => {
    boardRef.current = currentBoard;
  }, [currentBoard]);

  // Initialize GIS on mount
  useEffect(() => {
    if (!DRIVE_CLIENT_ID) return;

    // GIS script loads async -- retry briefly if not ready yet
    const tryInit = () => {
      const ready = initDriveAuth();
      if (ready) {
        setDriveAvailable(true);
        return true;
      }
      return false;
    };

    const onReady = () => {
      // GIS implicit flow can't silently refresh tokens (requires a popup),
      // so just prompt the user to reconnect via a button click.
      if (wasPreviouslySynced()) {
        setNeedsReconnect(true);
      }
    };

    if (tryInit()) {
      onReady();
      return;
    }

    // Script may still be loading -- poll a few times
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (tryInit()) {
        onReady();
        clearInterval(interval);
      } else if (attempts >= 10) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setSyncStatus((prev) => (prev === 'offline' ? 'idle' : prev));
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setSyncStatus('offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const pushToRemote = useCallback(async (board: OhmBoard) => {
    if (!isAuthenticated() || !navigator.onLine) {
      setSyncStatus(navigator.onLine ? 'idle' : 'offline');
      return;
    }
    setSyncStatus('syncing');
    try {
      const ok = await saveToDrive(board);
      setSyncStatus(ok ? 'synced' : 'error');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  const connect = useCallback(async () => {
    // Try silent refresh first (reuses existing grant without consent screen),
    // fall back to full consent popup if the grant has expired.
    const token = (await requestAccessToken('')) ?? (await requestAccessToken('consent'));
    if (!token) return;

    setDriveConnected(true);
    setNeedsReconnect(false);
    localStorage.setItem(SYNC_FLAG_KEY, '1');
    setSyncStatus('syncing');

    try {
      await mergeWithRemote();
    } catch {
      setSyncStatus('error');
    }
  }, [mergeWithRemote]);

  const disconnect = useCallback(() => {
    disconnectDrive();
    setDriveConnected(false);
    setNeedsReconnect(false);
    localStorage.removeItem(SYNC_FLAG_KEY);
    setSyncStatus('idle');
  }, []);

  const queueSync = useCallback(
    (board: OhmBoard) => {
      if (!driveConnected) return;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => pushToRemote(board), 2000);
    },
    [driveConnected, pushToRemote],
  );

  const manualSync = useCallback(async () => {
    if (!driveConnected || !navigator.onLine) return;
    setSyncStatus('syncing');
    try {
      await mergeWithRemote();
    } catch {
      setSyncStatus('error');
    }
  }, [driveConnected, mergeWithRemote]);

  // Cleanup pending sync on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  return {
    driveAvailable,
    driveConnected,
    syncStatus,
    needsReconnect,
    connect,
    disconnect,
    manualSync,
    queueSync,
  };
}
