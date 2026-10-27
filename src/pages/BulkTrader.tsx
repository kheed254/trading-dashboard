import { useEffect, useMemo, useRef, useState } from 'react';
import { useDigitStream, useMarkets } from '../lib/deriv';
import { computeDigitStats, computeEvenOdd } from '../lib/digitStats';
import { useAuthWs } from '../lib/auth-ws-context';

/* ---------- Config ---------- */

/* Show percentages without trailing zeros: 8.10 -> 8.1, 10.00 -> 10, 0.00 -> 0 */
const fmtPct = (n: number) => `${parseFloat(n.toFixed(2))}%`;

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

  const { authorized, placeTrade, openTrades } = useAuthWs();

  /* ---- Session report (Summary / Transactions / Journal) ---- */
  const [journal, setJournal] = useState<{ time: string; text: string; kind: string }[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [resetCount, setResetCount] = useState(0);
  const loggedSettledRef = useRef(new Set<number>());

  // Only trades placed after opening this page (or after Reset) are counted
  const baselineRef = useRef<Set<number> | null>(null);
  if (baselineRef.current === null) {
    baselineRef.current = new Set(openTrades.map((t) => t.contract_id));
  }

  const sessionTrades = useMemo(
    () => openTrades.filter((t) => !baselineRef.current!.has(t.contract_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openTrades, resetCount]
  );

  const addJournal = (text: string, kind = 'info') =>
    setJournal((prev) => [{ time: new Date().toLocaleTimeString(), text, kind }, ...prev].slice(0, 100));

  useEffect(() => {
    sessionTrades.forEach((t) => {
      if (t.is_sold && !loggedSettledRef.current.has(t.contract_id)) {
        loggedSettledRef.current.add(t.contract_id);
        addJournal(
          `${t.profit > 0 ? '✓ Won' : '✗ Lost'} ${t.profit >= 0 ? '+' : ''}$${t.profit.toFixed(2)} — ${t.contract_type}`,
          t.profit > 0 ? 'profit' : 'loss'
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionTrades]);

  const resetReport = () => {
    baselineRef.current = new Set(openTrades.map((t) => t.contract_id));
    loggedSettledRef.current = new Set();
    setJournal([]);
    setStatusMsg('');
    setResetCount((c) => c + 1);
  };

  /* ---- Live stream ---- */
  const { groups: marketGroups, symbolFor } = useMarkets();
  const symbol = (symbolFor(marketName) ?? 'R_100') as any;
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
        addJournal(`Placed ${contractType} ${i + 1}/${numTrades} — $${stake.toFixed(2)}`, 'buy');

        // 1-second delay between trades
        if (i < numTrades - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      const label = direction === 'primary' ? primaryLabel : secondaryLabel;
      setStatusMsg(`Placed ${numTrades} ${label.toUpperCase()} contract${numTrades === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Bulk Trader error:', error);
      alert('Failed to place trade. Check console for details.');
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-5 lg:flex lg:gap-6 lg:items-start">
      <div className="flex-1 min-w-0 w-full max-w-xl mx-auto">
      {/* MARKET & TRADE TYPE */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label>Market</Label>
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-navy bg-gray-100 outline-none focus:border-blue-400 cursor-pointer"
          >
            {marketGroups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((m) => (
                  <option key={m.symbol} value={m.name}>{m.name}</option>
                ))}
              </optgroup>
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
                  <span className="text-[10px] font-bold text-navy">{fmtPct(d.pct)}</span>
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

      {/* PLACED MESSAGE */}
      {statusMsg && (
        <div className="text-center text-sm font-semibold text-gray-500 mb-3">{statusMsg}</div>
      )}

      {/* STATUS */}
      <div className="text-center text-xs text-gray-400 mb-8">
        {connected
          ? `Streaming live ticks · ${digits.length} collected`
          : 'Connecting to tick stream…'}
      </div>
      </div>

      {/* REPORT PANEL (right side on desktop, below on phones) */}
      <div className="w-full lg:w-80 lg:shrink-0 mt-2 lg:mt-0">
        <ReportPanel trades={sessionTrades} journal={journal} onReset={resetReport} />
      </div>
    </main>
  );
}

/* ---------- Report panel ---------- */
type ReportTab = 'summary' | 'transactions' | 'journal';

function ReportPanel({
  trades,
  journal,
  onReset,
}: {
  trades: {
    contract_id: number;
    symbol: string;
    contract_type: string;
    buy_price: number;
    payout: number;
    profit: number;
    current_spot: number;
    entry_spot: number;
    entry_display?: string;
    exit_display?: string;
    is_sold: boolean;
  }[];
  journal: { time: string; text: string; kind: string }[];
  onReset: () => void;
}) {
  const [tab, setTab] = useState<ReportTab>('summary');

  const stats = useMemo(() => {
    let won = 0, lost = 0, stake = 0, payout = 0, pl = 0;
    trades.forEach((t) => {
      stake += t.buy_price;
      if (t.is_sold) {
        pl += t.profit;
        if (t.profit > 0) {
          won++;
          payout += t.buy_price + t.profit;
        } else {
          lost++;
        }
      }
    });
    return { runs: trades.length, won, lost, stake, payout, pl };
  }, [trades]);

  const last = trades[0];

  const downloadCsv = () => {
    const rows = [
      ['contract_id', 'symbol', 'type', 'entry_spot', 'exit_spot', 'buy_price', 'profit'],
      ...trades.map((t) => [
        t.contract_id,
        t.symbol,
        t.contract_type,
        t.entry_display ?? (t.entry_spot || ''),
        t.is_sold ? (t.exit_display ?? (t.current_spot || '')) : '',
        t.buy_price.toFixed(2),
        t.is_sold ? t.profit.toFixed(2) : '',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stingerfx-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* tabs */}
      <div className="flex border-b border-gray-200 text-sm">
        {(['summary', 'transactions', 'journal'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-3 text-center capitalize ${
              tab === k
                ? 'border-b-2 border-blue-500 text-gray-900 font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* content */}
      <div className="h-72 overflow-y-auto">
        {tab === 'summary' && (
          <div className="p-4">
            {!last ? (
              <div className="text-center text-sm text-gray-800 leading-snug py-8">
                When you&rsquo;re ready to trade, place a trade. You&rsquo;ll be able to track your
                performance here.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500">{last.symbol}</div>
                  <div
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      last.is_sold
                        ? last.profit > 0
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                        : 'bg-teal-50 text-teal-700'
                    }`}
                  >
                    {last.is_sold ? (last.profit > 0 ? 'WON' : 'LOST') : 'LIVE'}
                  </div>
                </div>
                <div className="text-sm font-semibold text-navy mb-3">{last.contract_type}</div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full transition-all ${
                      last.is_sold ? (last.profit > 0 ? 'bg-green-500' : 'bg-red-500') : 'bg-teal-500 animate-pulse'
                    }`}
                    style={{ width: last.is_sold ? '100%' : '45%' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-500">Stake</div>
                    <div className="font-mono font-semibold text-navy mt-0.5">{last.buy_price.toFixed(2)} USD</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500">{last.is_sold ? 'Profit' : 'Payout'}</div>
                    <div
                      className={`font-mono font-semibold mt-0.5 ${
                        last.is_sold ? (last.profit >= 0 ? 'text-green-600' : 'text-red-600') : 'text-navy'
                      }`}
                    >
                      {last.is_sold
                        ? `${last.profit >= 0 ? '+' : ''}${last.profit.toFixed(2)}`
                        : last.payout.toFixed(2)}{' '}
                      USD
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'transactions' && (
          <div>
            <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
              <button
                onClick={downloadCsv}
                disabled={!trades.length}
                className="text-xs px-4 py-2 border border-gray-300 rounded font-medium text-gray-700 disabled:opacity-40"
              >
                Download
              </button>
            </div>
            <div className="grid grid-cols-[70px_1fr_1fr] gap-2 px-4 py-3 text-[11px] text-gray-700 font-semibold border-b border-gray-100">
              <div>Type</div>
              <div>Entry/Exit spot</div>
              <div className="text-right">Buy price and P/L</div>
            </div>
            {trades.length === 0 ? (
              <div className="text-center text-gray-400 text-xs py-10">No transactions yet</div>
            ) : (
              trades.map((t) => {
                const won = t.is_sold && t.profit > 0;
                const lost = t.is_sold && t.profit <= 0;
                return (
                  <div key={t.contract_id} className="border-b border-gray-100 py-2.5">
                    <div className="grid grid-cols-[70px_1fr_1fr] gap-2 px-4 items-center">
                      <div className="text-[10px] font-medium text-gray-700 break-all">{t.contract_type}</div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-red-500 text-base leading-none">◉</span>
                        <span className="font-mono text-gray-700">{t.entry_display ?? (t.entry_spot || '—')}</span>
                      </div>
                      <div className="text-right text-[11px] font-mono text-gray-700">
                        {t.buy_price.toFixed(2)} USD
                      </div>
                    </div>
                    <div className="grid grid-cols-[70px_1fr_1fr] gap-2 px-4 items-center mt-1">
                      <div />
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-gray-400 text-base leading-none">◯</span>
                        <span className="font-mono text-gray-700">
                          {t.is_sold ? (t.exit_display ?? (t.current_spot || '—')) : '…'}
                        </span>
                      </div>
                      <div
                        className={`text-right text-[11px] font-mono font-semibold ${
                          won ? 'text-green-600' : lost ? 'text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {t.is_sold ? `${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)} USD` : 'open'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'journal' && (
          <div className="p-3 text-xs">
            {journal.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Journal empty</div>
            ) : (
              journal.map((j, i) => (
                <div key={i} className="border-b border-gray-50 py-2 last:border-0">
                  <div className="text-[9px] text-gray-400 font-mono">{j.time}</div>
                  <div
                    className={`mt-0.5 ${
                      j.kind === 'profit'
                        ? 'text-green-600'
                        : j.kind === 'loss'
                        ? 'text-red-600'
                        : j.kind === 'buy'
                        ? 'text-navy'
                        : 'text-gray-500'
                    }`}
                  >
                    {j.text}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* totals */}
      <div className="border-t border-gray-200 bg-gray-100 px-4 pt-3 pb-3">
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <ReportStat label="Total stake" value={`${stats.stake.toFixed(2)} USD`} />
          <ReportStat label="Total payout" value={`${stats.payout.toFixed(2)} USD`} />
          <ReportStat label="No. of runs" value={String(stats.runs)} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <ReportStat label="Contracts lost" value={String(stats.lost)} />
          <ReportStat label="Contracts won" value={String(stats.won)} />
          <ReportStat
            label="Total profit/loss"
            value={`${stats.pl.toFixed(2)} USD`}
            color={stats.pl > 0 ? 'text-green-600' : stats.pl < 0 ? 'text-red-600' : 'text-gray-600'}
          />
        </div>
        <button
          onClick={onReset}
          className="w-full text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-md py-2 hover:bg-gray-50"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function ReportStat({ label, value, color = 'text-gray-600' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-gray-900 font-bold text-[11px]">{label}</div>
      <div className={`font-medium mt-1 text-xs ${color}`}>{value}</div>
    </div>
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