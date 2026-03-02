/**
 * Google Drive persistence for Ohm
 *
 * Uses Google Identity Services (GIS) for OAuth and raw fetch
 * calls to the Drive REST API v3. Stores the board as a single
 * JSON file in appDataFolder (hidden, app-specific storage).
 *
 * Supports two auth flows:
 * - **Code flow** (when TOKEN_EXCHANGE_URL is set): authorization code
 *   exchanged via a Cloud Function for access + refresh tokens.
 *   Refresh tokens persist in localStorage for silent reconnect.
 * - **Implicit flow** (fallback): original popup-based token request.
 *   Tokens are memory-only, lost on page refresh.
 */

import type { OhmBoard } from '../types/board';
import {
  DRIVE_CLIENT_ID,
  DRIVE_FILE_NAME,
  DRIVE_MIME_TYPE,
  DRIVE_SCOPE,
  TOKEN_EXCHANGE_URL,
} from '../config/drive';
import { sanitizeBoard } from './storage';

// --- Flow selection ---

const useCodeFlow = !!TOKEN_EXCHANGE_URL;
const APP_ID = 'ohm';

// --- Token state ---

let accessToken: string | null = null;
let tokenExpiry = 0;

// Implicit flow client
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

// Code flow client
let codeClient: google.accounts.oauth2.CodeClient | null = null;

// localStorage keys for code flow persistence
const REFRESH_TOKEN_KEY = 'ohm-drive-refresh-token';
const ACCESS_TOKEN_KEY = 'ohm-drive-access-token';
const TOKEN_EXPIRY_KEY = 'ohm-drive-token-expiry';

export function isAuthenticated(): boolean {
  return !!accessToken && Date.now() < tokenExpiry;
}

/**
 * Detect the current persistence level for diagnostics.
 * 0 = localStorage unavailable
 * 1 = localStorage only (no cloud sync)
 * 2 = OAuth popup sync (tokens lost on refresh)
 * 3 = Persistent auth via Cloud Function (silent reconnect)
 */
export function getAuthLevel(): 0 | 1 | 2 | 3 {
  try {
    const key = '__ohm_ls_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
  } catch {
    return 0;
  }
  if (!DRIVE_CLIENT_ID || typeof google === 'undefined' || !google.accounts?.oauth2) {
    return 1;
  }
  if (!useCodeFlow || !localStorage.getItem(REFRESH_TOKEN_KEY)) {
    return 2;
  }
  return 3;
}

/** Expose debug helpers on window for console inspection. */
if (import.meta.env.DEV) {
  Object.assign(window, {
    ohmDrive: {
      getToken: () => accessToken,
      listFiles: async () => {
        const headers = await getHeaders();
        const res = await fetch(
          'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)',
          { headers },
        );
        return res.json();
      },
      readFile: async (fileId: string) => {
        const headers = await getHeaders();
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers,
        });
        return res.json();
      },
    },
  });
}

// --- Initialization ---

/** Initialize the GIS client. Returns false if GIS or client ID unavailable. */
export function initDriveAuth(): boolean {
  if (!DRIVE_CLIENT_ID) return false;
  if (typeof google === 'undefined' || !google.accounts?.oauth2) return false;

  if (useCodeFlow) {
    codeClient = google.accounts.oauth2.initCodeClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      ux_mode: 'popup',
      callback: () => {}, // overridden per requestAccessToken call
    });
  } else {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {}, // overridden per requestAccessToken call
    });
  }
  return true;
}

// --- Token persistence helpers (code flow) ---

function storeTokens(access: string, expiry: number, refresh?: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

function clearStoredTokens(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// --- Silent refresh (code flow) ---

let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to silently restore or refresh an access token.
 * Returns the access token or null if no refresh token / revoked.
 */
export function silentRefresh(): Promise<string | null> {
  if (!useCodeFlow) return Promise.resolve(null);
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;
  refreshPromise = doSilentRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doSilentRefresh(): Promise<string | null> {
  // Check localStorage for a non-expired cached access token
  const cachedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const cachedExpiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
  if (cachedToken && Date.now() < cachedExpiry - 60_000) {
    accessToken = cachedToken;
    tokenExpiry = cachedExpiry;
    return accessToken;
  }

  // Need a refresh token to get a new access token
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Id': APP_ID },
      body: JSON.stringify({ action: 'refresh', refresh_token: refreshToken }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[Ohm] Silent refresh failed:', res.status, err);
      // Refresh token is invalid/revoked -- clear it
      if (res.status === 400 || res.status === 401) {
        clearStoredTokens();
      }
      return null;
    }

    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    storeTokens(accessToken!, tokenExpiry);
    return accessToken;
  } catch (err) {
    console.error('[Ohm] Silent refresh network error:', err);
    return null;
  }
}

// --- Token request ---

/**
 * Request an access token.
 * - Code flow: prompt='' tries silent refresh, prompt='consent' opens code popup.
 * - Implicit flow: prompt='' skips consent if grant exists, 'consent' always prompts.
 */
export function requestAccessToken(prompt: '' | 'consent' = 'consent'): Promise<string | null> {
  // --- Code flow ---
  if (useCodeFlow) {
    // Silent attempt: use refresh token
    if (prompt === '') {
      return silentRefresh();
    }

    // Interactive: open popup to get authorization code, then exchange it
    return new Promise((resolve) => {
      if (!codeClient) {
        resolve(null);
        return;
      }

      codeClient.callback = async (response) => {
        if (response.error) {
          console.error('[Ohm] Code auth error:', response.error_description);
          resolve(null);
          return;
        }

        try {
          const res = await fetch(TOKEN_EXCHANGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-App-Id': APP_ID },
            body: JSON.stringify({
              action: 'exchange',
              code: response.code,
              redirect_uri: 'postmessage',
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => null);
            console.error('[Ohm] Token exchange failed:', res.status, err);
            resolve(null);
            return;
          }

          const data = await res.json();
          accessToken = data.access_token;
          tokenExpiry = Date.now() + data.expires_in * 1000;
          storeTokens(accessToken!, tokenExpiry, data.refresh_token);
          resolve(accessToken);
        } catch (err) {
          console.error('[Ohm] Token exchange network error:', err);
          resolve(null);
        }
      };

      codeClient.requestCode();
    });
  }

  // --- Implicit flow (fallback) ---
  return new Promise((resolve) => {
    if (!tokenClient) {
      resolve(null);
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        if (prompt === 'consent') {
          console.error('[Ohm] Drive auth error:', response.error_description);
        }
        accessToken = null;
        resolve(null);
        return;
      }
      accessToken = response.access_token;
      tokenExpiry = Date.now() + response.expires_in * 1000;
      resolve(accessToken);
    };

    tokenClient.requestAccessToken({ prompt });
  });
}

/** Revoke token and clear all state. */
export function disconnectDrive(): void {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiry = 0;
  cachedFileId = null;
  if (useCodeFlow) {
    clearStoredTokens();
  }
}

// --- Internal helpers ---

/** Cached file ID to avoid repeated lookups and prevent duplicate creates. */
let cachedFileId: string | null = null;

async function getHeaders(): Promise<HeadersInit> {
  if (!isAuthenticated()) {
    // Try silent refresh first (code flow only)
    if (useCodeFlow) {
      const token = await silentRefresh();
      if (token) return { Authorization: `Bearer ${token}` };
    }
    const token = await requestAccessToken();
    if (!token) throw new Error('Not authenticated with Google Drive');
  }
  return { Authorization: `Bearer ${accessToken}` };
}

/** Find the ohm-board.json file ID in appDataFolder. */
async function findBoardFileId(): Promise<string | null> {
  if (cachedFileId) return cachedFileId;

  const headers = await getHeaders();
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
    fields: 'files(id,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '1',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    console.error('[Ohm] Drive list failed:', res.status, err);
    throw new Error(`Drive list failed: ${res.status}`);
  }

  const data = await res.json();
  cachedFileId = data.files?.[0]?.id ?? null;
  return cachedFileId;
}

// --- Public API ---

/** Load board from Drive. Returns null if no file exists or not authenticated. */
export async function loadFromDrive(): Promise<OhmBoard | null> {
  const fileId = await findBoardFileId();
  if (!fileId) return null;

  const headers = await getHeaders();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers,
  });
  if (!res.ok) return null;

  const board = (await res.json()) as OhmBoard;
  return sanitizeBoard(board);
}

/** Save board to Drive. Creates the file if it doesn't exist, updates if it does. */
export async function saveToDrive(board: OhmBoard): Promise<boolean> {
  const headers = await getHeaders();
  const fileId = await findBoardFileId();
  const body = JSON.stringify(board);

  if (fileId) {
    // Update existing file
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': DRIVE_MIME_TYPE },
        body,
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[Ohm] Drive save failed:', res.status, err);
      if (res.status === 404) {
        // File was deleted externally -- clear cache and fall through to create
        cachedFileId = null;
      } else if (res.status === 401 || res.status === 403) {
        accessToken = null;
        tokenExpiry = 0;
        return false;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }

  // Create new file in appDataFolder (multipart upload)
  const metadata = {
    name: DRIVE_FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: DRIVE_MIME_TYPE,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([body], { type: DRIVE_MIME_TYPE }));

  // Note: do NOT set Content-Type header manually -- FormData sets the
  // multipart boundary automatically.
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers, body: form },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    console.error('[Ohm] Drive create failed:', res.status, err);
  } else {
    const created = await res.json();
    cachedFileId = created.id;
  }
  return res.ok;
}
