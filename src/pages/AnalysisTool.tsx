import { useMemo, useState } from 'react';
import { useDigitStream } from '../lib/deriv';
import {
  computeDigitStats,
  computeEvenOdd,
  computeOverUnder,
  computeMatchDiff,
  mostFrequent,
  leastFrequent,
} from '../lib/digitStats';

/* ---------- Config ---------- */
const MARKET_MAP: Record<string, string> = {
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 30 (1s) Index': '1HZ30V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
};

const MARKETS = Object.keys(MARKET_MAP);

const SUB_TABS = [
  'Analyzer',
  'Signals',
  'Analysis Tool',
  'SP Tools',
  'Grow Analysis',
  'All Analysis',
  'Ticks Analyzer',
  'Micro AI',
];

export default function AnalysisTool() {
  const [activeSubTab, setActiveSubTab] = useState('Analysis Tool');
  const [marketName, setMarketName] = useState('Volatility 10 (1s) Index');
  const [ticksWindow, setTicksWindow] = useState(1000);
  const [overUnder, setOverUnder] = useState(5);

  /* ---- Live stream ---- */
  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(
    symbol,
    ticksWindow
  );

  /* ---- Derived stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);
  const evenOdd = useMemo(() => computeEvenOdd(digits), [digits]);
  const overUnderStats = useMemo(
    () => computeOverUnder(digits, overUnder),
    [digits, overUnder]
  );
  const matchDiff = useMemo(
    () => computeMatchDiff(digits, currentDigit ?? 0),
    [digits, currentDigit]
  );

  const most = digits.length > 0 ? mostFrequent(digitStats) : -1;
  const least = digits.length > 0 ? leastFrequent(digitStats) : -1;

  /* ---- Recent chips (last 10) ---- */
  const recentEO = digits.slice(-10);
  const recentUO = digits
    .slice(-10)
    .map((d) => (d < overUnder ? 'U' : d === overUnder ? 'E' : 'O'));

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      {/* Sub-tabs — wrap on mobile */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200 pb-2">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveSubTab(t)}
            className={`px-3 py-1.5 text-xs rounded transition ${
              activeSubTab === t
                ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-400'
                : 'text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeSubTab !== 'Analysis Tool' ? (
        <div className="text-center text-gray-400 text-sm py-20">
          <span className="font-semibold text-gray-500">{activeSubTab}</span>
          <br />
          Coming soon.
        </div>
      ) : (
        <>
          {/* Top controls */}
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex gap-2">
              <button className="bg-red-500/80 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded">
                Wide Eye
              </button>
              <button className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded">
                Launch AI
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {connected ? (
                <>
                  <span className="text-green-500">●</span> Live
                </>
              ) : (
                <>
                  <span className="text-red-500">●</span> Offline
                </>
              )}
            </div>
          </div>

          {/* Select Market */}
          <Label>Select Market:</Label>
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-gray-50 mb-4 outline-none focus:border-blue-400"
          >
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Big price + last digit */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-4 py-4 mb-4">
            <div className="text-2xl font-bold text-navy font-mono">
              {price !== null ? price.toFixed(2) : '—'}
            </div>
            <div className="text-2xl font-bold text-blue-500 font-mono">
              {currentDigit !== null ? currentDigit : '—'}
            </div>
          </div>

          {/* Ticks window */}
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <Label>Ticks window:</Label>
              <input
                type="number"
                min={50}
                max={5000}
                value={ticksWindow}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTicksWindow(v > 0 ? v : 50);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 outline-none focus:border-blue-400"
              />
            </div>
            <div className="text-right text-xs text-gray-400 self-end">
              (50–5000)
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Last {ticksWindow} ticks digit distribution
          </div>

          {/* Digit circles — scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex justify-between gap-2 min-w-[640px] mb-2">
              {digitStats.map((d) => {
                const isCurrent = d.digit === currentDigit;
                const isMost = d.digit === most;
                const isLeast = d.digit === least;

                let cls = 'bg-white border border-gray-300 text-gray-700';
                if (isMost) cls = 'bg-green-500 text-white';
                else if (isLeast) cls = 'bg-red-500 text-white';
                if (isCurrent) cls = 'bg-blue-500 text-white';

                return (
                  <div
                    key={d.digit}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${cls}`}
                    >
                      {d.digit}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {d.pct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-right text-xs text-gray-400 mb-6">
            {digits.length}/{ticksWindow}
          </div>

          {/* Even/Odd — stack on mobile */}
          <SectionLabel>Even/Odd</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <BarColumn
              label="Even"
              count={evenOdd.even}
              pct={evenOdd.evenPct}
              color="green"
            />
            <BarColumn
              label="Odd"
              count={evenOdd.odd}
              pct={evenOdd.oddPct}
              color="red"
            />
          </div>

          {/* Recent E/O chips — wrap */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-xs text-gray-500">Recent E/O</span>
            <div className="flex gap-1 flex-wrap">
              {recentEO.map((d, i) => (
                <span
                  key={i}
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                    d % 2 === 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  {d % 2 === 0 ? 'E' : 'O'}
                </span>
              ))}
            </div>
            <span className="ml-auto text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded">
              Auto
            </span>
          </div>

          {/* Over/Under — dropdown row (wrap on mobile) */}
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Over/Under:</span>
            <select
              value={overUnder}
              onChange={(e) => setOverUnder(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-gray-50 outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Under/Equal/Over — stack on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
            <BarColumn
              label="Under"
              count={overUnderStats.under}
              pct={overUnderStats.underPct}
              color="green"
            />
            <BarColumn
              label="Equal"
              count={overUnderStats.equal}
              pct={overUnderStats.equalPct}
              color="gray"
            />
            <BarColumn
              label="Over"
              count={overUnderStats.over}
              pct={overUnderStats.overPct}
              color="red"
            />
          </div>

          {/* Recent U/O chips — wrap */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-xs text-gray-500">Recent U/O</span>
            <div className="flex gap-1 flex-wrap">
              {recentUO.map((v, i) => (
                <span
                  key={i}
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                    v === 'U'
                      ? 'bg-green-500'
                      : v === 'O'
                      ? 'bg-red-500'
                      : 'bg-gray-400'
                  }`}
                >
                  {v}
                </span>
              ))}
            </div>
            <span className="ml-auto text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded">
              Auto
            </span>
          </div>

          {/* Matches/Differs — stack on mobile */}
          <SectionLabel>Matches/Differs</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <BarColumn
              label="Matches"
              count={matchDiff.matches}
              pct={matchDiff.matchPct}
              color="green"
            />
            <BarColumn
              label="Differs"
              count={matchDiff.differs}
              pct={matchDiff.differPct}
              color="red"
            />
          </div>
        </>
      )}

      {/* AI button */}
      <button className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
        AI
      </button>
    </main>
  );
}

/* ---------- Small components ---------- */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium text-gray-700 mb-2 mt-4">
      {children}
    </div>
  );
}

function BarColumn({
  label,
  count,
  pct,
  color,
}: {
  label: string;
  count: number;
  pct: number;
  color: 'green' | 'red' | 'gray';
}) {
  const barColor =
    color === 'green'
      ? 'bg-green-500'
      : color === 'red'
      ? 'bg-red-500'
      : 'bg-gray-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>
          <span className="font-semibold text-gray-800">{count}</span>{' '}
          <span className="text-gray-400">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}