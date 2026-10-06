import { useEffect, useRef, useState } from 'react';
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
} as const;

export type SymbolCode = keyof typeof SYMBOLS;

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

    const ws = new WebSocket(DERIV_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'tick' && data.tick) {
          const p = Number(data.tick.quote);
          setPrice(p);
          setHistory((h) => [...h, p].slice(-20));
        }
        if (data.error) setError(data.error.message || 'Unknown error');
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => setError('WebSocket error');
    ws.onclose = () => setConnected(false);

    return () => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ forget_all: 'ticks' }));
        }
      } catch {
        /* ignore */
      }
      ws.close();
    };
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

    const ws = new WebSocket(DERIV_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      symbols.forEach((s) => {
        ws.send(JSON.stringify({ ticks: s, subscribe: 1 }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => setError('WebSocket error');
    ws.onclose = () => setConnected(false);

    return () => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ forget_all: 'ticks' }));
        }
      } catch {
        /* ignore */
      }
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return { ticks, connected, error };
}

/* ---------- Hook: useDigitStream ---------- */
/**
 * Subscribes to live ticks for a single symbol and keeps a rolling
 * window of the last N last-digits. Also tracks current price and
 * current last digit.
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

  useEffect(() => {
    setError(null);
    setConnected(false);
    setPrice(null);
    setCurrentDigit(null);
    setDigits([]);

    const ws = new WebSocket(DERIV_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'tick' && data.tick) {
          const p = Number(data.tick.quote);
          const d = lastDigit(p);
          setPrice(p);
          setCurrentDigit(d);
          setDigits((prev) => {
            const next = [...prev, d];
            const cap = windowRef.current;
            return next.length > cap ? next.slice(-cap) : next;
          });
        }
        if (data.error) setError(data.error.message || 'Unknown error');
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => setError('WebSocket error');
    ws.onclose = () => setConnected(false);

    return () => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ forget_all: 'ticks' }));
        }
      } catch {
        /* ignore */
      }
      ws.close();
    };
  }, [symbol]);

  return { price, currentDigit, digits, connected, error };
}