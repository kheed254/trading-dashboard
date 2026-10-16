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
  'Jump 10 Index': 'JD10',
  'Jump 25 Index': 'JD25',
  'Jump 50 Index': 'JD50',
  'Jump 75 Index': 'JD75',
  'Jump 100 Index': 'JD100',
};

const MARKETS = Object.keys(MARKET_MAP);

const TRADE_TYPES = [
  'Even/Odd',
  'Over/Under',
  'Matches/Differs',
  'Rise/Fall',
] as const;

type TradeType = typeof TRADE_TYPES[number];

/* Don't mark most/least digits until there are enough ticks to be meaningful */
const MIN_TICKS_FOR_MARKS = 20;

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

  /* ---- Most and least appearing digit (for circle colours) ---- */
  const { highestDigit, lowestDigit } = useMemo(() => {
    if (digits.length < MIN_TICKS_FOR_MARKS) return { highestDigit: -1, lowestDigit: -1 };
    let hi = digitStats[0];
    let lo = digitStats[0];
    digitStats.forEach((d) => {
      if (d.pct > hi.pct) hi = d;
      if (d.pct < lo.pct) lo = d;
    });
    if (hi.pct === lo.pct) return { highestDigit: -1, lowestDigit: -1 };
    return { highestDigit: hi.digit, lowestDigit: lo.digit };
  }, [digitStats, digits.length]);

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

  /* ---- Recent E/O sequence (last 10) ---- */
  const recentParity = useMemo(() => {
    return digits.slice(-10).map((d) => (d % 2 === 0 ? 'E' : 'O'));
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
    <main className="max-w-xl mx-auto px-4 py-5">
      {/* MARKET & TRADE TYPE */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label>Market</Label>
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-navy bg-gray-100 outline-none focus:border-blue-400 cursor-pointer"
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
            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-navy bg-gray-100 outline-none focus:border-blue-400 cursor-pointer"
          >
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* NUMBER OF TICKS */}
      <div className="mb-4">
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
          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-base bg-gray-100 outline-none focus:border-blue-400 text-center font-bold text-navy"
        />
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

      {/* CURRENT TICK */}
      <div className="text-center mb-5">
        <Label center>Current Tick</Label>
        <div className={`text-4xl font-bold ${connected ? 'text-blue-500' : 'text-gray-400'}`}>
          {price !== null ? price.toFixed(2) : 'Loading…'}
        </div>
      </div>

      {/* DIGIT CIRCLES 0-9 (two rows of five) */}
      <div className="grid grid-cols-5 gap-x-2 gap-y-4 mb-6">
        {digitStats.map((d) => {
          const isCurrent = d.digit === currentDigit;
          const isTarget = needsBarrier && d.digit === targetDigit;
          const isHigh = d.digit === highestDigit;
          const isLow = d.digit === lowestDigit;

          const wedgeColor = isHigh ? '#14b8a6' : isLow ? '#ef4444' : '#b4b8be';
          const ringColor = isHigh ? '#14b8a6' : isLow ? '#ef4444' : '#d9dce0';

          const R = 22;
          const C = 2 * Math.PI * R;
          const dash = (Math.min(100, Math.max(0, d.pct)) / 100) * C;

          return (
            <div key={d.digit} className="relative flex flex-col items-center">
              {isCurrent && (
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-0 h-0"
                  style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '8px solid #ef4444',
                  }}
                />
              )}
              <div className={`relative w-full max-w-[72px] aspect-square rounded-full ${isTarget ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                  {/* track (coloured for most / least appearing digit) */}
                  <circle cx="50" cy="50" r="46" fill="#f3f4f6" stroke={ringColor} strokeWidth="8" />
                  {/* filled wedge (percentage of full circle) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={wedgeColor}
                    strokeWidth={R * 2}
                    strokeDasharray={`${dash} ${C}`}
                    transform="rotate(-90 50 50)"
                    opacity="0.85"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
                  <span className="text-base font-bold text-navy">{d.digit}</span>
                  <span className="text-[10px] font-bold text-navy">{d.pct.toFixed(2)}%</span>
                </div>
              </div>
              <div
                className={`h-4 mt-1 text-[10px] font-bold uppercase tracking-wide ${
                  isHigh ? 'text-teal-600' : isLow ? 'text-red-500' : ''
                }`}
              >
                {isHigh ? 'Most' : isLow ? 'Least' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* RECENT E/O SEQUENCE */}
      {tradeType === 'Even/Odd' && (
        <div className="flex justify-center gap-1.5 mb-6 flex-wrap">
          {recentParity.map((p, i) => (
            <span
              key={i}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-bold text-white ${
                p === 'E' ? 'bg-teal-500' : 'bg-red-500'
              }`}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {/* TICKS / STAKE / NO OF TRADES */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <Label center>Ticks</Label>
          <input
            type="number"
            value={ticks}
            onChange={(e) => setTicks(Number(e.target.value))}
            className="w-full border-2 border-gray-300 rounded-lg px-1 py-2 text-base bg-gray-100 outline-none focus:border-blue-400 text-center font-bold text-navy"
          />
        </div>
        <div>
          <Label center>Stake</Label>
          <input
            type="number"
            step="0.01"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full border-2 border-gray-300 rounded-lg px-1 py-2 text-base bg-gray-100 outline-none focus:border-blue-400 text-center font-bold text-navy"
          />
        </div>
        <div>
          <Label center>No of Trades</Label>
          <input
            type="number"
            value={numTrades}
            onChange={(e) => setNumTrades(Number(e.target.value))}
            className="w-full border-2 border-gray-300 rounded-lg px-1 py-2 text-base bg-gray-100 outline-none focus:border-blue-400 text-center font-bold text-navy"
          />
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => handleTrade('primary')}
          disabled={isTrading || !authorized}
          className={`rounded-lg overflow-hidden transition ${isTrading || !authorized ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
        >
          <div className="bg-teal-500 text-white py-3 font-bold text-center text-base">
            {isTrading ? 'Placing…' : primaryLabel}
          </div>
          <div className="bg-teal-400 text-white py-1.5 text-center text-sm font-semibold">
            {primaryPct.toFixed(2)}%
          </div>
        </button>

        <button
          onClick={() => handleTrade('secondary')}
          disabled={isTrading || !authorized}
          className={`rounded-lg overflow-hidden transition ${isTrading || !authorized ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
        >
          <div className="bg-red-500 text-white py-3 font-bold text-center text-base">
            {isTrading ? 'Placing…' : secondaryLabel}
          </div>
          <div className="bg-red-400 text-white py-1.5 text-center text-sm font-semibold">
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
    <div className={`text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1 ${center ? 'text-center' : ''}`}>
      {children}
    </div>
  );
}