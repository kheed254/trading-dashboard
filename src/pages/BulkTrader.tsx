import { useMemo, useState } from 'react';
import { useDigitStream } from '../lib/deriv';
import { computeDigitStats, computeEvenOdd } from '../lib/digitStats';

/* ---------- Config ---------- */
const MARKET_MAP: Record<string, string> = {
  'Volatility 10 Index': 'R_10',
  'Volatility 25 Index': 'R_25',
  'Volatility 50 Index': 'R_50',
  'Volatility 75 Index': 'R_75',
  'Volatility 100 Index': 'R_100',
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 30 (1s) Index': '1HZ30V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
};

const MARKETS = Object.keys(MARKET_MAP);

const TRADE_TYPES = [
  'Even/Odd',
  'Over/Under',
  'Matches/Differs',
  'Rise/Fall',
];

export default function BulkTrader() {
  const [marketName, setMarketName] = useState('Volatility 100 Index');
  const [tradeType, setTradeType] = useState('Even/Odd');
  const [numTicks, setNumTicks] = useState(1000);
  const [ticks, setTicks] = useState(1);
  const [stake, setStake] = useState(0.5);
  const [numTrades, setNumTrades] = useState(1);

  /* ---- Live stream ---- */
  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(
    symbol,
    numTicks
  );

  /* ---- Derived stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);
  const evenOdd = useMemo(() => computeEvenOdd(digits), [digits]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      {/* MARKET */}
      <Label>Market</Label>
      <select
        value={marketName}
        onChange={(e) => setMarketName(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-gray-50 mb-6 outline-none focus:border-blue-400"
      >
        {MARKETS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* TRADE TYPE */}
      <Label>Trade Type</Label>
      <select
        value={tradeType}
        onChange={(e) => setTradeType(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-gray-50 mb-6 outline-none focus:border-blue-400"
      >
        {TRADE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {/* NUMBER OF TICKS */}
      <Label>Number of Ticks</Label>
      <input
        type="number"
        min={50}
        max={5000}
        value={numTicks}
        onChange={(e) => {
          const v = Number(e.target.value);
          setNumTicks(v > 0 ? v : 50);
        }}
        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-gray-50 mb-8 outline-none focus:border-blue-400 text-center font-semibold"
      />

      {/* CURRENT TICK */}
      <div className="text-center mb-8">
        <Label center>Current Tick</Label>
        <div
          className={`text-3xl font-bold font-mono transition-colors ${
            connected ? 'text-blue-500' : 'text-gray-400'
          }`}
        >
          {price !== null ? price.toFixed(2) : 'Loading…'}
        </div>
        {currentDigit !== null && (
          <div className="text-xs text-gray-400 mt-1">
            last digit: {currentDigit}
          </div>
        )}
      </div>

      {/* DIGIT CIRCLES 0-9 */}
      <div className="flex justify-between gap-2 mb-8">
        {digitStats.map((d) => {
          const isCurrent = d.digit === currentDigit;
          const cls = isCurrent
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 border border-gray-200 text-navy';
          return (
            <div key={d.digit} className="flex-1 flex flex-col items-center">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center font-semibold transition-colors ${cls}`}
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
        {digits.length}/{numTicks}
      </div>

      {/* TICKS / STAKE / NO OF TRADES */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <Label center>Ticks</Label>
          <input
            type="number"
            value={ticks}
            onChange={(e) => setTicks(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 outline-none focus:border-blue-400 text-center"
          />
        </div>
        <div>
          <Label center>Stake</Label>
          <input
            type="number"
            step="0.01"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 outline-none focus:border-blue-400 text-center"
          />
        </div>
        <div>
          <Label center>No of Trades</Label>
          <input
            type="number"
            value={numTrades}
            onChange={(e) => setNumTrades(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 outline-none focus:border-blue-400 text-center"
          />
        </div>
      </div>

      {/* EVEN / ODD BARS */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-teal-500 text-white rounded-md px-4 py-3">
          <div className="font-semibold text-center">Even</div>
          <div className="text-center text-sm mt-1">
            {evenOdd.even} ({evenOdd.evenPct.toFixed(2)}%)
          </div>
        </div>
        <div className="bg-red-500 text-white rounded-md px-4 py-3">
          <div className="font-semibold text-center">Odd</div>
          <div className="text-center text-sm mt-1">
            {evenOdd.odd} ({evenOdd.oddPct.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* STATUS */}
      <div className="text-center text-xs text-gray-400 mb-16">
        {connected
          ? `Streaming live ticks · ${digits.length} collected`
          : 'Connecting to tick stream…'}
      </div>

      {/* AI BUTTON */}
      <button className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
        AI
      </button>
    </main>
  );
}

function Label({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div
      className={`text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1 ${
        center ? 'text-center' : ''
      }`}
    >
      {children}
    </div>
  );
}