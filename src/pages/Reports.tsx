import { useState } from 'react';

type Period = 'today' | '7d' | '30d' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
];

/* Placeholder trade — will be replaced by real trades later */
type Trade = {
  id: string;
  market: string;
  type: string;
  stake: number;
  payout: number;
  profit: number;
  closed: string;
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'trades' | 'statement'>('trades');
  const [period, setPeriod] = useState<Period>('7d');
  const [trades] = useState<Trade[]>([]); // empty for now

  /* Derived stats */
  const totalPL = trades.reduce((s, t) => s + t.profit, 0);
  const wins = trades.filter((t) => t.profit > 0).length;
  const losses = trades.filter((t) => t.profit < 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const totalStake = trades.reduce((s, t) => s + t.stake, 0);
  const best = trades.length > 0 ? Math.max(...trades.map((t) => t.profit)) : 0;
  const worst = trades.length > 0 ? Math.min(...trades.map((t) => t.profit)) : 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
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
          {/* Period filter */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
                  period === p.id
                    ? 'bg-navy text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button className="ml-auto px-4 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100">
              Refresh
            </button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatBox
              label="Total P/L"
              value={`${totalPL.toFixed(2)} USD`}
              highlight={totalPL > 0 ? 'green' : totalPL < 0 ? 'red' : 'none'}
            />
            <StatBox
              label="Win Rate"
              value={`${winRate.toFixed(1)}%`}
              sub={`${wins}W / ${losses}L`}
            />
            <StatBox
              label="Trades"
              value={String(trades.length)}
              sub={`Stake: ${totalStake.toFixed(2)} USD`}
            />
            <StatBox
              label="Best / Worst"
              value=""
              sub=""
              custom={
                <div className="flex gap-1 text-lg font-semibold">
                  <span className="text-green-600">
                    +{best.toFixed(2)}
                  </span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-600">
                    {worst.toFixed(2)}
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

          {/* Trade table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-navy text-white text-xs font-semibold">
              <div className="grid grid-cols-6 gap-2 px-4 py-3">
                <div>Market</div>
                <div>Type</div>
                <div className="text-right">Stake</div>
                <div className="text-right">Payout</div>
                <div className="text-right">Profit / Loss</div>
                <div className="text-right">Closed</div>
              </div>
            </div>

            {/* Body */}
            {trades.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-16">
                No closed trades in this period.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {trades.map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-6 gap-2 px-4 py-3 text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium text-navy">{t.market}</div>
                    <div className="text-gray-600">{t.type}</div>
                    <div className="text-right font-mono">
                      {t.stake.toFixed(2)}
                    </div>
                    <div className="text-right font-mono">
                      {t.payout.toFixed(2)}
                    </div>
                    <div
                      className={`text-right font-mono font-semibold ${
                        t.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {t.profit >= 0 ? '+' : ''}
                      {t.profit.toFixed(2)}
                    </div>
                    <div className="text-right text-gray-500">
                      {t.closed}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Statement tab */
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
    <div
      className={`border border-gray-200 rounded-lg p-4 ${bg}`}
    >
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