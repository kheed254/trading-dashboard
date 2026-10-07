import { useState } from 'react';
import { useTradeStore } from '../lib/trading/store';
import { useAuthWs } from '../lib/auth-ws';

type Period = 'today' | '7d' | '30d' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
];

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'trades' | 'statement'>(
    'trades'
  );
  const [period, setPeriod] = useState<Period>('7d');

  /* Paper trades */
  const { trades: allPaperTrades, clearAll } = useTradeStore();

  /* Real Deriv trades */
  const { authorized, openTrades } = useAuthWs();

  /* ============ REAL TRADES ============ */
  const realTrades = openTrades;

  /* Compute stats for real trades */
  const closedRealTrades = realTrades.filter((t) => t.is_sold);
  const realTotalPL = closedRealTrades.reduce((s, t) => s + t.profit, 0);
  const realWins = closedRealTrades.filter((t) => t.profit > 0).length;
  const realLosses = closedRealTrades.filter((t) => t.profit < 0).length;
  const realWinRate =
    closedRealTrades.length > 0
      ? (realWins / closedRealTrades.length) * 100
      : 0;
  const realTotalStake = closedRealTrades.reduce((s, t) => s + t.buy_price, 0);

  /* ============ PAPER TRADES ============ */
  const paperTrades = allPaperTrades
    .filter((t) => t.status !== 'open')
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  const totalPL = paperTrades.reduce((s, t) => s + (t.profit ?? 0), 0);
  const wins = paperTrades.filter((t) => t.status === 'won').length;
  const losses = paperTrades.filter((t) => t.status === 'lost').length;
  const winRate =
    paperTrades.length > 0 ? (wins / paperTrades.length) * 100 : 0;
  const totalStake = paperTrades.reduce((s, t) => s + t.stake, 0);
  const best =
    paperTrades.length > 0
      ? Math.max(...paperTrades.map((t) => t.profit ?? 0))
      : 0;
  const worst =
    paperTrades.length > 0
      ? Math.min(...paperTrades.map((t) => t.profit ?? 0))
      : 0;

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
            <button
              onClick={() => {
                if (
                  paperTrades.length === 0 ||
                  confirm('Clear all paper trade history?')
                ) {
                  clearAll();
                }
              }}
              className="ml-auto px-4 py-1.5 text-xs font-medium bg-white border border-red-300 text-red-600 rounded-md hover:bg-red-50"
            >
              Clear Paper Trades
            </button>
          </div>

          {/* ================================================================
              REAL DERIV TRADES — only when logged in
             ================================================================ */}
          {authorized && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <h2 className="text-base font-semibold text-navy">
                  Real Deriv Trades
                </h2>
                <span className="text-xs text-gray-400">
                  {realTrades.length} contract
                  {realTrades.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Real stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatBox
                  label="Real P/L"
                  value={`${realTotalPL.toFixed(2)} USD`}
                  highlight={
                    realTotalPL > 0
                      ? 'green'
                      : realTotalPL < 0
                      ? 'red'
                      : 'none'
                  }
                />
                <StatBox
                  label="Win Rate"
                  value={`${realWinRate.toFixed(1)}%`}
                  sub={`${realWins}W / ${realLosses}L`}
                />
                <StatBox
                  label="Contracts"
                  value={String(realTrades.length)}
                  sub={`Stake: ${realTotalStake.toFixed(2)} USD`}
                />
                <StatBox
                  label="Open"
                  value={String(
                    realTrades.filter((t) => !t.is_sold).length
                  )}
                  sub="live on WebSocket"
                />
              </div>

              {/* Real trade table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8">
                <div className="bg-navy text-white text-xs font-semibold overflow-x-auto">
                  <div className="grid grid-cols-6 gap-2 px-4 py-3 min-w-[640px]">
                    <div>Market</div>
                    <div>Type</div>
                    <div className="text-right">Stake</div>
                    <div className="text-right">Payout</div>
                    <div className="text-right">Profit / Loss</div>
                    <div className="text-right">Status</div>
                  </div>
                </div>

                {realTrades.length === 0 ? (
                  <div className="text-center text-sm text-gray-400 py-10">
                    No real trades yet. Place one from the{' '}
                    <span className="font-semibold text-navy">
                      Manual Trader
                    </span>{' '}
                    to see it here.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 overflow-x-auto">
                    <div className="min-w-[640px]">
                      {realTrades.map((t) => {
                        const isOpen = !t.is_sold;
                        const won = t.profit > 0;
                        return (
                          <div
                            key={t.contract_id}
                            className="grid grid-cols-6 gap-2 px-4 py-3 text-sm hover:bg-gray-50"
                          >
                            <div className="font-medium text-navy truncate">
                              {t.symbol}
                            </div>
                            <div className="text-gray-600">
                              {t.contract_type}
                            </div>
                            <div className="text-right font-mono">
                              {fmtMoney(t.buy_price)}
                            </div>
                            <div className="text-right font-mono">
                              {isOpen ? '—' : fmtMoney(t.payout)}
                            </div>
                            <div
                              className={`text-right font-mono font-semibold ${
                                isOpen
                                  ? 'text-gray-400'
                                  : won
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {isOpen
                                ? '—'
                                : `${won ? '+' : ''}${fmtMoney(
                                    t.profit
                                  )}`}
                            </div>
                            <div className="text-right">
                              {isOpen ? (
                                <span className="inline-block text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                                  LIVE
                                </span>
                              ) : won ? (
                                <span className="inline-block text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                  WON
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                  LOST
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
              PAPER TRADES — always shown
             ================================================================ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <h2 className="text-base font-semibold text-navy">
                Paper Trades
              </h2>
              <span className="text-xs text-gray-400">
                offline simulation
              </span>
            </div>

            {/* Paper stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <StatBox
                label="Total P/L"
                value={`${totalPL.toFixed(2)} USD`}
                highlight={
                  totalPL > 0 ? 'green' : totalPL < 0 ? 'red' : 'none'
                }
              />
              <StatBox
                label="Win Rate"
                value={`${winRate.toFixed(1)}%`}
                sub={`${wins}W / ${losses}L`}
              />
              <StatBox
                label="Trades"
                value={String(paperTrades.length)}
                sub={`Stake: ${totalStake.toFixed(2)} USD`}
              />
              <StatBox
                label="Best / Worst"
                value=""
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

            {/* Paper trade table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-navy text-white text-xs font-semibold overflow-x-auto">
                <div className="grid grid-cols-6 gap-2 px-4 py-3 min-w-[640px]">
                  <div>Market</div>
                  <div>Type</div>
                  <div className="text-right">Stake</div>
                  <div className="text-right">Payout</div>
                  <div className="text-right">Profit / Loss</div>
                  <div className="text-right">Closed</div>
                </div>
              </div>

              {paperTrades.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-10">
                  No paper trades yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 overflow-x-auto">
                  <div className="min-w-[640px]">
                    {paperTrades.map((t) => (
                      <div
                        key={t.id}
                        className="grid grid-cols-6 gap-2 px-4 py-3 text-sm hover:bg-gray-50"
                      >
                        <div className="font-medium text-navy truncate">
                          {t.market}
                        </div>
                        <div className="text-gray-600">
                          {t.type.replace('_', ' ')} · {t.direction}
                        </div>
                        <div className="text-right font-mono">
                          {t.stake.toFixed(2)}
                        </div>
                        <div className="text-right font-mono">
                          {t.status === 'won'
                            ? t.payout.toFixed(2)
                            : '0.00'}
                        </div>
                        <div
                          className={`text-right font-mono font-semibold ${
                            (t.profit ?? 0) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {(t.profit ?? 0) >= 0 ? '+' : ''}
                          {(t.profit ?? 0).toFixed(2)}
                        </div>
                        <div className="text-right text-gray-500">
                          {t.closedAt
                            ? new Date(t.closedAt).toLocaleTimeString()
                            : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
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