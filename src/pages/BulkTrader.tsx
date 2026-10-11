import { useMemo, useState } from 'react';
import { useDigitStream } from '../lib/deriv';
import { computeDigitStats, computeEvenOdd } from '../lib/digitStats';
import { useAuthWs } from '../lib/auth-ws-context';

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
] as const;

type TradeType = typeof TRADE_TYPES[number];

/* ---------- Component ---------- */
export default function BulkTrader() {
  const [marketName, setMarketName] = useState('Volatility 100 Index');
  const [tradeType, setTradeType] = useState<TradeType>('Even/Odd');
  const [numTicks, setNumTicks] = useState(1000);
  const [ticks, setTicks] = useState(1);
  const [stake, setStake] = useState(0.5);
  const [numTrades, setNumTrades] = useState(1);
  const [targetDigit, setTargetDigit] = useState(5);
  const [isTrading, setIsTrading] = useState(false);

  const { authorized, placeTrade } = useAuthWs();

  /* ---- Live stream ---- */
  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(symbol, numTicks);

  /* ---- Derived stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);
  const evenOdd = useMemo(() => computeEvenOdd(digits), [digits]);

  /* ---- Over/Under stats ---- */
  const overUnder = useMemo(() => {
    let under = 0, equal = 0, over = 0;
    digits.forEach((d) => {
      if (d < targetDigit) under++;
      else if (d === targetDigit) equal++;
      else over++;
    });
    const total = digits.length || 1;
    return {
      under, equal, over,
      underPct: (under / total) * 100,
      equalPct: (equal / total) * 100,
      overPct: (over / total) * 100,
    };
  }, [digits, targetDigit]);

  /* ---- Matches/Differs stats ---- */
  const matchesDiffers = useMemo(() => {
    let matches = 0, differs = 0;
    digits.forEach((d) => (d === targetDigit ? matches++ : differs++));
    const total = digits.length || 1;
    return {
      matches, differs,
      matchesPct: (matches / total) * 100,
      differsPct: (differs / total) * 100,
    };
  }, [digits, targetDigit]);

  /* ---- Rise/Fall stats ---- */
  const riseFall = useMemo(() => {
    let rise = 0, fall = 0;
    for (let i = 1; i < digits.length; i++) {
      if (digits[i] > digits[i - 1]) rise++;
      else if (digits[i] < digits[i - 1]) fall++;
    }
    const total = rise + fall || 1;
    return {
      rise, fall,
      risePct: (rise / total) * 100,
      fallPct: (fall / total) * 100,
    };
  }, [digits]);

  /* ---- Recent E/O sequence (last 8) ---- */
  const recentParity = useMemo(() => {
    return digits.slice(-8).map((d) => (d % 2 === 0 ? 'E' : 'O'));
  }, [digits]);

  /* ---- Determine contract type from button click ---- */
  const getContractType = (direction: 'primary' | 'secondary'): string => {
    switch (tradeType) {
      case 'Even/Odd': return direction === 'primary' ? 'DIGITEVEN' : 'DIGITODD';
      case 'Over/Under': return direction === 'primary' ? 'DIGITOVER' : 'DIGITUNDER';
      case 'Matches/Differs': return direction === 'primary' ? 'DIGITMATCH' : 'DIGITDIFF';
      case 'Rise/Fall': return direction === 'primary' ? 'CALL' : 'PUT';
      default: return 'DIGITEVEN';
    }
  };

  const needsBarrier = tradeType === 'Over/Under' || tradeType === 'Matches/Differs';

  /* ---- Buttons labels ---- */
  const primaryLabel =
    tradeType === 'Even/Odd' ? 'Even' :
    tradeType === 'Over/Under' ? 'Over' :
    tradeType === 'Matches/Differs' ? 'Matches' :
    'Rise';

  const secondaryLabel =
    tradeType === 'Even/Odd' ? 'Odd' :
    tradeType === 'Over/Under' ? 'Under' :
    tradeType === 'Matches/Differs' ? 'Differs' :
    'Fall';

  /* ---- Current primary/secondary %s ---- */
  const primaryPct =
    tradeType === 'Even/Odd' ? evenOdd.evenPct :
    tradeType === 'Over/Under' ? overUnder.overPct :
    tradeType === 'Matches/Differs' ? matchesDiffers.matchesPct :
    riseFall.risePct;

  const secondaryPct =
    tradeType === 'Even/Odd' ? evenOdd.oddPct :
    tradeType === 'Over/Under' ? overUnder.underPct :
    tradeType === 'Matches/Differs' ? matchesDiffers.differsPct :
    riseFall.fallPct;

  /* ---- Handle trade ---- */
  const handleTrade = async (direction: 'primary' | 'secondary') => {
    if (!authorized) {
      alert('Please log in to place trades.');
      return;
    }

    setIsTrading(true);

    const contractType = getContractType(direction);
    // CALL/PUT need minimum 2 ticks; digit contracts can be 1 tick
    const isCallPut = contractType === 'CALL' || contractType === 'PUT';
    const duration = isCallPut ? Math.max(2, ticks) : Math.max(1, ticks);
    const durationUnit = 't';
    const barrier = needsBarrier ? String(targetDigit) : undefined;

    try {
      for (let i = 0; i < numTrades; i++) {
        console.log(`[Bulk Trader] Placing ${contractType} ${i + 1}/${numTrades}`);

        await placeTrade({
          symbol,
          contractType,
          stake,
          duration,
          durationUnit,
          barrier,
        });

        // 1-second delay between trades
        if (i < numTrades - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
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
      {/* MARKET & TRADE TYPE */}
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
            onChange={(e) => setTradeType(e.target.value as TradeType)}
            className="w-full border border-gray-300 rounded-md px-2 py-2 text-xs bg-white outline-none focus:border-blue-400"
          >
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* DIGIT SELECTOR (only for Over/Under and Matches/Differs) */}
      {needsBarrier && (
        <div className="mb-4">
          <Label>Digit (Barrier)</Label>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => setTargetDigit(n)}
                className={`flex-1 py-2 rounded-md text-sm font-bold transition ${
                  targetDigit === n
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NUMBER OF TICKS */}
      <div className="mb-6">
        <Label>Number of Ticks (Analysis Window)</Label>
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

      {/* DIGIT CIRCLES 0-9 */}
      <div className="flex justify-between gap-0.5 mb-6">
        {digitStats.map((d) => {
          const isCurrent = d.digit === currentDigit;
          const isTarget = needsBarrier && d.digit === targetDigit;
          const strokeDasharray = 2 * Math.PI * 20;
          const strokeDashoffset = strokeDasharray - (d.pct / 100) * strokeDasharray;

          return (
            <div key={d.digit} className="flex flex-col items-center flex-1">
              <div className="relative w-9 h-9">
                <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  <circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    stroke={isTarget ? '#f59e0b' : isCurrent ? '#3b82f6' : '#14b8a6'}
                    strokeWidth="6"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${
                  isTarget ? 'text-amber-600' : isCurrent ? 'text-blue-600' : 'text-navy'
                }`}>
                  {d.digit}
                </div>
              </div>
              <div className="text-[9px] text-gray-500 mt-1">{d.pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>

      {/* RECENT E/O SEQUENCE */}
      {tradeType === 'Even/Odd' && (
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
      )}

      {/* TICKS / STAKE / NO OF TRADES */}
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

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => handleTrade('primary')}
          disabled={isTrading || !authorized}
          className={`rounded-md overflow-hidden transition ${isTrading || !authorized ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="bg-teal-500 text-white py-2 font-semibold text-center">
            {isTrading ? 'Placing…' : primaryLabel}
          </div>
          <div className="bg-teal-400 text-white py-1 text-center text-sm">
            {primaryPct.toFixed(2)}%
          </div>
        </button>

        <button
          onClick={() => handleTrade('secondary')}
          disabled={isTrading || !authorized}
          className={`rounded-md overflow-hidden transition ${isTrading || !authorized ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="bg-red-500 text-white py-2 font-semibold text-center">
            {isTrading ? 'Placing…' : secondaryLabel}
          </div>
          <div className="bg-red-400 text-white py-1 text-center text-sm">
            {secondaryPct.toFixed(2)}%
          </div>
        </button>
      </div>

      {/* STATUS */}
      <div className="text-center text-xs text-gray-400 mb-8">
        {connected
          ? `Streaming live ticks · ${digits.length} collected`
          : 'Connecting to tick stream…'}
      </div>
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