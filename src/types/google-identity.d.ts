declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
    callback: (response: TokenResponse) => void;
  }

  interface TokenResponse {
    access_token: string;
    expires_in: number;
    error?: string;
    error_description?: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message: string }) => void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;

  // --- Authorization code flow (used with server-side token exchange) ---

  interface CodeClient {
    requestCode(): void;
    callback: (response: CodeResponse) => void;
  }

  interface CodeResponse {
    code: string;
    scope: string;
    error?: string;
    error_description?: string;
  }

  interface CodeClientConfig {
    client_id: string;
    scope: string;
    ux_mode: 'popup' | 'redirect';
    redirect_uri?: string;
    callback: (response: CodeResponse) => void;
    error_callback?: (error: { type: string; message: string }) => void;
  }

  function initCodeClient(config: CodeClientConfig): CodeClient;

  function revoke(token: string, callback?: () => void): void;
  function hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
}
