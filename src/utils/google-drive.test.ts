/**
 * Tests for the Drive sync factory.
 *
 * Each test creates a fresh factory instance -- no vi.resetModules()
 * needed since state lives in closures, not module scope.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createDriveSync } from '../../.planet-smars/lib/google-drive-sync';
import type { DriveSyncConfig } from '../../.planet-smars/lib/google-drive-sync';

// --- GIS mocks ---

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

// --- Factory helper ---

const KEY_PREFIX = 'test-drive';
const REFRESH_KEY = `${KEY_PREFIX}-refresh-token`;
const ACCESS_KEY = `${KEY_PREFIX}-access-token`;
const EXPIRY_KEY = `${KEY_PREFIX}-token-expiry`;
const TOKEN_URL = 'https://example.com/token-exchange';

function createSync(overrides: Partial<DriveSyncConfig<unknown>> = {}) {
  return createDriveSync<unknown>({
    clientId: 'test-client-id',
    fileName: 'test-board.json',
    mimeType: 'application/json',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    tokenExchangeUrl: TOKEN_URL,
    appId: 'test',
    storageKeyPrefix: KEY_PREFIX,
    logPrefix: '[Test]',
    sanitize: (b) => b,
    ...overrides,
  });
}

describe('Drive sync - code flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setupGoogleGlobal();
    global.fetch = vi.fn();
  });

  it('initDriveAuth initializes code client when tokenExchangeUrl is set', () => {
    const sync = createSync();
    const result = sync.initDriveAuth();
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
    const sync = createSync();
    const result = await sync.silentRefresh();
    expect(result).toBeNull();
  });

  it('silentRefresh restores from cached access token in localStorage', async () => {
    const futureExpiry = Date.now() + 3600_000;
    localStorage.setItem(ACCESS_KEY, 'cached-token');
    localStorage.setItem(EXPIRY_KEY, String(futureExpiry));
    localStorage.setItem(REFRESH_KEY, 'refresh-token');

    const sync = createSync();
    const result = await sync.silentRefresh();
    expect(result).toBe('cached-token');
    expect(sync.isAuthenticated()).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('silentRefresh calls Cloud Function when cached token is expired', async () => {
    const pastExpiry = Date.now() - 1000;
    localStorage.setItem(ACCESS_KEY, 'old-token');
    localStorage.setItem(EXPIRY_KEY, String(pastExpiry));
    localStorage.setItem(REFRESH_KEY, 'my-refresh-token');

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }),
    });

    const sync = createSync();
    const result = await sync.silentRefresh();
    expect(result).toBe('fresh-token');
    expect(sync.isAuthenticated()).toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      TOKEN_URL,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'refresh', refresh_token: 'my-refresh-token' }),
      }),
    );

    expect(localStorage.getItem(ACCESS_KEY)).toBe('fresh-token');
  });

  it('silentRefresh clears stored tokens on 401 from Cloud Function', async () => {
    localStorage.setItem(REFRESH_KEY, 'revoked-token');
    localStorage.setItem(ACCESS_KEY, 'old');
    localStorage.setItem(EXPIRY_KEY, '0');

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_grant' }),
    });

    const sync = createSync();
    const result = await sync.silentRefresh();
    expect(result).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
  });

  it('silentRefresh deduplicates concurrent calls', async () => {
    localStorage.setItem(REFRESH_KEY, 'token');
    localStorage.setItem(EXPIRY_KEY, '0');

    let resolveRefresh!: (value: unknown) => void;
    (global.fetch as Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const sync = createSync();

    const p1 = sync.silentRefresh();
    const p2 = sync.silentRefresh();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveRefresh({
      ok: true,
      json: async () => ({ access_token: 'deduped', expires_in: 3600 }),
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('deduped');
    expect(r2).toBe('deduped');
  });

  it('requestAccessToken with prompt="" delegates to silentRefresh', async () => {
    localStorage.setItem(REFRESH_KEY, 'rt');
    localStorage.setItem(EXPIRY_KEY, '0');

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'silent-token', expires_in: 3600 }),
    });

    const sync = createSync();
    sync.initDriveAuth();
    const result = await sync.requestAccessToken('');
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

    const sync = createSync();
    sync.initDriveAuth();

    const tokenPromise = sync.requestAccessToken('consent');

    mockCodeClient.callback({ code: 'auth-code-123', scope: 'drive.appdata' });

    const result = await tokenPromise;
    expect(result).toBe('new-access');

    expect(global.fetch).toHaveBeenCalledWith(
      TOKEN_URL,
      expect.objectContaining({
        body: JSON.stringify({
          action: 'exchange',
          code: 'auth-code-123',
          redirect_uri: 'postmessage',
        }),
      }),
    );

    expect(localStorage.getItem(REFRESH_KEY)).toBe('new-refresh');
    expect(localStorage.getItem(ACCESS_KEY)).toBe('new-access');
  });

  it('disconnectDrive clears stored tokens', async () => {
    localStorage.setItem(REFRESH_KEY, 'rt');
    localStorage.setItem(ACCESS_KEY, 'at');
    localStorage.setItem(EXPIRY_KEY, '999');

    const sync = createSync();
    sync.initDriveAuth();

    // Load a token into module state via silentRefresh
    localStorage.setItem(ACCESS_KEY, 'active-token');
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + 3600_000));
    await sync.silentRefresh();

    sync.disconnectDrive();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(localStorage.getItem(EXPIRY_KEY)).toBeNull();
    expect(sync.isAuthenticated()).toBe(false);
  });
});

describe('getAuthLevel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setupGoogleGlobal();
    global.fetch = vi.fn();
  });

  it('returns 0 when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const sync = createSync();
    expect(sync.getAuthLevel()).toBe(0);
  });

  it('returns 1 when no clientId is configured', () => {
    const sync = createSync({ clientId: '' });
    expect(sync.getAuthLevel()).toBe(1);
  });

  it('returns 1 when GIS is not loaded', () => {
    delete (globalThis as Record<string, unknown>).google;
    const sync = createSync();
    expect(sync.getAuthLevel()).toBe(1);
  });

  it('returns 2 when GIS is loaded but tokenExchangeUrl is empty (implicit flow)', () => {
    const sync = createSync({ tokenExchangeUrl: '' });
    expect(sync.getAuthLevel()).toBe(2);
  });

  it('returns 2 when code flow is configured but no refresh token stored', () => {
    const sync = createSync();
    expect(sync.getAuthLevel()).toBe(2);
  });

  it('returns 3 when code flow is configured and refresh token is stored', () => {
    localStorage.setItem(REFRESH_KEY, 'stored-token');
    const sync = createSync();
    expect(sync.getAuthLevel()).toBe(3);
  });
});

describe('Drive sync - implicit flow fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setupGoogleGlobal();
    global.fetch = vi.fn();
  });

  it('initDriveAuth initializes token client when tokenExchangeUrl is empty', () => {
    const sync = createSync({ tokenExchangeUrl: '' });
    const result = sync.initDriveAuth();
    expect(result).toBe(true);
    const gis = (globalThis as Record<string, unknown>).google as {
      accounts: { oauth2: Record<string, Mock> };
    };
    expect(gis.accounts.oauth2.initTokenClient).toHaveBeenCalled();
    expect(gis.accounts.oauth2.initCodeClient).not.toHaveBeenCalled();
  });

  it('silentRefresh returns null in implicit flow', async () => {
    const sync = createSync({ tokenExchangeUrl: '' });
    const result = await sync.silentRefresh();
    expect(result).toBeNull();
  });

  it('requestAccessToken uses GIS token client in implicit flow', async () => {
    const sync = createSync({ tokenExchangeUrl: '' });
    sync.initDriveAuth();

    const tokenPromise = sync.requestAccessToken('consent');

    mockTokenClient.callback({
      access_token: 'implicit-token',
      expires_in: 3600,
    });

    const result = await tokenPromise;
    expect(result).toBe('implicit-token');
    expect(sync.isAuthenticated()).toBe(true);
  });

  it('requestAccessToken returns null on error in implicit flow', async () => {
    const sync = createSync({ tokenExchangeUrl: '' });
    sync.initDriveAuth();

    const tokenPromise = sync.requestAccessToken('consent');

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
