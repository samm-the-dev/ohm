import type { HttpFunction } from '@google-cloud/functions-framework';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';

const ALLOWED_ORIGINS = ['https://ismarsh.github.io'];

function getCorsOrigin(requestOrigin: string | undefined): string | null {
  if (!requestOrigin) return null;
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  if (/^https?:\/\/localhost(:\d+)?$/.test(requestOrigin)) return requestOrigin;
  return null;
}

interface ExchangeBody {
  action: 'exchange';
  code: string;
  redirect_uri: string;
}

interface RefreshBody {
  action: 'refresh';
  refresh_token: string;
}

type RequestBody = ExchangeBody | RefreshBody;

interface TokenEndpointResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export const ohmTokenExchange: HttpFunction = async (req, res) => {
  const origin = getCorsOrigin(req.headers.origin);

  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-App-Id');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!origin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  const appId = req.headers['x-app-id'] ?? 'unknown';
  const body = req.body as RequestBody;

  try {
    if (body.action === 'exchange') {
      if (!body.code || !body.redirect_uri) {
        res.status(400).json({ error: 'Missing code or redirect_uri' });
        return;
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: body.code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: body.redirect_uri,
          grant_type: 'authorization_code',
        }),
      });

      const data = (await tokenRes.json()) as TokenEndpointResponse;
      if (!tokenRes.ok) {
        console.error(`[${appId}] Token exchange failed:`, data);
        res
          .status(tokenRes.status)
          .json({ error: data.error_description || data.error || 'Token exchange failed' });
        return;
      }

      console.log(`[${appId}] Token exchange success`);
      res.json({
        access_token: data.access_token,
        expires_in: data.expires_in,
        refresh_token: data.refresh_token,
      });
    } else if (body.action === 'refresh') {
      if (!body.refresh_token) {
        res.status(400).json({ error: 'Missing refresh_token' });
        return;
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: body.refresh_token,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'refresh_token',
        }),
      });

      const data = (await tokenRes.json()) as TokenEndpointResponse;
      if (!tokenRes.ok) {
        console.error(`[${appId}] Token refresh failed:`, data);
        res
          .status(tokenRes.status)
          .json({ error: data.error_description || data.error || 'Token refresh failed' });
        return;
      }

      console.log(`[${appId}] Token refresh success`);
      res.json({
        access_token: data.access_token,
        expires_in: data.expires_in,
      });
    } else {
      res.status(400).json({ error: `Unknown action: ${(body as { action: string }).action}` });
    }
  } catch (err) {
    console.error(`[${appId}] Unexpected error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
