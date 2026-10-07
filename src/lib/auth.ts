/* ---------- Deriv OAuth — stingerfx.site ---------- */

/** Your own OAuth client ID, registered for stingerfx.site. */
export const DERIV_APP_ID = '33zV8oLiXd2lfpHkcvdWt';

/** New OAuth endpoint — always shows the consent screen. */
export const DERIV_OAUTH_URL = 'https://auth.deriv.com/oauth2/auth';

/** Where Deriv sends the user back after they authorize. */
export function getRedirectUri(): string {
  return window.location.origin + '/';
}

/* ---------- PKCE helpers ---------- */

function randomString(len: number): string {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr)
    .map((v) => charset[v % charset.length])
    .join('');
}

async function deriveChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/* ---------- Start login ---------- */

export async function startDerivLogin() {
  const codeVerifier = randomString(64);
  const state = randomString(32);
  const codeChallenge = await deriveChallenge(codeVerifier);

  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DERIV_APP_ID,
    redirect_uri: getRedirectUri(),
    scope: 'trade account_manage',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${DERIV_OAUTH_URL}?${params}`;
}

/* ---------- Read auth response from URL after redirect ---------- */

export function readDerivAuthResponse() {
  const p = new URLSearchParams(window.location.search);
  return {
    code: p.get('code'),
    state: p.get('state'),
    error: p.get('error'),
  };
}

export function stripAuthParamsFromUrl() {
  if (window.location.search) {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname + window.location.hash
    );
  }
}

/* ---------- Exchange code for token ---------- */

export type TokenResult =
  | { ok: true; access_token: string; expires_in: number; token_type: string }
  | { ok: false; error: string };

/**
 * After OAuth redirects back with ?code=..., call this to exchange
 * the code for an access token via our own /api/token endpoint.
 */
export async function exchangeCodeForToken(): Promise<TokenResult | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');

  if (!code) return null; // nothing to exchange

  /* Validate the CSRF state */
  const savedState = sessionStorage.getItem('oauth_state');
  if (!savedState || savedState !== returnedState) {
    return { ok: false, error: 'State mismatch — try logging in again.' };
  }

  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  if (!codeVerifier) {
    return {
      ok: false,
      error: 'Missing PKCE verifier — try logging in again.',
    };
  }

  try {
    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: window.location.origin + '/',
        client_id: DERIV_APP_ID,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.error || 'Token exchange failed' };
    }

    /* Success — clean up one-time values and the URL */
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');
    window.history.replaceState({}, document.title, window.location.pathname);

    return {
      ok: true,
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error' };
  }
}

/* ---------- Token storage helpers ---------- */

export function saveAccessToken(token: string) {
  try {
    sessionStorage.setItem('sfx_access_token', token);
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem('sfx_access_token');
  } catch {
    return null;
  }
}

export function clearAccessToken() {
  try {
    sessionStorage.removeItem('sfx_access_token');
  } catch {
    /* ignore */
  }
}