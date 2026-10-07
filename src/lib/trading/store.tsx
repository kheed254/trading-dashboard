import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Trade } from './types';
import {
  openTrade,
  settleTrade,
  tradeDurationMs,
  computeStats,
  type OpenTradeInput,
} from './engine';

/* ---------- Persistence key ---------- */
const STORAGE_KEY = 'derivanalyser:trades:v1';

function loadTradesFromStorage(): Trade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Trade[];
  } catch {
    return [];
  }
}

function saveTradesToStorage(trades: Trade[]) {
  try {
    // Only persist the last 500 trades to keep localStorage small
    const trimmed = trades.slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

/* ---------- Context type ---------- */
type TradeStore = {
  trades: Trade[];
  stats: ReturnType<typeof computeStats>;
  /** Open a paper trade. Returns the created trade id or null on failure. */
  placeTrade: (input: OpenTradeInput) => string | null;
  /** Manually settle an open trade (used for testing / close-early). */
  closeTrade: (id: string) => void;
  /** Remove all trades. */
  clearAll: () => void;
};

const TradeContext = createContext<TradeStore | null>(null);

/* ---------- Provider ---------- */
export function TradeProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>(() =>
    loadTradesFromStorage()
  );

  // Keep timers so we can clear them on unmount
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  /* ---- Persist to localStorage whenever trades change ---- */
  useEffect(() => {
    saveTradesToStorage(trades);
  }, [trades]);

  /* ---- Schedule settlement for open trades (in case page was reloaded) ---- */
  useEffect(() => {
    const now = Date.now();
    trades.forEach((t) => {
      if (t.status === 'open' && !timersRef.current[t.id]) {
        const duration = tradeDurationMs(t.ticks);
        const elapsed = now - t.openedAt;
        const remaining = Math.max(500, duration - elapsed);

        timersRef.current[t.id] = setTimeout(() => {
          setTrades((prev) =>
            prev.map((x) => (x.id === t.id ? settleTrade(x) : x))
          );
          delete timersRef.current[t.id];
        }, remaining);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Clean up all timers on unmount ---- */
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  /* ---- Actions ---- */
  const placeTrade = useCallback((input: OpenTradeInput): string | null => {
    const result = openTrade(input);
    if (!result.ok) {
      alert(result.reason);
      return null;
    }
    const trade = result.trade;
    setTrades((prev) => [...prev, trade]);

    // Schedule auto-settlement
    const duration = tradeDurationMs(trade.ticks);
    timersRef.current[trade.id] = setTimeout(() => {
      setTrades((prev) =>
        prev.map((x) => (x.id === trade.id ? settleTrade(x) : x))
      );
      delete timersRef.current[trade.id];
    }, duration);

    return trade.id;
  }, []);

  const closeTrade = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setTrades((prev) =>
      prev.map((t) => (t.id === id ? settleTrade(t) : t))
    );
  }, []);

  const clearAll = useCallback(() => {
    Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    timersRef.current = {};
    setTrades([]);
  }, []);

  const stats = computeStats(trades);

  return (
    <TradeContext.Provider
      value={{ trades, stats, placeTrade, closeTrade, clearAll }}
    >
      {children}
    </TradeContext.Provider>
  );
}

/* ---------- Hook ---------- */
export function useTradeStore(): TradeStore {
  const ctx = useContext(TradeContext);
  if (!ctx) {
    throw new Error('useTradeStore must be used inside <TradeProvider>');
  }
  return ctx;
}