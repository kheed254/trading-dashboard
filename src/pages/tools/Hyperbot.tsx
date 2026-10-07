import { useMemo, useState } from 'react';
import { useDigitStream } from '../../lib/deriv';
import {
  computeDigitStats,
  computeOverUnder,
} from '../../lib/digitStats';
import { useTradeStore } from '../../lib/trading/store';

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

export default function Hyperbot() {
  const [marketName, setMarketName] = useState('Volatility 100 (1s) Index');
  const [numTicks, setNumTicks] = useState(1000);
  const [threshold, setThreshold] = useState(5);

  const [selectedDigits, setSelectedDigits] = useState<boolean[]>(
    Array(10).fill(false)
  );
  const [defaultStakes, setDefaultStakes] = useState(true);
  const [defaultStakeValue, setDefaultStakeValue] = useState(0.5);
  const [stakes, setStakes] = useState<number[]>(Array(10).fill(0.5));
  const [entryPoint, setEntryPoint] = useState(false);

  const [running, setRunning] = useState(false);

  /* ---- Live stream ---- */
  const symbol = MARKET_MAP[marketName] as any;
  const { currentDigit, digits, connected } = useDigitStream(symbol, numTicks);

  /* ---- Trade store ---- */
  const { placeTrade } = useTradeStore();

  /* ---- Stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);
  const overUnderStats = useMemo(
    () => computeOverUnder(digits, threshold),
    [digits, threshold]
  );

  const toggleDigit = (d: number) => {
    setSelectedDigits((prev) => {
      const next = [...prev];
      next[d] = !next[d];
      return next;
    });
  };

  const setStake = (d: number, v: number) => {
    setStakes((prev) => {
      const next = [...prev];
      next[d] = v;
      return next;
    });
  };

  const selectedCount = selectedDigits.filter(Boolean).length;
  const totalStake = selectedDigits.reduce(
    (sum, sel, d) => sum + (sel ? stakes[d] : 0),
    0
  );

  const placeSelectedTrades = () => {
    if (selectedCount === 0) {
      alert('Select at least one digit first.');
      return;
    }
    let placed = 0;
    selectedDigits.forEach((sel, d) => {
      if (!sel) return;
      const s = defaultStakes ? defaultStakeValue : stakes[d];
      const direction =
        d < threshold
          ? `Under ${threshold} (${d})`
          : d > threshold
          ? `Over ${threshold} (${d})`
          : `Equal ${threshold}`;
      placeTrade({
        market: marketName,
        symbol: MARKET_MAP[marketName],
        type: 'over_under',
        direction,
        stake: s,
        ticks: 5,
        entryPrice: currentDigit ?? undefined,
      });
      placed++;
    });
    alert(
      `Placed ${placed} trade${placed !== 1 ? 's' : ''}. Check Reports in a few seconds.`
    );
  };

  const toggleAuto = () => {
    if (!running && selectedCount === 0) {
      alert('Select at least one digit first.');
      return;
    }
    setRunning((r) => !r);
  };

  return (
    <div className="mt-2">
      {/* Title */}
      <h1 className="text-2xl font-semibold text-purple-600 mb-6">
        XENON HYPERBOT - Over/Under Trading
      </h1>

      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <input
          value={marketName}
          onChange={(e) => setMarketName(e.target.value)}
          className="input"
          list="hyperbot-markets"
        />
        <datalist id="hyperbot-markets">
          {MARKETS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        <input
          type="number"
          value={numTicks}
          onChange={(e) => setNumTicks(Number(e.target.value))}
          placeholder="Ticks"
          className="input"
        />

        <input
          type="number"
          min={1}
          max={9}
          value={threshold}
          onChange={(e) =>
            setThreshold(Math.max(1, Math.min(9, Number(e.target.value))))
          }
          placeholder="Threshold"
          className="input"
        />

        <button className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold rounded-md">
          Apply
        </button>
      </div>

      {/* Status cards: Under / Equal / Over */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard
          label="UNDER"
          count={overUnderStats.under}
          pct={overUnderStats.underPct}
          border="red"
        />
        <StatCard
          label="EQUAL"
          count={overUnderStats.equal}
          pct={overUnderStats.equalPct}
          border="gray"
        />
        <StatCard
          label="OVER"
          count={overUnderStats.over}
          pct={overUnderStats.overPct}
          border="green"
        />
      </div>

      {/* Recent tick info */}
      <div className="text-xs text-gray-500 mb-4 flex items-center gap-2 flex-wrap">
        <span>Recent U/U/O</span>
        <span className="ml-auto">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-1 ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          {connected ? `Live · ${digits.length}/${numTicks}` : 'Connecting…'}
          {currentDigit !== null && (
            <span className="ml-2 text-navy font-semibold">
              last digit: {currentDigit}
            </span>
          )}
        </span>
      </div>

      {/* Select Over/Under Digits bars */}
      <div className="grid grid-cols-2 gap-0 mb-4">
        <div className="bg-green-500 text-white text-xs font-semibold px-3 py-1.5">
          Select Over Digits
        </div>
        <div className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5">
          Select Under Digits
        </div>
      </div>

      {/* Predictions header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-gray-50 border border-gray-200 rounded-md px-4 py-3 mb-3">
        <div className="text-xs font-semibold text-gray-700">
          Predictions ({selectedCount}/10 Active)
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Toggle
            label="Use Default Stakes"
            value={defaultStakes}
            onChange={setDefaultStakes}
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">Default Stake</span>
            <input
              type="number"
              step="0.01"
              value={defaultStakeValue}
              onChange={(e) => setDefaultStakeValue(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs w-20 outline-none"
            />
          </div>
          <Toggle
            label="Entry Point"
            value={entryPoint}
            onChange={setEntryPoint}
          />
        </div>
      </div>

      {/* Digit grid — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6">
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2 min-w-[640px]">
          {digitStats.map((d) => {
            const isSelected = selectedDigits[d.digit];
            const isCurrent = d.digit === currentDigit;
            const stake = defaultStakes ? defaultStakeValue : stakes[d.digit];
            return (
              <div key={d.digit} className="flex flex-col">
                <div
                  className={`border rounded-md px-2 py-3 text-center transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDigit(d.digit)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer mb-1"
                  />
                  <div
                    className={`text-lg font-bold ${
                      isCurrent ? 'text-blue-600' : 'text-navy'
                    }`}
                  >
                    {d.digit}
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={stake}
                  onChange={(e) => setStake(d.digit, Number(e.target.value))}
                  disabled={defaultStakes}
                  className="mt-1 border border-gray-200 rounded-md px-2 py-1 text-xs text-center outline-none disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Total stake */}
      <div className="text-center text-xs text-gray-600 mb-2">
        Total Stake: ${totalStake.toFixed(2)}
      </div>
      <div className="text-center text-[11px] text-gray-400 mb-6">
        Threshold: {threshold} | Select digits to trade Over/Under. Digits equal
        to threshold cannot be selected.
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={placeSelectedTrades}
          className="bg-purple-400 hover:bg-purple-500 text-white text-sm font-semibold py-3 rounded-md transition"
        >
          TRADE ONCE
        </button>
        <button
          onClick={toggleAuto}
          className={`${
            running
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } text-white text-sm font-semibold py-3 rounded-md transition`}
        >
          {running ? 'STOP AUTO TRADING' : 'START AUTO TRADING'}
        </button>
      </div>

      {/* AI floating button */}
      <button className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
        AI
      </button>

      {/* Local styles */}
      <style>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #f9fafb;
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
        }
        .input:focus {
          border-color: #a855f7;
          background: white;
        }
      `}</style>
    </div>
  );
}

/* ---------- Small components ---------- */
function StatCard({
  label,
  count,
  pct,
  border,
}: {
  label: string;
  count: number;
  pct: number;
  border: 'red' | 'gray' | 'green';
}) {
  const colors = {
    red: 'border-red-400 text-red-600',
    gray: 'border-gray-300 text-gray-600',
    green: 'border-green-400 text-green-600',
  }[border];

  return (
    <div className={`border-2 rounded-md px-4 py-4 text-center ${colors}`}>
      <div className="text-xs font-semibold tracking-wide">{label}</div>
      <div className="mt-2 text-lg font-bold">
        {count}{' '}
        <span className="text-xs font-normal">({pct.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-600">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition relative ${
          value ? 'bg-teal-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
            value ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}