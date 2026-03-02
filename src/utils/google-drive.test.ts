/**
 * Tests for the google-drive auth layer.
 *
 * These tests cover the dual-flow token management (code flow vs implicit)
 * by mocking the config module to control which flow is active, and mocking
 * fetch for Cloud Function calls.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// --- Mocks must be declared before imports ---

// Default: code flow enabled
const mockConfig = {
  DRIVE_CLIENT_ID: 'test-client-id',
  DRIVE_FILE_NAME: 'ohm-board.json',
  DRIVE_MIME_TYPE: 'application/json',
  DRIVE_SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
  TOKEN_EXCHANGE_URL: 'https://example.com/token-exchange',
};

vi.mock('../config/drive', () => mockConfig);
vi.mock('./storage', () => ({ sanitizeBoard: (b: unknown) => b }));

// Mock GIS on the global google namespace
const mockRequestCode = vi.fn();
const mockRequestAccessToken = vi.fn();
const mockRevoke = vi.fn();
const mockCodeClient = { requestCode: mockRequestCode, callback: vi.fn() };
const mockTokenClient = { requestAccessToken: mockRequestAccessToken, callback: vi.fn() };

function setupGoogleGlobal() {
  (globalThis as Record<string, unknown>).google = {
    accounts: {
      oauth2: {
        initCodeClient: vi.fn(() => mockCodeClient),
        initTokenClient: vi.fn(() => mockTokenClient),
        revoke: mockRevoke,
      },
    },
  };
}

// We need to re-import the module fresh for each test group to reset module-level state
async function importFresh() {
  // Clear the module cache so module-level variables reset
  vi.resetModules();
  // Re-apply mocks after resetModules
  vi.doMock('../config/drive', () => ({ ...mockConfig }));
  vi.doMock('./storage', () => ({ sanitizeBoard: (b: unknown) => b }));
  return import('./google-drive');
}

describe('google-drive auth - code flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockConfig.TOKEN_EXCHANGE_URL = 'https://example.com/token-exchange';
    setupGoogleGlobal();
    global.fetch = vi.fn();
  });

  it('initDriveAuth initializes code client when TOKEN_EXCHANGE_URL is set', async () => {
    const mod = await importFresh();
    const result = mod.initDriveAuth();
    expect(result).toBe(true);
    const gis = (globalThis as Record<string, unknown>).google as {
      accounts: { oauth2: Record<string, Mock> };
    };
    expect(gis.accounts.oauth2.initCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id', ux_mode: 'popup' }),
    );
    expect(gis.accounts.oauth2.initTokenClient).not.toHaveBeenCalled();
  });

  it('silentRefresh returns null when no refresh token is stored', async () => {
    const mod = await importFresh();
    const result = await mod.silentRefresh();
    expect(result).toBeNull();
  });

  it('silentRefresh restores from cached access token in localStorage', async () => {
    const futureExpiry = Date.now() + 3600_000; // 1 hour from now
    localStorage.setItem('ohm-drive-access-token', 'cached-token');
    localStorage.setItem('ohm-drive-token-expiry', String(futureExpiry));
    localStorage.setItem('ohm-drive-refresh-token', 'refresh-token');

    const mod = await importFresh();
    const result = await mod.silentRefresh();
    expect(result).toBe('cached-token');
    expect(mod.isAuthenticated()).toBe(true);
    // Should not have called fetch (used cache)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('silentRefresh calls Cloud Function when cached token is expired', async () => {
    const pastExpiry = Date.now() - 1000;
    localStorage.setItem('ohm-drive-access-token', 'old-token');
    localStorage.setItem('ohm-drive-token-expiry', String(pastExpiry));
    localStorage.setItem('ohm-drive-refresh-token', 'my-refresh-token');

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }),
    });

    const mod = await importFresh();
    const result = await mod.silentRefresh();
    expect(result).toBe('fresh-token');
    expect(mod.isAuthenticated()).toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/token-exchange',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'refresh', refresh_token: 'my-refresh-token' }),
      }),
    );

    // Should have stored the new token
    expect(localStorage.getItem('ohm-drive-access-token')).toBe('fresh-token');
  });

  it('silentRefresh clears stored tokens on 401 from Cloud Function', async () => {
    localStorage.setItem('ohm-drive-refresh-token', 'revoked-token');
    localStorage.setItem('ohm-drive-access-token', 'old');
    localStorage.setItem('ohm-drive-token-expiry', '0');

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_grant' }),
    });

    const mod = await importFresh();
    const result = await mod.silentRefresh();
    expect(result).toBeNull();
    expect(localStorage.getItem('ohm-drive-refresh-token')).toBeNull();
    expect(localStorage.getItem('ohm-drive-access-token')).toBeNull();
  });

  it('silentRefresh deduplicates concurrent calls', async () => {
    localStorage.setItem('ohm-drive-refresh-token', 'token');
    localStorage.setItem('ohm-drive-token-expiry', '0');

    let resolveRefresh!: (value: unknown) => void;
    (global.fetch as Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const mod = await importFresh();

    // Start two concurrent refreshes
    const p1 = mod.silentRefresh();
    const p2 = mod.silentRefresh();

    // Only one fetch call should have been made
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Resolve the single fetch
    resolveRefresh({
      ok: true,
      json: async () => ({ access_token: 'deduped', expires_in: 3600 }),
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('deduped');
    expect(r2).toBe('deduped');
  });

  it('requestAccessToken with prompt="" delegates to silentRefresh', async () => {
    localStorage.setItem('ohm-drive-refresh-token', 'rt');
    localStorage.setItem('ohm-drive-token-expiry', '0');

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'silent-token', expires_in: 3600 }),
    });

    const mod = await importFresh();
    mod.initDriveAuth();
    const result = await mod.requestAccessToken('');
    expect(result).toBe('silent-token');
  });

  it('requestAccessToken with consent exchanges code via Cloud Function', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        expires_in: 3600,
        refresh_token: 'new-refresh',
      }),
    });

    const mod = await importFresh();
    mod.initDriveAuth();

    const tokenPromise = mod.requestAccessToken('consent');

    // Simulate GIS calling the callback with an authorization code
    mockCodeClient.callback({ code: 'auth-code-123', scope: 'drive.appdata' });

    const result = await tokenPromise;
    expect(result).toBe('new-access');

    // Verify the exchange request
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/token-exchange',
      expect.objectContaining({
        body: JSON.stringify({
          action: 'exchange',
          code: 'auth-code-123',
          redirect_uri: 'postmessage',
        }),
      }),
    );

    // Verify tokens were stored
    expect(localStorage.getItem('ohm-drive-refresh-token')).toBe('new-refresh');
    expect(localStorage.getItem('ohm-drive-access-token')).toBe('new-access');
  });

  it('disconnectDrive clears stored tokens', async () => {
    localStorage.setItem('ohm-drive-refresh-token', 'rt');
    localStorage.setItem('ohm-drive-access-token', 'at');
    localStorage.setItem('ohm-drive-token-expiry', '999');

    const mod = await importFresh();
    // Set accessToken in module state so revoke is called
    mod.initDriveAuth();
    // Manually get a token first
    localStorage.setItem('ohm-drive-access-token', 'active-token');
    localStorage.setItem('ohm-drive-token-expiry', String(Date.now() + 3600_000));
    await mod.silentRefresh();

    mod.disconnectDrive();
    expect(localStorage.getItem('ohm-drive-refresh-token')).toBeNull();
    expect(localStorage.getItem('ohm-drive-access-token')).toBeNull();
    expect(localStorage.getItem('ohm-drive-token-expiry')).toBeNull();
    expect(mod.isAuthenticated()).toBe(false);
  });
});

describe('getAuthLevel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setupGoogleGlobal();
    global.fetch = vi.fn();
  });

  it('returns 0 when localStorage is unavailable', async () => {
    mockConfig.TOKEN_EXCHANGE_URL = 'https://example.com/token-exchange';
    const mod = await importFresh();

    // Make localStorage.setItem throw
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(mod.getAuthLevel()).toBe(0);
  });

  it('returns 1 when no DRIVE_CLIENT_ID is configured', async () => {
    mockConfig.DRIVE_CLIENT_ID = '';
    mockConfig.TOKEN_EXCHANGE_URL = 'https://example.com/token-exchange';
    const mod = await importFresh();
    expect(mod.getAuthLevel()).toBe(1);
    mockConfig.DRIVE_CLIENT_ID = 'test-client-id'; // restore
  });

  it('returns 1 when GIS is not loaded', async () => {
    mockConfig.TOKEN_EXCHANGE_URL = 'https://example.com/token-exchange';
    delete (globalThis as Record<string, unknown>).google;
    const mod = await importFresh();
    expect(mod.getAuthLevel()).toBe(1);
  });

  it('returns 2 when GIS is loaded but TOKEN_EXCHANGE_URL is empty (implicit flow)', async () => {
    mockConfig.TOKEN_EXCHANGE_URL = '';
    const mod = await importFresh();
    expect(mod.getAuthLevel()).toBe(2);
  });

  it('returns 2 when code flow is configured but no refresh token stored', async () => {
    mockConfig.TOKEN_EXCHANGE_URL = 'https://example.com/token-exchange';
    const mod = await importFresh();
    expect(mod.getAuthLevel()).toBe(2);
  });

  it('returns 3 when code flow is configured and refresh token is stored', async () => {
    mockConfig.TOKEN_EXCHANGE_URL = 'https://example.com/token-exchange';
    localStorage.setItem('ohm-drive-refresh-token', 'stored-token');
    const mod = await importFresh();
    expect(mod.getAuthLevel()).toBe(3);
  });
});

describe('google-drive auth - implicit flow fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockConfig.TOKEN_EXCHANGE_URL = '';
    setupGoogleGlobal();
    global.fetch = vi.fn();
  });

  it('initDriveAuth initializes token client when TOKEN_EXCHANGE_URL is empty', async () => {
    const mod = await importFresh();
    const result = mod.initDriveAuth();
    expect(result).toBe(true);
    const gis = (globalThis as Record<string, unknown>).google as {
      accounts: { oauth2: Record<string, Mock> };
    };
    expect(gis.accounts.oauth2.initTokenClient).toHaveBeenCalled();
    expect(gis.accounts.oauth2.initCodeClient).not.toHaveBeenCalled();
  });

  it('silentRefresh returns null in implicit flow', async () => {
    const mod = await importFresh();
    const result = await mod.silentRefresh();
    expect(result).toBeNull();
  });

  it('requestAccessToken uses GIS token client in implicit flow', async () => {
    const mod = await importFresh();
    mod.initDriveAuth();

    const tokenPromise = mod.requestAccessToken('consent');

    // Simulate GIS callback
    mockTokenClient.callback({
      access_token: 'implicit-token',
      expires_in: 3600,
    });

    const result = await tokenPromise;
    expect(result).toBe('implicit-token');
    expect(mod.isAuthenticated()).toBe(true);
  });

  it('requestAccessToken returns null on error in implicit flow', async () => {
    const mod = await importFresh();
    mod.initDriveAuth();

    const tokenPromise = mod.requestAccessToken('consent');

    mockTokenClient.callback({
      access_token: '',
      expires_in: 0,
      error: 'access_denied',
      error_description: 'User denied',
    });

    const result = await tokenPromise;
    expect(result).toBeNull();
  });
});
