import { useEffect, useMemo, useRef, useState } from 'react';
import { lastDigit } from './digitStats';

/* ---------- Config ---------- */
export const DERIV_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

/* ---------- Market symbol → Display name ---------- */
export const SYMBOLS = {
  R_10: 'Volatility 10 Index',
  R_25: 'Volatility 25 Index',
  R_50: 'Volatility 50 Index',
  R_75: 'Volatility 75 Index',
  R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ25V': 'Volatility 25 (1s) Index',
  '1HZ30V': 'Volatility 30 (1s) Index',
  '1HZ50V': 'Volatility 50 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  '1HZ15V': 'Volatility 15 (1s) Index',
  '1HZ90V': 'Volatility 90 (1s) Index',
  JD10: 'Jump 10 Index',
  JD25: 'Jump 25 Index',
  JD50: 'Jump 50 Index',
  JD75: 'Jump 75 Index',
  JD100: 'Jump 100 Index',
} as const;

export type SymbolCode = keyof typeof SYMBOLS;

/* ---------- Helper: public socket that reconnects by itself ---------- */
/**
 * Opens the public Deriv socket and, if the connection drops (for example
 * when the internet or DNS is unstable), tries again automatically with a
 * growing delay (2s, 4s, 6s ... up to 15s). Returns a cleanup function.
 */
function connectWithRetry(opts: {
  onOpen: (ws: WebSocket) => void;
  onMessage: (data: any, ws: WebSocket) => void;
  onStatus: (connected: boolean) => void;
  onError: (message: string | null) => void;
  onSocket?: (ws: WebSocket | null) => void;
}) {
  let cancelled = false;
  let current: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;

  const connect = () => {
    if (cancelled) return;
    const ws = new WebSocket(DERIV_WS_URL);
    current = ws;
    opts.onSocket?.(ws);

    ws.onopen = () => {
      if (cancelled || current !== ws) return;
      attempts = 0;
      opts.onError(null);
      opts.onStatus(true);
      opts.onOpen(ws);
    };

    ws.onmessage = (event) => {
      if (cancelled || current !== ws) return;
      try {
        opts.onMessage(JSON.parse(event.data), ws);
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => {
      if (cancelled || current !== ws) return;
      opts.onError('WebSocket error');
    };

    ws.onclose = () => {
      if (cancelled || current !== ws) return;
      opts.onStatus(false);
      attempts += 1;
      timer = setTimeout(connect, Math.min(15000, 2000 * attempts));
    };
  };

  connect();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    const ws = current;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ forget_all: 'ticks' }));
        }
      } catch {
        /* ignore */
      }
      ws.close();
    }
    opts.onSocket?.(null);
  };
}

/* ---------- Hook: useTicks (single symbol) ---------- */
export function useTicks(symbol: SymbolCode) {
  const [price, setPrice] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setError(null);
    setConnected(false);
    setPrice(null);
    setHistory([]);

    return connectWithRetry({
      onOpen: (ws) => {
        ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      },
      onMessage: (data) => {
        if (data.msg_type === 'tick' && data.tick) {
          const p = Number(data.tick.quote);
          setPrice(p);
          setHistory((h) => [...h, p].slice(-20));
        }
        if (data.error) setError(data.error.message || 'Unknown error');
      },
      onStatus: setConnected,
      onError: setError,
      onSocket: (ws) => {
        wsRef.current = ws;
      },
    });
  }, [symbol]);

  return { price, history, connected, error };
}

/* ---------- Hook: useMultiTicks (multiple symbols, one socket) ---------- */
export type TickMap = Record<
  string,
  { price: number | null; history: number[] }
>;

export function useMultiTicks(symbols: SymbolCode[]) {
  const [ticks, setTicks] = useState<TickMap>(() => {
    const initial: TickMap = {};
    symbols.forEach((s) => (initial[s] = { price: null, history: [] }));
    return initial;
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const symbolsKey = symbols.join(',');

  useEffect(() => {
    setError(null);
    setConnected(false);

    const initial: TickMap = {};
    symbols.forEach((s) => (initial[s] = { price: null, history: [] }));
    setTicks(initial);

    return connectWithRetry({
      onOpen: (ws) => {
        symbols.forEach((s) => {
          ws.send(JSON.stringify({ ticks: s, subscribe: 1 }));
        });
      },
      onMessage: (data) => {
        if (data.msg_type === 'tick' && data.tick) {
          const sym = data.tick.symbol as string;
          const p = Number(data.tick.quote);
          setTicks((prev) => {
            const cur = prev[sym] ?? { price: null, history: [] };
            const nextHistory = [...cur.history, p].slice(-20);
            return {
              ...prev,
              [sym]: { price: p, history: nextHistory },
            };
          });
        }
        if (data.error) setError(data.error.message || 'Unknown error');
      },
      onStatus: setConnected,
      onError: setError,
      onSocket: (ws) => {
        wsRef.current = ws;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return { ticks, connected, error };
}

/* ---------- Helper: last digit using the market's decimal places ---------- */
function digitFromQuote(quote: number, pipSize: unknown): number {
  const pip = Number(pipSize);
  if (Number.isFinite(pip) && pip >= 0 && pip <= 10) {
    const last = quote.toFixed(pip).slice(-1);
    const d = Number(last);
    if (Number.isFinite(d)) return d;
  }
  return lastDigit(quote);
}

/* ---------- Hook: useDigitStream ---------- */
/**
 * Loads the last N ticks of history first (so percentages are full from
 * the start), then keeps listening to live ticks. If the connection drops
 * it reconnects by itself and loads the history again. Keeps a rolling
 * window of the last N last-digits, plus the current price and digit.
 */
export function useDigitStream(
  symbol: SymbolCode,
  windowSize: number = 1000
) {
  const [price, setPrice] = useState<number | null>(null);
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [digits, setDigits] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const windowRef = useRef<number>(windowSize);
  windowRef.current = windowSize;

  const requestHistory = (ws: WebSocket, count: number, subscribe: 0 | 1) => {
    ws.send(
      JSON.stringify({
        ticks_history: symbol,
        end: 'latest',
        style: 'ticks',
        count: Math.max(1, Math.min(5000, Math.floor(count))),
        subscribe,
      })
    );
  };

  useEffect(() => {
    setError(null);
    setConnected(false);
    setPrice(null);
    setCurrentDigit(null);
    setDigits([]);

    return connectWithRetry({
      onOpen: (ws) => {
        // History first, then live ticks keep coming on the same subscription
        requestHistory(ws, windowRef.current, 1);
      },
      onMessage: (data, ws) => {
        /* ----- History: fill the window with past ticks ----- */
        if (data.msg_type === 'history' && data.history && Array.isArray(data.history.prices)) {
          const pip = data.pip_size ?? data.history.pip_size;
          const prices: number[] = data.history.prices.map((x: any) => Number(x));
          const ds = prices.map((p) => digitFromQuote(p, pip));
          const cap = windowRef.current;
          setDigits(ds.length > cap ? ds.slice(-cap) : ds);
          if (prices.length) {
            setPrice(prices[prices.length - 1]);
            setCurrentDigit(ds[ds.length - 1]);
          }
        }

        /* ----- Live tick ----- */
        if (data.msg_type === 'tick' && data.tick) {
          const p = Number(data.tick.quote);
          const d = digitFromQuote(p, data.tick.pip_size);
          setPrice(p);
          setCurrentDigit(d);
          setDigits((prev) => {
            const next = [...prev, d];
            const cap = windowRef.current;
            return next.length > cap ? next.slice(-cap) : next;
          });
        }

        if (data.error) {
          setError(data.error.message || 'Unknown error');
          // If history failed, still fall back to live ticks only
          if (data.echo_req && data.echo_req.ticks_history && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
          }
        }
      },
      onStatus: setConnected,
      onError: setError,
      onSocket: (ws) => {
        wsRef.current = ws;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  /* When the user changes the window size, re-load history for the new size */
  const firstWindowRun = useRef(true);
  useEffect(() => {
    if (firstWindowRun.current) {
      firstWindowRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        requestHistory(ws, windowSize, 0); // one-time request, no new subscription
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowSize]);

  return { price, currentDigit, digits, connected, error };
}

/* ================================================================
   MARKET LIST — loaded live from Deriv (active_symbols), so every
   market Deriv offers shows up with its correct name and code.
   Falls back to a built-in list if Deriv can't be reached.
   ================================================================ */
export type MarketItem = { symbol: string; name: string; group: string };
export type MarketGroup = { group: string; options: MarketItem[] };

const GROUP_ORDER = [
  'Continuous Indices',
  'Crash/Boom Indices',
  'Daily Reset Indices',
  'Jump Indices',
  'Step Indices',
  'Range Break Indices',
];

function groupLabel(submarket: unknown): string {
  const key = String(submarket ?? '').toLowerCase();
  if (key.includes('daily')) return 'Daily Reset Indices';
  if (key.includes('random')) return 'Continuous Indices';
  if (key.includes('crash') || key.includes('boom')) return 'Crash/Boom Indices';
  if (key.includes('jump')) return 'Jump Indices';
  if (key.includes('step')) return 'Step Indices';
  if (key.includes('range')) return 'Range Break Indices';
  return key ? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other';
}

/* built-in list used until Deriv answers (or if it never does) */
const FALLBACK_MARKETS: MarketItem[] = (Object.entries(SYMBOLS) as [string, string][]).map(
  ([symbol, name]) => ({
    symbol,
    name,
    group: symbol.startsWith('JD') ? 'Jump Indices' : 'Continuous Indices',
  })
);

function parseActiveSymbols(raw: any[]): MarketItem[] {
  const all: { item: MarketItem; synthetic: boolean }[] = [];
  raw.forEach((s) => {
    const symbol = s.underlying_symbol ?? s.symbol;
    if (!symbol) return;
    if (s.is_trading_suspended === 1) return;
    const name = s.underlying_symbol_name ?? s.display_name ?? symbol;
    const market = String(s.market ?? '');
    all.push({
      item: { symbol: String(symbol), name: String(name), group: groupLabel(s.submarket) },
      synthetic: /synthetic|derived/i.test(market),
    });
  });
  const synthetic = all.filter((x) => x.synthetic).map((x) => x.item);
  // only Deriv's own indices (like the reference site); if the market names are
  // not recognised, show everything instead of showing nothing
  return synthetic.length ? synthetic : all.map((x) => x.item);
}

let cachedMarkets: MarketItem[] | null = null;
let inflightMarkets: Promise<MarketItem[]> | null = null;

function loadMarkets(): Promise<MarketItem[]> {
  if (cachedMarkets) return Promise.resolve(cachedMarkets);
  if (inflightMarkets) return inflightMarkets;

  inflightMarkets = new Promise<{ list: MarketItem[]; ok: boolean }>((resolve) => {
    let finished = false;
    const ws = new WebSocket(DERIV_WS_URL);
    const finish = (list: MarketItem[], ok: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve({ list, ok });
    };
    const timer = setTimeout(() => finish(FALLBACK_MARKETS, false), 8000);

    ws.onopen = () => ws.send(JSON.stringify({ active_symbols: 'brief' }));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'active_symbols' && Array.isArray(data.active_symbols)) {
          const list = parseActiveSymbols(data.active_symbols);
          list.length ? finish(list, true) : finish(FALLBACK_MARKETS, false);
        } else if (data.error) {
          finish(FALLBACK_MARKETS, false);
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => finish(FALLBACK_MARKETS, false);
  }).then(({ list, ok }) => {
    if (ok) cachedMarkets = list;
    inflightMarkets = null;
    return list;
  });

  return inflightMarkets;
}

function buildGroups(items: MarketItem[]): MarketGroup[] {
  const byGroup = new Map<string, MarketItem[]>();
  items.forEach((i) => {
    if (!byGroup.has(i.group)) byGroup.set(i.group, []);
    byGroup.get(i.group)!.push(i);
  });
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    return i < 0 ? 99 : i;
  };
  return Array.from(byGroup.keys())
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((g) => ({
      group: g,
      options: byGroup
        .get(g)!
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    }));
}

/**
 * groups      -> markets split into sections, ready for a dropdown (<optgroup>)
 * symbolFor() -> turns a market name into the code Deriv needs (or undefined)
 */
export function useMarkets() {
  const [items, setItems] = useState<MarketItem[]>(cachedMarkets ?? FALLBACK_MARKETS);

  useEffect(() => {
    let cancelled = false;
    loadMarkets().then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => buildGroups(items), [items]);

  const symbolFor = (name: string): string | undefined =>
    items.find((i) => i.name === name)?.symbol ??
    FALLBACK_MARKETS.find((i) => i.name === name)?.symbol;

  return { groups, items, symbolFor };
}