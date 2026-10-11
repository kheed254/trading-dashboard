import { useEffect, useState } from 'react';
import { useAuthWs } from '../lib/auth-ws-context';

type PaperTrade = {
  id: string;
  market: string;
  symbol: string;
  type: string;
  direction: string;
  stake: number;
  ticks: number;
  entryPrice?: number;
  profit?: number;
  closed: boolean;
  timestamp: number;
};

const STORAGE_KEY = 'paper_trades';

export default function Reports() {
  const { authorized, statement } = useAuthWs();
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);

  /* ---- Load paper trades from localStorage ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPaperTrades(JSON.parse(raw));
    } catch {}
  }, []);

  /* ---- Compute stats from paper trades ---- */
  const stats = (() => {
    const closed = paperTrades.filter((t) => t.closed);
    const wins = closed.filter((t) => (t.profit ?? 0) > 0);
    const losses = closed.filter((t) => (t.profit ?? 0) <= 0);
    const totalPL = closed.reduce((sum, t) => sum + (t.profit ?? 0), 0);
    const totalStake = closed.reduce((sum, t) => sum + t.stake, 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const best = closed.reduce((max, t) => Math.max(max, t.profit ?? 0), 0);
    const worst = closed.reduce((min, t) => Math.min(min, t.profit ?? 0), 0);
    return {
      totalPL,
      winRate,
      wins: wins.length,
      losses: losses.length,
      totalStake,
      totalTrades: closed.length,
      best,
      worst,
    };
  })();

  const handleClearPaperTrades = () => {
    if (!confirm('Clear all paper trades?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setPaperTrades([]);
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* ============ CLEAR BUTTON ============ */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleClearPaperTrades}
            className="text-xs text-red-600 hover:text-red-700 border border-red-300 hover:border-red-500 rounded-lg px-3 py-1.5 font-medium transition"
          >
            Clear Paper Trades
          </button>
        </div>

        {/* ============ STATS GRID ============ */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Total P/L */}
          <div className={`rounded-xl p-4 border ${
            stats.totalPL > 0 ? 'bg-green-50 border-green-200' :
            stats.totalPL < 0 ? 'bg-red-50 border-red-200' :
            'bg-white border-gray-200'
          }`}>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Total P/L
            </div>
            <div className={`text-2xl font-bold font-mono ${
              stats.totalPL > 0 ? 'text-green-600' :
              stats.totalPL < 0 ? 'text-red-600' :
              'text-navy'
            }`}>
              {stats.totalPL.toFixed(2)} USD
            </div>
          </div>

          {/* Win Rate */}
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Win Rate
            </div>
            <div className="text-2xl font-bold text-navy">
              {stats.winRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {stats.wins}W / {stats.losses}L
            </div>
          </div>

          {/* Trades */}
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Trades
            </div>
            <div className="text-2xl font-bold text-navy">
              {stats.totalTrades}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              Stake: {stats.totalStake.toFixed(2)} USD
            </div>
          </div>

          {/* Best / Worst */}
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Best / Worst
            </div>
            <div className="flex items-baseline gap-1 font-mono text-2xl font-bold">
              <span className="text-green-600">+{stats.best.toFixed(2)}</span>
              <span className="text-gray-300">/</span>
              <span className="text-red-600">{stats.worst.toFixed(2)}</span>
            </div>
          </div>

          {/* Deposits / Withdrawals */}
          <div className="rounded-xl p-4 bg-white border border-gray-200 col-span-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Deposits / Withdrawals
            </div>
            <div className="flex items-baseline gap-1 font-mono text-2xl font-bold">
              <span className="text-green-600">+10000.00</span>
              <span className="text-gray-300">/</span>
              <span className="text-red-600">-0.00</span>
            </div>
          </div>
        </div>

        {/* ============ TABLE ============ */}
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
          {/* Table header */}
          <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-4 py-3 bg-[#0b1c3f] text-white text-xs font-semibold">
            <div>Source</div>
            <div>Market</div>
            <div>Type</div>
          </div>

          {/* Table rows */}
          {paperTrades.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-12">
              No trades yet
            </div>
          ) : (
            paperTrades.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[80px_1fr_1fr] gap-2 px-4 py-3 border-b border-gray-100 last:border-0 text-xs items-center"
              >
                <div>
                  <span className="inline-block bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Paper
                  </span>
                </div>
                <div className="text-navy truncate">{t.market}</div>
                <div className="text-gray-600 truncate">
                  {t.type} · {t.direction}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ============ REAL STATEMENT (if authorized) ============ */}
        {authorized && statement.length > 0 && (
          <div className="mt-6 rounded-xl overflow-hidden border border-gray-200 bg-white">
            <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
              <div className="text-sm font-semibold text-navy">Account Statement</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Latest {statement.length} transactions
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {statement.slice(0, 10).map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.transaction_id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-navy capitalize truncate">
                        {tx.action_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {new Date(tx.transaction_time * 1000).toLocaleString()}
                      </div>
                    </div>
                    <div className={`text-xs font-bold font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{tx.amount.toFixed(2)} {tx.currency}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}