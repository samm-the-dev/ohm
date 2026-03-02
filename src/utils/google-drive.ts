/**
 * Google Drive persistence for Ohm
 *
 * Thin wrapper around the generic Drive sync factory,
 * configured with Ohm-specific values.
 */

import { createDriveSync } from '../../.planet-smars/lib/google-drive-sync';
import type { OhmBoard } from '../types/board';
import {
  DRIVE_CLIENT_ID,
  DRIVE_FILE_NAME,
  DRIVE_MIME_TYPE,
  DRIVE_SCOPE,
  TOKEN_EXCHANGE_URL,
} from '../config/drive';
import { sanitizeBoard } from './storage';

const driveSync = createDriveSync<OhmBoard>({
  clientId: DRIVE_CLIENT_ID,
  fileName: DRIVE_FILE_NAME,
  mimeType: DRIVE_MIME_TYPE,
  scope: DRIVE_SCOPE,
  tokenExchangeUrl: TOKEN_EXCHANGE_URL,
  appId: 'ohm',
  storageKeyPrefix: 'ohm-drive',
  logPrefix: '[Ohm]',
  sanitize: sanitizeBoard,
});

export const {
  isAuthenticated,
  getAuthLevel,
  initDriveAuth,
  silentRefresh,
  requestAccessToken,
  disconnectDrive,
  loadFromDrive,
  saveToDrive,
} = driveSync;

/** Expose debug helpers on window for console inspection. */
if (import.meta.env.DEV) {
  const { getAccessToken } = driveSync;
  Object.assign(window, {
    ohmDrive: {
      getToken: getAccessToken,
      listFiles: async () => {
        const token = getAccessToken();
        if (!token) return { error: 'No access token' };
        const res = await fetch(
          'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)',
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.json();
      },
      readFile: async (fileId: string) => {
        const token = getAccessToken();
        if (!token) return { error: 'No access token' };
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.json();
      },
    },
  });
}
