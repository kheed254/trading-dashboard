import { useMemo, useState } from 'react';
import { useTradeStore } from '../lib/trading/store';
import { useAuthWs } from '../lib/auth-ws';

type Period = 'today' | '7d' | '30d' | 'all';
type Source = 'all' | 'real' | 'paper';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
];

const SOURCES: { id: Source; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'real', label: 'Real' },
  { id: 'paper', label: 'Paper' },
];

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* Unified row shape — both real and paper trades map to this */
type UnifiedTrade = {
  id: string;
  source: 'real' | 'paper';
  market: string;
  type: string;
  stake: number;
  payout: number;
  profit: number;
  status: 'won' | 'lost' | 'open';
  closedAt: number;
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'trades' | 'statement'>(
    'trades'
  );
  const [period, setPeriod] = useState<Period>('7d');
  const [source, setSource] = useState<Source>('all');

  const { trades: paperTrades, clearAll } = useTradeStore();
  const { authorized, openTrades } = useAuthWs();

  /* ============ Combine ============ */
  const allTrades: UnifiedTrade[] = useMemo(() => {
    const real: UnifiedTrade[] = openTrades.map((t) => ({
      id: `real-${t.contract_id}`,
      source: 'real',
      market: t.symbol || 'Volatility',
      type: t.contract_type || '',
      stake: t.buy_price,
      payout: t.is_sold ? t.payout : 0,
      profit: t.profit || 0,
      status: t.is_sold ? (t.profit > 0 ? 'won' : 'lost') : 'open',
      closedAt: (t.exit_time || t.entry_time || 0) * 1000 || Date.now(),
    }));

    const paper: UnifiedTrade[] = paperTrades
      .filter((t) => t.status !== 'open')
      .map((t) => ({
        id: `paper-${t.id}`,
        source: 'paper',
        market: t.market,
        type: `${t.type.replace('_', ' ')} · ${t.direction}`,
        stake: t.stake,
        payout: t.status === 'won' ? t.payout : 0,
        profit: t.profit ?? 0,
        status: t.status === 'won' ? 'won' : 'lost',
        closedAt: t.closedAt ?? Date.now(),
      }));

    return [...real, ...paper].sort((a, b) => b.closedAt - a.closedAt);
  }, [openTrades, paperTrades]);

  /* ============ Filter ============ */
  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    let list = allTrades;

    /* By source */
    if (source === 'real') list = list.filter((t) => t.source === 'real');
    if (source === 'paper') list = list.filter((t) => t.source === 'paper');

    /* By period */
    if (period === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      list = list.filter((t) => t.closedAt >= start.getTime());
    } else if (period === '7d') {
      list = list.filter((t) => now - t.closedAt <= 7 * day);
    } else if (period === '30d') {
      list = list.filter((t) => now - t.closedAt <= 30 * day);
    }

    return list;
  }, [allTrades, source, period]);

  /* ============ Stats ============ */
  const stats = useMemo(() => {
    const closed = filtered.filter((t) => t.status !== 'open');
    const totalPL = closed.reduce((s, t) => s + t.profit, 0);
    const wins = closed.filter((t) => t.status === 'won').length;
    const losses = closed.filter((t) => t.status === 'lost').length;
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    const totalStake = closed.reduce((s, t) => s + t.stake, 0);
    const best =
      closed.length > 0 ? Math.max(...closed.map((t) => t.profit)) : 0;
    const worst =
      closed.length > 0 ? Math.min(...closed.map((t) => t.profit)) : 0;

    return {
      totalPL,
      wins,
      losses,
      winRate,
      totalStake,
      best,
      worst,
      count: closed.length,
    };
  }, [filtered]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-5 py-2 text-sm font-semibold rounded-md transition ${
            activeTab === 'trades'
              ? 'bg-teal-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Trades
        </button>
        <button
          onClick={() => setActiveTab('statement')}
          className={`px-5 py-2 text-sm font-semibold rounded-md transition ${
            activeTab === 'statement'
              ? 'bg-teal-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Statement
        </button>
      </div>

      {activeTab === 'trades' ? (
        <>
          {/* Source filter */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
              Source:
            </span>
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  source === s.id
                    ? 'bg-teal-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Period filter */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
              Period:
            </span>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  period === p.id
                    ? 'bg-navy text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                if (
                  paperTrades.length === 0 ||
                  confirm('Clear all paper trade history?')
                ) {
                  clearAll();
                }
              }}
              className="ml-auto px-3 py-1 text-xs font-medium bg-white border border-red-300 text-red-600 rounded-md hover:bg-red-50"
            >
              Clear Paper Trades
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatBox
              label="Total P/L"
              value={`${stats.totalPL.toFixed(2)} USD`}
              highlight={
                stats.totalPL > 0
                  ? 'green'
                  : stats.totalPL < 0
                  ? 'red'
                  : 'none'
              }
            />
            <StatBox
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              sub={`${stats.wins}W / ${stats.losses}L`}
            />
            <StatBox
              label="Trades"
              value={String(stats.count)}
              sub={`Stake: ${stats.totalStake.toFixed(2)} USD`}
            />
            <StatBox
              label="Best / Worst"
              value=""
              custom={
                <div className="flex gap-1 text-lg font-semibold">
                  <span className="text-green-600">
                    +{stats.best.toFixed(2)}
                  </span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-600">
                    {stats.worst.toFixed(2)}
                  </span>
                </div>
              }
            />
            <StatBox
              label="Deposits / Withdrawals"
              value=""
              custom={
                <div className="flex gap-1 text-lg font-semibold">
                  <span className="text-green-600">+10000.00</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-600">-0.00</span>
                </div>
              }
            />
          </div>

          {/* Unified table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-navy text-white text-xs font-semibold overflow-x-auto">
              <div className="grid grid-cols-7 gap-2 px-4 py-3 min-w-[720px]">
                <div>Source</div>
                <div>Market</div>
                <div>Type</div>
                <div className="text-right">Stake</div>
                <div className="text-right">Payout</div>
                <div className="text-right">Profit / Loss</div>
                <div className="text-right">Closed</div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-12">
                No trades match this filter.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-x-auto">
                <div className="min-w-[720px]">
                  {filtered.map((t) => (
                    <div
                      key={t.id}
                      className="grid grid-cols-7 gap-2 px-4 py-3 text-sm hover:bg-gray-50 items-center"
                    >
                      {/* Source badge */}
                      <div>
                        {t.source === 'real' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            ● Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                            ● Paper
                          </span>
                        )}
                      </div>

                      <div className="font-medium text-navy truncate">
                        {t.market}
                      </div>
                      <div className="text-gray-600 text-xs truncate">
                        {t.type}
                      </div>
                      <div className="text-right font-mono text-xs">
                        {t.stake.toFixed(2)}
                      </div>
                      <div className="text-right font-mono text-xs">
                        {t.status === 'open' ? '—' : t.payout.toFixed(2)}
                      </div>
                      <div
                        className={`text-right font-mono font-semibold text-xs ${
                          t.status === 'open'
                            ? 'text-gray-400'
                            : t.profit >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {t.status === 'open'
                          ? 'open'
                          : `${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}`}
                      </div>
                      <div className="text-right text-gray-500 text-xs">
                        {t.status === 'open'
                          ? 'live'
                          : new Date(t.closedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Helper text */}
          {!authorized && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Log in to also see your real Deriv trades here.
            </p>
          )}
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-sm text-gray-400">
          Statement history coming soon.
        </div>
      )}

      {/* AI floating button */}
      <button className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
        AI
      </button>
    </main>
  );
}

/* ---------- Small components ---------- */
function StatBox({
  label,
  value,
  sub,
  highlight = 'none',
  custom,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'none' | 'green' | 'red';
  custom?: React.ReactNode;
}) {
  const bg =
    highlight === 'green'
      ? 'bg-green-50'
      : highlight === 'red'
      ? 'bg-red-50'
      : 'bg-white';

  const valueColor =
    highlight === 'green'
      ? 'text-green-600'
      : highlight === 'red'
      ? 'text-red-600'
      : 'text-navy';

  return (
    <div className={`border border-gray-200 rounded-lg p-4 ${bg}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">
        {label}
      </div>
      {custom ? (
        custom
      ) : (
        <>
          <div className={`text-lg font-semibold ${valueColor}`}>
            {value}
          </div>
          {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </>
      )}
    </div>
  );
}