import { useEffect, useMemo, useRef, useState } from 'react';
import { useDigitStream } from '../../lib/deriv';
import {
  computeDigitStats,
  computeOverUnder,
} from '../../lib/digitStats';
import { useTradeStore } from '../../lib/trading/store';
import { useAuthWs } from '../../lib/auth-ws-context';

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
  const [defaultStakeValue, setDefaultStakeValue] = useState(0.35);
  const [stakes, setStakes] = useState<number[]>(Array(10).fill(0.35));
  const [entryPoint, setEntryPoint] = useState(false);

  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  /* ---- Risk management ---- */
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(5);
  const stoppedReasonRef = useRef<string | null>(null);

  /* ---- Live stream ---- */
  const symbol = MARKET_MAP[marketName] as any;
  const { currentDigit, digits, connected } = useDigitStream(symbol, numTicks);

  /* ---- Stores ---- */
  const { placeTrade: placePaperTrade } = useTradeStore();
  const { authorized, placeTrade: placeRealTrade, openTrades } = useAuthWs();

  /* ---- Stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);
  const overUnderStats = useMemo(
    () => computeOverUnder(digits, threshold),
    [digits, threshold]
  );

  /* ---- Local P/L tracking ---- */
  const [hyperPL, setHyperPL] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [hyperTrades, setHyperTrades] = useState(0);

  const myContractsRef = useRef<Set<number>>(new Set());

  /* Watch for settled contracts */
  useEffect(() => {
    openTrades.forEach((t) => {
      if (!myContractsRef.current.has(t.contract_id)) return;
      if (!t.is_sold) return;
      myContractsRef.current.delete(t.contract_id);

      const won = t.profit > 0;
      setHyperPL((prev) => +(prev + t.profit).toFixed(2));
      setHyperTrades((prev) => prev + 1);
      if (won) setWins((w) => w + 1);
      else setLosses((l) => l + 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades]);

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
      return;
    }

    let placed = 0;
    selectedDigits.forEach((sel, d) => {
      if (!sel) return;
      const s = defaultStakes ? defaultStakeValue : stakes[d];

      let contractType = 'DIGITOVER';
      let barrier: string | undefined;
      if (d < threshold) {
        contractType = 'DIGITUNDER';
        barrier = String(threshold);
      } else if (d > threshold) {
        contractType = 'DIGITOVER';
        barrier = String(threshold);
      } else {
        return;
      }

      if (authorized) {
        const snapshot = new Set(openTrades.map((t) => t.contract_id));

        placeRealTrade({
          symbol,
          contractType,
          stake: s,
          duration: 1,
          durationUnit: 't',
          barrier,
        });

        console.log('[Hyperbot] Real trade fired:', {
          symbol,
          contractType,
          stake: s,
          barrier,
          digit: d,
        });

        let cancelled = false;
        const poll = setInterval(() => {
          if (cancelled) return;
          openTrades.forEach((t) => {
            if (
              !snapshot.has(t.contract_id) &&
              !myContractsRef.current.has(t.contract_id)
            ) {
              myContractsRef.current.add(t.contract_id);
              console.log(
                '[Hyperbot] Registered contract',
                t.contract_id
              );
            }
          });
        }, 200);
        setTimeout(() => {
          cancelled = true;
          clearInterval(poll);
        }, 5000);
      } else {
        placePaperTrade({
          market: marketName,
          symbol,
          type: 'over_under',
          direction:
            contractType === 'DIGITOVER'
              ? `Over ${threshold} (${d})`
              : `Under ${threshold} (${d})`,
          stake: s,
          ticks: 1,
          entryPrice: currentDigit ?? undefined,
        });
      }
      placed++;
    });

    console.log(`[Hyperbot] Fired ${placed} trade(s)`);
  };

  const toggleAuto = () => {
    if (!running && selectedCount === 0) {
      alert('Select at least one digit first.');
      return;
    }
    setRunning((r) => {
      if (!r) stoppedReasonRef.current = null;
      return !r;
    });
  };

  /* Auto-fire loop — runs placeSelectedTrades every 6 seconds */
  useEffect(() => {
    runningRef.current = running;
    if (!running) return;

    placeSelectedTrades();

    const interval = setInterval(() => {
      if (!runningRef.current) return;
      placeSelectedTrades();
    }, 6000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    running,
    authorized,
    marketName,
    threshold,
    defaultStakeValue,
    selectedDigits,
  ]);

  /* ---- Auto-stop on SL/TP ---- */
  useEffect(() => {
    if (!running) return;
    if (stoppedReasonRef.current) return;

    if (takeProfit > 0 && hyperPL >= takeProfit) {
      stoppedReasonRef.current = 'TP';
      setRunning(false);
      console.log(
        `[Hyperbot] Take-profit hit (${hyperPL.toFixed(
          2
        )} >= ${takeProfit}) — stopped`
      );
    } else if (stopLoss > 0 && hyperPL <= -stopLoss) {
      stoppedReasonRef.current = 'SL';
      setRunning(false);
      console.log(
        `[Hyperbot] Stop-loss hit (${hyperPL.toFixed(
          2
        )} <= -${stopLoss}) — stopped`
      );
    }
  }, [hyperPL, running, stopLoss, takeProfit]);

  return (
    <div className="mt-2">
      {/* Title */}
      <h1 className="text-2xl font-semibold text-purple-600 mb-6">
        XENON HYPERBOT - Over/Under Trading
      </h1>

      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
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

      {/* Risk management row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
            Stop Loss ($)
          </label>
          <input
            type="number"
            step="0.5"
            min={0}
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
            className="input"
            placeholder="0 = off"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
            Take Profit ($)
          </label>
          <input
            type="number"
            step="0.5"
            min={0}
            value={takeProfit}
            onChange={(e) => setTakeProfit(Number(e.target.value))}
            className="input"
            placeholder="0 = off"
          />
        </div>
      </div>

      {/* Status cards */}
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

      {/* Live info */}
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

      {/* Header bars */}
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

      {/* Digit grid */}
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
      <div className="text-center text-[11px] text-gray-400 mb-4">
        Threshold: {threshold} | Select digits to trade Over/Under. Digits
        equal to threshold cannot be selected.
      </div>

      {/* Auto trading indicator */}
      {running && (
        <div className="text-center text-[11px] text-green-600 mb-3">
          ● Auto trading active — new trade every 6 seconds
        </div>
      )}

      {stoppedReasonRef.current === 'TP' && !running && (
        <div className="text-center text-[11px] text-green-600 mb-3">
          🎯 Auto stopped — Take Profit hit
        </div>
      )}

      {stoppedReasonRef.current === 'SL' && !running && (
        <div className="text-center text-[11px] text-red-600 mb-3">
          🛑 Auto stopped — Stop Loss hit
        </div>
      )}

      {/* Live P/L */}
      {hyperTrades > 0 && (
        <div className="max-w-md mx-auto flex justify-between items-center text-xs text-gray-700 border-t border-gray-200 pt-3 mb-4">
          <span>
            Total P/L:{' '}
            <span
              className={`font-mono font-semibold ${
                hyperPL > 0
                  ? 'text-green-600'
                  : hyperPL < 0
                  ? 'text-red-600'
                  : 'text-gray-700'
              }`}
            >
              {hyperPL >= 0 ? '+' : ''}
              {hyperPL.toFixed(2)}
            </span>
          </span>
          <span>
            Wins: <span className="text-green-600 font-semibold">{wins}</span>{' '}
            · Losses:{' '}
            <span className="text-red-600 font-semibold">{losses}</span>
          </span>
        </div>
      )}

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
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-green-500 hover:bg-green-600'
          } text-white text-sm font-semibold py-3 rounded-md transition flex items-center justify-center gap-2`}
        >
          {running ? (
            <>
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              STOP AUTO TRADING — every 6s
            </>
          ) : (
            'START AUTO TRADING'
          )}
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