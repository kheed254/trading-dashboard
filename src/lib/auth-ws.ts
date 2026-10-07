import { useEffect, useRef, useState } from 'react';

/* ---------- Config ---------- */
const DERIV_APP_ID = '33zV8oLiXd2lfpHkcvdWt';
const REST_BASE = 'https://api.derivws.com/trading/v1/options';

/* ---------- Types ---------- */
export type DerivAccount = {
  account_id: string;
  account_type: 'demo' | 'real';
  currency: string;
  balance: number;
  loginid?: string;
};

export type DerivUser = {
  loginid: string;
  balance: number;
  currency: string;
  isVirtual: boolean;
  accounts: DerivAccount[];
  activeAccountId: string;
};

export type AuthWsState = {
  authorized: boolean;
  user: DerivUser | null;
  error: string | null;
  send: (msg: Record<string, any>) => void;
  /** Switch to a different account (real/demo) */
  switchAccount: (accountId: string) => void;
};

/* ---------- REST helpers ---------- */

async function fetchAccounts(token: string): Promise<DerivAccount[]> {
  const res = await fetch(`${REST_BASE}/accounts`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Deriv-App-ID': DERIV_APP_ID,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.errors?.[0]?.message || err?.error || `Accounts fetch failed (${res.status})`
    );
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.data || data.accounts || [];
  return list.map((a: any) => ({
    account_id: a.account_id || a.id || a.loginid,
    account_type: a.account_type || (a.is_virtual ? 'demo' : 'real'),
    currency: a.currency || 'USD',
    balance: Number(a.balance ?? 0),
    loginid: a.loginid || a.account_id || a.id,
  }));
}

async function fetchOtpUrl(
  token: string,
  accountId: string
): Promise<string> {
  const res = await fetch(
    `${REST_BASE}/accounts/${accountId}/otp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Deriv-App-ID': DERIV_APP_ID,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.errors?.[0]?.message || err?.error || `OTP fetch failed (${res.status})`
    );
  }
  const data = await res.json();
  const url = data?.data?.url || data?.url;
  if (!url) throw new Error('No WebSocket URL in OTP response');
  return url;
}

/* ---------- Hook ---------- */
export function useAuthWs(): AuthWsState {
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<DerivUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const accountsRef = useRef<DerivAccount[]>([]);

  /** Connect a WebSocket to a fresh OTP URL and wire up its handlers */
  const connectWithAccount = async (accountId: string) => {
    const token = tokenRef.current;
    if (!token) return;

    try {
      setError(null);

      /* Close any existing socket */
      try {
        wsRef.current?.close();
      } catch {}

      const otpUrl = await fetchOtpUrl(token, accountId);
      const ws = new WebSocket(otpUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[StingerFX] WebSocket connected via OTP');
        /* Subscribe to live balance on this authenticated socket */
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        /* --- Balance response / updates --- */
        if (data.msg_type === 'balance' && data.balance) {
          const b = data.balance;
          setUser((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              balance: Number(b.balance ?? prev.balance),
              currency: b.currency || prev.currency,
            };
          });
          console.log(
            '[StingerFX] Balance:',
            b.balance,
            b.currency,
            b.loginid
          );
        }

        /* --- Errors --- */
        if (data.error) {
          console.warn('[StingerFX] API error:', data.error);
        }
      };

      ws.onerror = () => {
        setError('WebSocket error — check your connection.');
      };

      ws.onclose = () => {
        console.log('[StingerFX] WebSocket closed');
      };

      /* Mark authorized once socket is set up */
      setAuthorized(true);

      /* Update the user's activeAccountId */
      setUser((prev) =>
        prev
          ? {
              ...prev,
              activeAccountId: accountId,
            }
          : prev
      );
    } catch (err: any) {
      console.error('[StingerFX] connect error:', err);
      setError(err.message || 'Failed to connect');
    }
  };

  /* ---------- On mount: fetch accounts, connect to primary ---------- */
  useEffect(() => {
    let token: string | null = null;
    try {
      token = sessionStorage.getItem('sfx_access_token');
    } catch {
      /* ignore */
    }

    if (!token) return;
    tokenRef.current = token;

    (async () => {
      try {
        const accounts = await fetchAccounts(token);
        accountsRef.current = accounts;
        console.log('[StingerFX] Accounts fetched:', accounts);

        if (!accounts.length) {
          setError('No trading accounts found on this profile.');
          return;
        }

        /* Prefer demo, fall back to first */
        const primary =
          accounts.find((a) => a.account_type === 'demo') || accounts[0];

        setUser({
          loginid: primary.loginid || primary.account_id,
          balance: primary.balance,
          currency: primary.currency,
          isVirtual: primary.account_type === 'demo',
          accounts,
          activeAccountId: primary.account_id,
        });

        await connectWithAccount(primary.account_id);
      } catch (err: any) {
        console.error('[StingerFX] auth setup error:', err);
        setError(err.message || 'Failed to load accounts');
      }
    })();

    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, []);

  const switchAccount = (accountId: string) => {
    const acct = accountsRef.current.find((a) => a.account_id === accountId);
    if (!acct) return;
    setUser((prev) =>
      prev
        ? {
            ...prev,
            loginid: acct.loginid || acct.account_id,
            balance: acct.balance,
            currency: acct.currency,
            isVirtual: acct.account_type === 'demo',
            activeAccountId: accountId,
          }
        : prev
    );
    connectWithAccount(accountId);
  };

  const send = (msg: Record<string, any>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn('[StingerFX] Cannot send — socket not open.');
    }
  };

  return { authorized, user, error, send, switchAccount };
}