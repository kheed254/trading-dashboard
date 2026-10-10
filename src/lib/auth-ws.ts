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

export type OpenTrade = {
  contract_id: number;
  symbol: string;
  contract_type: string;
  buy_price: number;
  payout: number;
  profit: number;
  current_spot: number;
  entry_spot: number;
  is_sold: boolean;
  longcode?: string;
  entry_time?: number;
  exit_time?: number;
};

export type StatementEntry = {
  transaction_id: number;
  action_type: string;
  amount: number;
  balance_after: number;
  currency: string;
  transaction_time: number;
  longcode?: string;
};

export type PlaceTradeInput = {
  symbol: string;
  contractType: string;
  stake: number;
  duration: number;
  durationUnit: string;
  barrier?: string;
  currency?: string;
};

export type AuthWsState = {
  authorized: boolean;
  user: DerivUser | null;
  error: string | null;
  openTrades: OpenTrade[];
  statement: StatementEntry[];
  requestStatement: (limit?: number) => void;
  send: (msg: Record<string, any>) => void;
  switchAccount: (accountId: string) => void;
  placeTrade: (input: PlaceTradeInput) => void;
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

async function fetchOtpUrl(token: string, accountId: string): Promise<string> {
  const res = await fetch(`${REST_BASE}/accounts/${accountId}/otp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Deriv-App-ID': DERIV_APP_ID,
      'Content-Type': 'application/json',
    },
  });
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
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [statement, setStatement] = useState<StatementEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const accountsRef = useRef<DerivAccount[]>([]);
  const proposalWaitersRef = useRef<Record<number, (data: any) => void>>({});
  const proposalIdCounterRef = useRef(9000);

  const connectWithAccount = async (accountId: string) => {
    const token = tokenRef.current;
    if (!token) return;

    try {
      setError(null);
      try { wsRef.current?.close(); } catch {}

      const otpUrl = await fetchOtpUrl(token, accountId);
      const ws = new WebSocket(otpUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[StingerFX] WebSocket connected via OTP');
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        ws.send(JSON.stringify({ portfolio: 1 }));
        ws.send(JSON.stringify({ statement: 1, limit: 20, req_id: 7777 }));
      };

      ws.onmessage = (event) => {
        let data: any;
        try { data = JSON.parse(event.data); } catch { return; }

        if (data.msg_type === 'balance' && data.balance) {
          const b = data.balance;
          setUser((prev) => prev ? {
            ...prev,
            balance: Number(b.balance ?? prev.balance),
            currency: b.currency || prev.currency,
          } : prev);
        }

        if (data.msg_type === 'proposal' && data.req_id) {
          const waiter = proposalWaitersRef.current[data.req_id];
          if (waiter) { waiter(data); delete proposalWaitersRef.current[data.req_id]; }
        }

        // FIX: Changed 9100 to 9000 to catch the first 100 trades
        if (data.msg_type === 'buy' && data.req_id && data.req_id >= 9000) {
          if (data.error) { console.warn('[StingerFX] Buy error:', data.error); return; }
          const b = data.buy;
          console.log('[StingerFX] Bought contract', b.contract_id);
          ws.send(JSON.stringify({
            proposal_open_contract: 1,
            contract_id: b.contract_id,
            subscribe: 1,
            req_id: 20000 + b.contract_id,
          }));
        }

        if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
          const c = data.proposal_open_contract;
          setOpenTrades((prev) => {
            const idx = prev.findIndex((t) => t.contract_id === c.contract_id);
            const trade: OpenTrade = {
              contract_id: c.contract_id,
              symbol: c.underlying || c.symbol || '',
              contract_type: c.contract_type || '',
              buy_price: Number(c.buy_price ?? 0),
              payout: Number(c.payout ?? 0),
              profit: Number(c.profit ?? 0),
              current_spot: Number(c.current_spot ?? 0),
              entry_spot: Number(c.entry_spot ?? 0),
              is_sold: !!c.is_sold,
              longcode: c.longcode,
              entry_time: c.entry_tick_time || c.date_start,
              exit_time: c.exit_tick_time,
            };
            if (idx >= 0) { const n = [...prev]; n[idx] = trade; return n; }
            return [trade, ...prev];
          });
          if (c.is_sold) console.log('[StingerFX] Settled contract', c.contract_id, 'profit', c.profit);
        }

        if (data.msg_type === 'statement' && data.statement) {
          const list = data.statement.transactions || [];
          setStatement(list.map((tx: any) => ({
            transaction_id: tx.transaction_id,
            action_type: tx.action_type || 'transaction',
            amount: Number(tx.amount ?? 0),
            balance_after: Number(tx.balance_after ?? 0),
            currency: tx.currency || '',
            transaction_time: tx.transaction_time,
            longcode: tx.longcode,
          })));
        }

        if (data.msg_type === 'portfolio' && data.portfolio) {
          console.log('[StingerFX] Portfolio:', (data.portfolio.contracts || []).length, 'open contracts');
        }

        if (data.error) console.warn('[StingerFX] API error:', data.error);
      };

      ws.onerror = () => setError('WebSocket error — check your connection.');
      ws.onclose = () => console.log('[StingerFX] WebSocket closed');

      setAuthorized(true);
      setUser((prev) => prev ? { ...prev, activeAccountId: accountId } : prev);
    } catch (err: any) {
      console.error('[StingerFX] connect error:', err);
      setError(err.message || 'Failed to connect');
    }
  };

  useEffect(() => {
    let token: string | null = null;
    try { token = sessionStorage.getItem('sfx_access_token'); } catch {}
    if (!token) return;
    tokenRef.current = token;

    (async () => {
      try {
        const accounts = await fetchAccounts(token);
        accountsRef.current = accounts;
        console.log('[StingerFX] Accounts fetched:', accounts);
        if (!accounts.length) { setError('No trading accounts found on this profile.'); return; }
        const primary = accounts.find((a) => a.account_type === 'demo') || accounts[0];
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

    return () => { try { wsRef.current?.close(); } catch {} wsRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchAccount = (accountId: string) => {
    const acct = accountsRef.current.find((a) => a.account_id === accountId);
    if (!acct) return;
    setUser((prev) => prev ? {
      ...prev,
      loginid: acct.loginid || acct.account_id,
      balance: acct.balance,
      currency: acct.currency,
      isVirtual: acct.account_type === 'demo',
      activeAccountId: accountId,
    } : prev);
    setOpenTrades([]);
    setStatement([]);
    connectWithAccount(accountId);
  };

  const requestStatement = (limit = 20) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ statement: 1, limit, req_id: 7777 }));
    } else {
      console.warn('[StingerFX] requestStatement: socket not open');
    }
  };

  const send = (msg: Record<string, any>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else console.warn('[StingerFX] Cannot send — socket not open.');
  };

  const placeTrade = (input: PlaceTradeInput) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[StingerFX] placeTrade: socket not ready');
      return;
    }
    const propReqId = ++proposalIdCounterRef.current;
    const buyReqId = propReqId + 100;

    const proposalReq: Record<string, any> = {
      proposal: 1,
      amount: input.stake,
      basis: 'stake',
      contract_type: input.contractType,
      currency: input.currency || 'USD',
      duration: input.duration,
      duration_unit: input.durationUnit,
      underlying_symbol: input.symbol,
      req_id: propReqId,
    };
    if (input.barrier) proposalReq.barrier = input.barrier;

    console.log('[StingerFX] Sending proposal:', proposalReq);

    proposalWaitersRef.current[propReqId] = (resp) => {
      if (resp.error) { 
        console.warn('[StingerFX] Proposal error:', resp.error.message); 
        return; 
      }
      const prop = resp.proposal;
      // FIX: Ensure proposal exists before trying to buy it
      if (!prop || !prop.id) {
        console.warn('[StingerFX] No proposal returned in response');
        return;
      }
      console.log('[StingerFX] Got proposal', prop.id, 'payout', prop.payout);
      ws.send(JSON.stringify({
        buy: prop.id,
        price: Number(prop.ask_price),
        req_id: buyReqId,
      }));
    };

    ws.send(JSON.stringify(proposalReq));
  };

  return {
    authorized,
    user,
    error,
    openTrades,
    statement,
    requestStatement,
    send,
    switchAccount,
    placeTrade,
  };
}