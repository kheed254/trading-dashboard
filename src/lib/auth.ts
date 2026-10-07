/* ---------- Deriv OAuth ---------- */

export const DERIV_APP_ID = '33zV8oLiXd2lfpHkcvdWt';
export const DERIV_OAUTH_URL = 'https://oauth.deriv.com/oauth2/authorize';

export function getRedirectUri(): string {
  return window.location.origin + '/';
}

export function startDerivLogin() {
  const params = new URLSearchParams({
    app_id: DERIV_APP_ID,
    l: 'EN',
    redirect_uri: getRedirectUri(),
  });
  window.location.href = `${DERIV_OAUTH_URL}?${params.toString()}`;
}

export function readDerivAuthResponse() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const acct1 = params.get('acct1');
  const cur1 = params.get('cur1');
  if (!token) return null;
  return { token, acct1, cur1 };
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