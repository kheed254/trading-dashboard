import { useEffect, useMemo, useState } from 'react';
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

type DateRange = 'all' | 'today' | '7d' | '30d';
type SourceFilter = 'all' | 'paper' | 'real';
type ResultFilter = 'all' | 'wins' | 'losses';

export default function Reports() {
  const { authorized, statement } = useAuthWs();
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

  /* ---- Load paper trades from localStorage ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPaperTrades(JSON.parse(raw));
    } catch {}
  }, []);

  /* ---- Date filter helper ---- */
  const withinDateRange = (timestampSeconds: number): boolean => {
    if (dateRange === 'all') return true;
    const now = Date.now() / 1000;
    const diff = now - timestampSeconds;
    if (dateRange === 'today') return diff < 60 * 60 * 24;
    if (dateRange === '7d') return diff < 60 * 60 * 24 * 7;
    if (dateRange === '30d') return diff < 60 * 60 * 24 * 30;
    return true;
  };

  /* ---- Filter paper trades ---- */
  const filteredPaper = useMemo(() => {
    return paperTrades.filter((t) => {
      if (!withinDateRange(t.timestamp / 1000)) return false;
      if (resultFilter === 'wins' && (t.profit ?? 0) <= 0) return false;
      if (resultFilter === 'losses' && (t.profit ?? 0) > 0) return false;
      return true;
    });
  }, [paperTrades, dateRange, resultFilter]);

  /* ---- Filter real (statement) entries ---- */
  const filteredReal = useMemo(() => {
    return statement.filter((tx) => {
      if (!withinDateRange(tx.transaction_time)) return false;
      if (resultFilter === 'wins' && tx.amount <= 0) return false;
      if (resultFilter === 'losses' && tx.amount > 0) return false;
      return true;
    });
  }, [statement, dateRange, resultFilter]);

  /* ---- Show the right source ---- */
  const showPaper = sourceFilter === 'all' || sourceFilter === 'paper';
  const showReal = sourceFilter === 'all' || sourceFilter === 'real';

  /* ---- Stats: combined P/L, win rate, trades ---- */
  const stats = useMemo(() => {
    const closedPaper = filteredPaper.filter((t) => t.closed);
    const paperWins = closedPaper.filter((t) => (t.profit ?? 0) > 0).length;
    const paperLosses = closedPaper.filter((t) => (t.profit ?? 0) <= 0).length;
    const paperPL = closedPaper.reduce((sum, t) => sum + (t.profit ?? 0), 0);
    const paperStake = closedPaper.reduce((sum, t) => sum + t.stake, 0);

    const realWins = filteredReal.filter((tx) => tx.amount > 0).length;
    const realLosses = filteredReal.filter((tx) => tx.amount <= 0).length;
    const realPL = filteredReal.reduce((sum, tx) => sum + tx.amount, 0);

    const wins = paperWins + realWins;
    const losses = paperLosses + realLosses;
    const totalTrades = wins + losses;
    const totalPL = paperPL + realPL;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    const allPLs = [
      ...closedPaper.map((t) => t.profit ?? 0),
      ...filteredReal.map((tx) => tx.amount),
    ];
    const best = allPLs.length ? Math.max(...allPLs) : 0;
    const worst = allPLs.length ? Math.min(...allPLs) : 0;

    return {
      totalPL,
      winRate,
      wins,
      losses,
      totalTrades,
      paperStake,
      best,
      worst,
    };
  }, [filteredPaper, filteredReal]);

  /* ---- Clear paper trades ---- */
  const handleClearPaperTrades = () => {
    if (!confirm('Clear all paper trades?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setPaperTrades([]);
  };

  /* ---- CSV export ---- */
  const handleExport = () => {
    const rows: string[][] = [];

    // Header
    rows.push(['Source', 'Date', 'Market/Symbol', 'Type/Direction', 'Stake/Amount', 'Profit', 'Closed']);

    // Paper trades
    if (showPaper) {
      filteredPaper.forEach((t) => {
        rows.push([
          'Paper',
          new Date(t.timestamp).toISOString(),
          t.market,
          `${t.type} ${t.direction}`,
          t.stake.toFixed(2),
          (t.profit ?? 0).toFixed(2),
          t.closed ? 'Yes' : 'No',
        ]);
      });
    }

    // Real trades
    if (showReal) {
      filteredReal.forEach((tx) => {
        rows.push([
          'Real',
          new Date(tx.transaction_time * 1000).toISOString(),
          'Statement',
          tx.action_type || 'transaction',
          '-',
          tx.amount.toFixed(2),
          'Yes',
        ]);
      });
    }

    // Build CSV string
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stingerfx-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* ============ TOP ACTION BUTTONS ============ */}
        <div className="flex justify-end gap-2 mb-4">
          <button
            onClick={handleExport}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            📥 Export CSV
          </button>
          <button
            onClick={handleClearPaperTrades}
            className="text-xs text-red-600 hover:text-red-700 border border-red-300 hover:border-red-500 rounded-lg px-3 py-2 font-medium transition"
          >
            Clear Paper
          </button>
        </div>

        {/* ============ FILTERS ============ */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
            Date Range
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {([
              ['all', 'All'],
              ['today', 'Today'],
              ['7d', '7 Days'],
              ['30d', '30 Days'],
            ] as [DateRange, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                className={`py-2 rounded-md text-xs font-semibold transition ${
                  dateRange === value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
            Source
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {([
              ['all', 'All'],
              ['paper', 'Paper'],
              ['real', 'Real'],
            ] as [SourceFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSourceFilter(value)}
                className={`py-2 rounded-md text-xs font-semibold transition ${
                  sourceFilter === value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
            Result
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              ['all', 'All'],
              ['wins', 'Wins'],
              ['losses', 'Losses'],
            ] as [ResultFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setResultFilter(value)}
                className={`py-2 rounded-md text-xs font-semibold transition ${
                  resultFilter === value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ============ STATS GRID ============ */}
        <div className="grid grid-cols-2 gap-3 mb-4">
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

          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Trades
            </div>
            <div className="text-2xl font-bold text-navy">
              {stats.totalTrades}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {filteredPaper.length} paper · {filteredReal.length} real
            </div>
          </div>

          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Best / Worst
            </div>
            <div className="flex items-baseline gap-1 font-mono text-xl font-bold">
              <span className="text-green-600">+{stats.best.toFixed(2)}</span>
              <span className="text-gray-300">/</span>
              <span className="text-red-600">{stats.worst.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ============ PAPER TRADES TABLE ============ */}
        {showPaper && (
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white mb-4">
            <div className="px-4 py-3 bg-[#0b1c3f] flex items-center justify-between">
              <div className="text-white text-xs font-bold">Paper Trades</div>
              <div className="text-white/70 text-[10px]">{filteredPaper.length} rows</div>
            </div>
            <div className="grid grid-cols-[70px_1fr_1fr_60px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              <div>Source</div>
              <div>Market</div>
              <div>Type</div>
              <div className="text-right">P/L</div>
            </div>
            {filteredPaper.length === 0 ? (
              <div className="text-center text-gray-400 text-xs py-8">
                No paper trades match the filters
              </div>
            ) : (
              filteredPaper.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[70px_1fr_1fr_60px] gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 text-[11px] items-center"
                >
                  <div>
                    <span className="inline-block bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      Paper
                    </span>
                  </div>
                  <div className="text-navy truncate">{t.market}</div>
                  <div className="text-gray-600 truncate">
                    {t.type} · {t.direction}
                  </div>
                  <div className={`text-right font-mono font-semibold ${
                    (t.profit ?? 0) > 0 ? 'text-green-600' :
                    (t.profit ?? 0) < 0 ? 'text-red-600' :
                    'text-gray-400'
                  }`}>
                    {t.closed ? `${(t.profit ?? 0) >= 0 ? '+' : ''}${(t.profit ?? 0).toFixed(2)}` : 'open'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============ REAL TRADES TABLE ============ */}
        {showReal && authorized && (
          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            <div className="px-4 py-3 bg-[#0b1c3f] flex items-center justify-between">
              <div className="text-white text-xs font-bold">Real Account Statement</div>
              <div className="text-white/70 text-[10px]">{filteredReal.length} rows</div>
            </div>
            <div className="grid grid-cols-[70px_1fr_1fr_70px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              <div>Source</div>
              <div>Action</div>
              <div>Date</div>
              <div className="text-right">Amount</div>
            </div>
            {filteredReal.length === 0 ? (
              <div className="text-center text-gray-400 text-xs py-8">
                No real trades match the filters
              </div>
            ) : (
              filteredReal.slice(0, 50).map((tx) => (
                <div
                  key={tx.transaction_id}
                  className="grid grid-cols-[70px_1fr_1fr_70px] gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 text-[11px] items-center"
                >
                  <div>
                    <span className="inline-block bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      Real
                    </span>
                  </div>
                  <div className="text-navy capitalize truncate">
                    {tx.action_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-gray-500 font-mono text-[10px]">
                    {new Date(tx.transaction_time * 1000).toLocaleString()}
                  </div>
                  <div className={`text-right font-mono font-semibold ${
                    tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                  </div>
                </div>
              ))
            )}
            {filteredReal.length > 50 && (
              <div className="text-center text-gray-400 text-[10px] py-2 bg-gray-50">
                Showing first 50 of {filteredReal.length}
              </div>
            )}
          </div>
        )}

        {/* ============ NOT LOGGED IN WARNING ============ */}
        {!authorized && sourceFilter === 'real' && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
            <div className="text-yellow-700 text-xs font-medium">
              ⚠ Log in to see your real account statement.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}