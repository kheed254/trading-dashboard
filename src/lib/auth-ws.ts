import { useEffect, useRef, useState } from 'react';

/* ---------- Config ---------- */
const DERIV_APP_ID = '33zV8oLiXd2lfpHkcvdWt';
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/* ---------- Types ---------- */
export type DerivUser = {
  loginid: string;
  balance: number;
  currency: string;
  isVirtual: boolean;
  email?: string;
  fullname?: string;
  country?: string;
};

export type AuthWsState = {
  /** True once Deriv has accepted the token. */
  authorized: boolean;
  /** Populated after successful authorize. */
  user: DerivUser | null;
  /** Error string if authorization failed. */
  error: string | null;
  /** Send a raw JSON message on the authorized socket. */
  send: (msg: Record<string, any>) => void;
};

/* ---------- Hook ---------- */
export function useAuthWs(): AuthWsState {
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<DerivUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const authorizedRef = useRef(false);

  useEffect(() => {
    /* Look for the token we saved during the OAuth flow */
    let token: string | null = null;
    try {
      token = sessionStorage.getItem('sfx_access_token');
    } catch {
      /* ignore */
    }

    if (!token) {
      // No token — nothing to do. User isn't logged in.
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      /* Authorize immediately on open */
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      /* --- Authorization response --- */
      if (data.msg_type === 'authorize') {
        if (data.error) {
          setError(data.error.message || 'Authorization failed');
          try {
            ws.close();
          } catch {}
          return;
        }

        const a = data.authorize || {};
        const u: DerivUser = {
          loginid: a.loginid || '',
          balance: Number(a.balance ?? 0),
          currency: a.currency || 'USD',
          isVirtual: !!a.is_virtual,
          email: a.email,
          fullname: a.fullname,
          country: a.country,
        };

        setUser(u);
        setAuthorized(true);
        authorizedRef.current = true;

        /* Console log so we can verify without changing the UI yet */
        console.log('[StingerFX] Authorized:', u);

        /* Subscribe to live balance updates on this same socket */
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      }

      /* --- Live balance updates --- */
      if (data.msg_type === 'balance' && data.balance) {
        const b = data.balance;
        setUser((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            balance: Number(b.balance ?? prev.balance),
            currency: b.currency || prev.currency,
          };
          console.log('[StingerFX] Balance update:', updated.balance, updated.currency);
          return updated;
        });
      }

      /* --- Errors anywhere --- */
      if (data.error && data.msg_type !== 'authorize') {
        console.warn('[StingerFX] API error:', data.error);
      }
    };

    ws.onerror = () => {
      if (!authorizedRef.current) {
        setError('WebSocket error — check your connection.');
      }
    };

    ws.onclose = () => {
      if (!authorizedRef.current) {
        setError('WebSocket closed before authorization.');
      }
    };

    return () => {
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
      authorizedRef.current = false;
    };
  }, []);

  const send = (msg: Record<string, any>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn('[StingerFX] Cannot send — socket not open.');
    }
  };

  return { authorized, user, error, send };
}