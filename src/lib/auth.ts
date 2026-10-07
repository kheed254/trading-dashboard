/* ---------- Deriv OAuth with PKCE ---------- */

export const DERIV_APP_ID = '33zV8oLiXd2lfpHkcvdWt';
export const DERIV_OAUTH_URL = 'https://auth.deriv.com/oauth2/auth';
export const DERIV_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';

export function getRedirectUri(): string {
  return window.location.origin + '/';
}

/* ---------- PKCE helpers ---------- */

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return await crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function randomString(length: number): string {
  const array = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(array)
    .map((v) =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[
        v % 66
      ]
    )
    .join('');
}

/* ---------- Start login ---------- */

export async function startDerivLogin() {
  const codeVerifier = randomString(64);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  const state = randomString(16);

  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DERIV_APP_ID,
    redirect_uri: getRedirectUri(),
    scope: 'trade',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${DERIV_OAUTH_URL}?${params.toString()}`;
}

/* ---------- Read auth response ---------- */

export function readDerivAuthResponse() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return null;
  return { code, state };
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