import { useMemo, useState } from 'react';
import { useDigitStream } from '../lib/deriv';
import { computeDigitStats, computeEvenOdd } from '../lib/digitStats';
import { useAuthWs } from '../lib/auth-ws';

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

/* ---------- Component ---------- */
export default function BulkTrader() {
  const [marketName, setMarketName] = useState('Volatility 100 Index');
  const [tradeType, setTradeType] = useState('Even/Odd');
  const [numTicks, setNumTicks] = useState(1000);
  const [ticks, setTicks] = useState(1);
  const [stake, setStake] = useState(0.5);
  const [numTrades, setNumTrades] = useState(1);
  const [isTrading, setIsTrading] = useState(false);

  // Imported useAuthWs to actually place the trades
  const { authorized, placeTrade } = useAuthWs();

  /* ---- Live stream ---- */
  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(
    symbol,
    numTicks
  );

  /* ---- Derived stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);
  const evenOdd = useMemo(() => computeEvenOdd(digits), [digits]);

  // Get the last 8 tick parities for the E/O sequence display
  const recentParity = useMemo(() => {
    // We need the last 8 digits. digits is likely an array of numbers.
    const recent = digits.slice(-8);
    return recent.map((d) => (d % 2 === 0 ? 'E' : 'O'));
  }, [digits]);

  const handleTrade = async (direction: 'EVEN' | 'ODD') => {
    if (!authorized) {
      alert('Please log in to place trades.');
      return;
    }

    setIsTrading(true);
    
    const contractType = direction === 'EVEN' ? 'DIGITEVEN' : 'DIGITODD';
    const duration = Math.max(1, ticks);
    const durationUnit = 't';

    try {
      for (let i = 0; i < numTrades; i++) {
        console.log(`[Bulk Trader] Placing trade ${i + 1} of ${numTrades}`);
        
        await placeTrade({
          symbol,
          contractType,
          stake: stake,
          duration: duration,
          durationUnit: durationUnit,
        });

        // 1-second delay between trades to prevent API rate limiting
        if (i < numTrades - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Bulk Trader error:', error);
      alert('Failed to place trade. Check console for details.');
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-3 py-4">
      {/* MARKET & TRADE TYPE - Side by side on mobile */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label>Market</Label>
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-2 text-xs bg-white outline-none focus:border-blue-400"
          >
            {MARKETS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Trade Type</Label>
          <select
            value={tradeType}
            onChange={(e) => setTradeType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-2 text-xs bg-white outline-none focus:border-blue-400"
          >
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* NUMBER OF TICKS */}
      <div className="mb-6">
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
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-blue-400 text-center font-semibold"
        />
      </div>

      {/* CURRENT TICK */}
      <div className="text-center mb-6">
        <Label center>Current Tick</Label>
        <div className={`text-3xl font-bold font-mono ${connected ? 'text-blue-600' : 'text-gray-400'}`}>
          {price !== null ? price.toFixed(2) : 'Loading…'}
        </div>
        {currentDigit !== null && (
          <div className="text-xs text-gray-400 mt-1">
            last digit: {currentDigit}
          </div>
        )}
      </div>

      {/* DIGIT CIRCLES 0-9 - Circular gauges style */}
      <div className="flex justify-between gap-1 mb-6">
        {digitStats.map((d) => {
          const isCurrent = d.digit === currentDigit;
          const strokeDasharray = 2 * Math.PI * 20; // Circumference for r=20
          const strokeDashoffset = strokeDasharray - (d.pct / 100) * strokeDasharray;
          
          return (
            <div key={d.digit} className="flex flex-col items-center flex-1">
              <div className="relative w-10 h-10">
                <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                  {/* Background circle */}
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  {/* Foreground progress circle */}
                  <circle 
                    cx="24" cy="24" r="20" 
                    fill="none" 
                    stroke={isCurrent ? '#3b82f6' : '#14b8a6'} 
                    strokeWidth="6" 
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${isCurrent ? 'text-blue-600' : 'text-navy'}`}>
                  {d.digit}
                </div>
              </div>
              <div className="text-[9px] text-gray-500 mt-1">{d.pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>

      {/* E/O SEQUENCE ROW */}
      <div className="flex justify-center gap-1 mb-6">
        {recentParity.map((p, i) => (
          <span 
            key={i} 
            className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold text-white ${
              p === 'E' ? 'bg-teal-500' : 'bg-red-500'
            }`}
          >
            {p}
          </span>
        ))}
      </div>

      {/* TICKS / STAKE / NO OF TRADES - Compact row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <Label center>Ticks</Label>
          <input
            type="number"
            value={ticks}
            onChange={(e) => setTicks(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-1 py-1.5 text-sm bg-white outline-none focus:border-blue-400 text-center font-medium"
          />
        </div>
        <div>
          <Label center>Stake</Label>
          <input
            type="number"
            step="0.01"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-1 py-1.5 text-sm bg-white outline-none focus:border-blue-400 text-center font-medium"
          />
        </div>
        <div>
          <Label center>No of Trades</Label>
          <input
            type="number"
            value={numTrades}
            onChange={(e) => setNumTrades(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-1 py-1.5 text-sm bg-white outline-none focus:border-blue-400 text-center font-medium"
          />
        </div>
      </div>

      {/* EVEN / ODD BARS - Slightly larger blocks */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button 
          onClick={() => handleTrade('EVEN')}
          disabled={isTrading || !authorized}
          className={`rounded-md overflow-hidden transition ${isTrading || !authorized ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="bg-teal-500 text-white py-2 font-semibold text-center">Even</div>
          <div className="bg-teal-400 text-white py-1 text-center text-sm">{evenOdd.evenPct.toFixed(2)}%</div>
        </button>
        
        <button 
          onClick={() => handleTrade('ODD')}
          disabled={isTrading || !authorized}
          className={`rounded-md overflow-hidden transition ${isTrading || !authorized ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="bg-red-500 text-white py-2 font-semibold text-center">Odd</div>
          <div className="bg-red-400 text-white py-1 text-center text-sm">{evenOdd.oddPct.toFixed(2)}%</div>
        </button>
      </div>

      {/* STATUS */}
      <div className="text-center text-xs text-gray-400 mb-8">
        {connected
          ? `Streaming live ticks · ${digits.length} collected`
          : 'Connecting to tick stream…'}
      </div>

      {/* AI BUTTON */}
      <button className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold shadow-lg flex items-center justify-center z-10">
        AI
      </button>
    </main>
  );
}

/* ---------- Helpers ---------- */
function Label({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 ${center ? 'text-center' : ''}`}>
      {children}
    </div>
  );
}