import { useState } from 'react';

const MARKETS = [
  'Volatility 10 (1s) Index',
  'Volatility 25 (1s) Index',
  'Volatility 30 (1s) Index',
  'Volatility 50 (1s) Index',
  'Volatility 75 (1s) Index',
  'Volatility 100 (1s) Index',
];

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

// Placeholder digit percentages — will be replaced with live data later
const DIGIT_PCTS = [
  { digit: 0, pct: 9.6 },
  { digit: 1, pct: 11.3, current: true },
  { digit: 2, pct: 9.3 },
  { digit: 3, pct: 9.2 },
  { digit: 4, pct: 11.6, most: true },
  { digit: 5, pct: 10.7 },
  { digit: 6, pct: 6.9, least: true },
  { digit: 7, pct: 11.7 },
  { digit: 8, pct: 8.4 },
  { digit: 9, pct: 9.9 },
];

export default function AnalysisTool() {
  const [activeSubTab, setActiveSubTab] = useState('Analysis Tool');
  const [market, setMarket] = useState('Volatility 10 (1s) Index');
  const [ticksWindow, setTicksWindow] = useState(1000);
  const [overUnder, setOverUnder] = useState(5);

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      {/* Sub-tabs */}
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
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button className="bg-red-500/80 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded">
                Wide Eye
              </button>
              <button className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded">
                Launch AI
              </button>
            </div>
            <div className="text-xs text-gray-500">Live ●</div>
          </div>

          {/* Select Market */}
          <Label>Select Market:</Label>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
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
            <div className="text-2xl font-bold text-navy">—</div>
            <div className="text-2xl font-bold text-blue-500">—</div>
          </div>

          {/* Ticks window */}
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <Label>Ticks window:</Label>
              <input
                type="number"
                value={ticksWindow}
                onChange={(e) => setTicksWindow(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 outline-none focus:border-blue-400"
              />
            </div>
            <div className="text-right text-xs text-gray-400 self-end">
              (50–5000)
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Last 1000 ticks digit distribution
          </div>

          {/* Digit circles */}
          <div className="flex justify-between gap-2 mb-2">
            {DIGIT_PCTS.map((d) => {
              const bg = d.most
                ? 'bg-green-500 text-white'
                : d.least
                ? 'bg-red-500 text-white'
                : d.current
                ? 'bg-blue-500 text-white'
                : 'bg-white border border-gray-300 text-gray-700';
              return (
                <div key={d.digit} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm ${bg}`}
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

          <div className="text-right text-xs text-gray-400 mb-6">
            1000/1000
          </div>

          {/* Even/Odd */}
          <SectionLabel>Even/Odd</SectionLabel>
          <div className="grid grid-cols-2 gap-4 mb-2">
            <BarColumn
              label="Even"
              count={476}
              pct={47.6}
              color="green"
            />
            <BarColumn label="Odd" count={524} pct={52.4} color="red" />
          </div>

          {/* Recent E/O chips */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500">Recent E/O</span>
            <div className="flex gap-1">
              {['E', 'E', 'O', 'O', 'E', 'E', 'O', 'O', 'E', 'O'].map(
                (v, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                      v === 'E' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    {v}
                  </span>
                )
              )}
            </div>
            <span className="ml-auto text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded">
              Auto
            </span>
          </div>

          {/* Over/Under */}
          <div className="mb-2 flex items-center gap-2">
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

          <div className="grid grid-cols-3 gap-3 mb-2">
            <BarColumn
              label="Under"
              count={508}
              pct={50.8}
              color="green"
            />
            <BarColumn
              label="Equal"
              count={107}
              pct={10.7}
              color="gray"
            />
            <BarColumn label="Over" count={385} pct={38.5} color="red" />
          </div>

          {/* Recent U/O chips */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500">Recent U/O</span>
            <div className="flex gap-1">
              {['U', 'U', 'O', 'O', 'E', 'U', 'O', 'E', 'O', 'U'].map(
                (v, i) => (
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
                )
              )}
            </div>
            <span className="ml-auto text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded">
              Auto
            </span>
          </div>

          {/* Matches/Differs */}
          <SectionLabel>Matches/Differs</SectionLabel>
          <div className="grid grid-cols-2 gap-4 mb-2">
            <BarColumn
              label="Matches"
              count={107}
              pct={10.7}
              color="green"
            />
            <BarColumn
              label="Differs"
              count={893}
              pct={89.3}
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