/* ---------- Deriv OAuth — stingerfx.site ---------- */

/** Your own OAuth client ID, registered for stingerfx.site. */
export const DERIV_APP_ID = '33zV8oLiXd2lfpHkcvdWt';

/** New OAuth endpoint — always shows the consent screen. */
export const DERIV_OAUTH_URL = 'https://auth.deriv.com/oauth2/auth';

/** Where Deriv sends the user back after they authorize. */
export function getRedirectUri(): string {
  return window.location.origin + window.location.pathname;
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