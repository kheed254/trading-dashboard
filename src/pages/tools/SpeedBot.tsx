import { useEffect, useRef, useState } from 'react';
import { useTradeStore } from '../../lib/trading/store';
import { useAuthWs } from '../../lib/auth-ws-context';
import { useTicks } from '../../lib/deriv';

const MARKETS = [
  'Volatility 10 (1s) Index',
  'Volatility 25 (1s) Index',
  'Volatility 30 (1s) Index',
  'Volatility 50 (1s) Index',
  'Volatility 75 (1s) Index',
  'Volatility 100 (1s) Index',
];

const TRADE_TYPES = [
  'Digits Over',
  'Digits Under',
  'Digits Even',
  'Digits Odd',
  'Rise',
  'Fall',
];

const MARKET_SYMBOL: Record<string, string> = {
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 30 (1s) Index': '1HZ30V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
};

export default function SpeedBot() {
  const [market, setMarket] = useState('Volatility 100 (1s) Index');
  const [tradeType, setTradeType] = useState('Digits Over');
  const [ticks, setTicks] = useState(1);
  const [stake, setStake] = useState(0.35);
  const [alternate, setAlternate] = useState(false);
  const [alternateOnLoss, setAlternateOnLoss] = useState(false);
  const [predictionBefore, setPredictionBefore] = useState(5);
  const [predictionAfter, setPredictionAfter] = useState(7);
  const [martingale, setMartingale] = useState(1.0);
  const [running, setRunning] = useState(false);

  /* ---- Risk management ---- */
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(5);
  const stoppedReasonRef = useRef<string | null>(null);

  const runningRef = useRef(false);

  /* Live market tick (for Last Digit) */
  const symbol = MARKET_SYMBOL[market] ?? '1HZ100V';
  const { price: livePrice } = useTicks(symbol as any);

  const { placeTrade: placePaperTrade } = useTradeStore();
  const { authorized, placeTrade: placeRealTrade, openTrades } = useAuthWs();

  /* ---- Local P/L tracking ---- */
  const [speedPL, setSpeedPL] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [consecWins, setConsecWins] = useState(0);
  const [consecLosses, setConsecLosses] = useState(0);
  const [speedTrades, setSpeedTrades] = useState(0);

  /* Contracts that belong to this SpeedBot */
  const myContractsRef = useRef<Set<number>>(new Set());

  /* When a tracked contract settles → update SpeedBot's P/L */
  useEffect(() => {
    openTrades.forEach((t) => {
      if (!myContractsRef.current.has(t.contract_id)) return;
      if (!t.is_sold) return;
      myContractsRef.current.delete(t.contract_id);

      const won = t.profit > 0;
      setSpeedPL((prev) => +(prev + t.profit).toFixed(2));
      setSpeedTrades((prev) => prev + 1);
      if (won) {
        setWins((w) => w + 1);
        setConsecWins((c) => c + 1);
        setConsecLosses(0);
      } else {
        setLosses((l) => l + 1);
        setConsecLosses((c) => c + 1);
        setConsecWins(0);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades]);

  /* Last digit from live price */
  const lastDigit =
    livePrice !== null
      ? Number(livePrice.toFixed(2).replace('.', '').slice(-1))
      : null;

  const placeTradeOnce = () => {
    let contractType = 'CALL';
    let barrier: string | undefined;
    if (tradeType === 'Digits Over') {
      contractType = 'DIGITOVER';
      barrier = String(predictionBefore);
    } else if (tradeType === 'Digits Under') {
      contractType = 'DIGITUNDER';
      barrier = String(predictionBefore);
    } else if (tradeType === 'Digits Even') {
      contractType = 'DIGITEVEN';
    } else if (tradeType === 'Digits Odd') {
      contractType = 'DIGITODD';
    } else if (tradeType === 'Rise') {
      contractType = 'CALL';
    } else {
      contractType = 'PUT';
    }

    const dirLabel =
      tradeType === 'Digits Over'
        ? `Over ${predictionBefore}`
        : tradeType === 'Digits Under'
        ? `Under ${predictionBefore}`
        : tradeType === 'Digits Even'
        ? 'Even'
        : tradeType === 'Digits Odd'
        ? 'Odd'
        : tradeType === 'Rise'
        ? 'Rise'
        : 'Fall';

    if (authorized) {
      const snapshot = new Set(openTrades.map((t) => t.contract_id));

      placeRealTrade({
        symbol,
        contractType,
        stake,
        duration: Math.max(1, ticks),
        durationUnit: 't',
        barrier,
      });

      console.log('[SpeedBot] Real trade fired:', {
        symbol,
        contractType,
        stake,
        ticks,
        barrier,
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
              '[SpeedBot] Registered contract',
              t.contract_id,
              'for tracking'
            );
          }
        });
      }, 200);
      setTimeout(() => {
        cancelled = true;
        clearInterval(poll);
      }, 5000);

      return;
    }

    /* Paper fallback */
    const t: 'rise_fall' | 'even_odd' | 'over_under' | 'digits' =
      tradeType === 'Rise' || tradeType === 'Fall'
        ? 'rise_fall'
        : tradeType === 'Digits Even' || tradeType === 'Digits Odd'
        ? 'even_odd'
        : tradeType === 'Digits Over' || tradeType === 'Digits Under'
        ? 'over_under'
        : 'digits';

    placePaperTrade({
      market,
      symbol,
      type: t,
      direction: dirLabel,
      stake,
      ticks,
    });
  };

  /* ---- Auto-fire loop ---- */
  useEffect(() => {
    runningRef.current = running;
    if (!running) return;

    placeTradeOnce();

    const interval = setInterval(() => {
      if (!runningRef.current) return;
      placeTradeOnce();
    }, 6000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, authorized, market, tradeType, stake, ticks, predictionBefore]);

  /* ---- Auto-stop on SL/TP ---- */
  useEffect(() => {
    if (!running) return;
    if (stoppedReasonRef.current) return;

    if (takeProfit > 0 && speedPL >= takeProfit) {
      stoppedReasonRef.current = 'TP';
      setRunning(false);
      console.log(
        `[SpeedBot] Take-profit hit (${speedPL.toFixed(
          2
        )} >= ${takeProfit}) — stopped`
      );
    } else if (stopLoss > 0 && speedPL <= -stopLoss) {
      stoppedReasonRef.current = 'SL';
      setRunning(false);
      console.log(
        `[SpeedBot] Stop-loss hit (${speedPL.toFixed(
          2
        )} <= -${stopLoss}) — stopped`
      );
    }
  }, [speedPL, running, stopLoss, takeProfit]);

  const toggleStart = () => {
    setRunning((r) => {
      if (!r) stoppedReasonRef.current = null;
      return !r;
    });
  };

  return (
    <div className="bg-[#0d1b3d] rounded-xl p-6 sm:p-10 text-white">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-white">SpeedBot</h1>
        <p className="text-sm text-white/60 mt-1">
          High-speed automated trading bot
        </p>
      </div>

      {/* Form panel */}
      <div className="bg-[#132a52] border border-white/10 rounded-xl p-6 max-w-4xl mx-auto">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Field label="Volatility">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="input"
            >
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Trade type">
            <select
              value={tradeType}
              onChange={(e) => setTradeType(e.target.value)}
              className="input"
            >
              {TRADE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ticks">
            <input
              type="number"
              value={ticks}
              onChange={(e) => setTicks(Number(e.target.value))}
              className="input"
            />
          </Field>

          <Field label="Stake">
            <input
              type="number"
              step="0.01"
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>

        {/* Toggles row */}
        <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
          <Toggle
            label="Alternate Even and Odd"
            value={alternate}
            onChange={setAlternate}
          />
          <Toggle
            label="Alternate on Loss"
            value={alternateOnLoss}
            onChange={setAlternateOnLoss}
          />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Field label="Over/Under prediction (pre-loss)">
            <input
              type="number"
              value={predictionBefore}
              onChange={(e) => setPredictionBefore(Number(e.target.value))}
              className="input"
            />
          </Field>

          <Field label="Over/Under prediction (after loss)">
            <input
              type="number"
              value={predictionAfter}
              onChange={(e) => setPredictionAfter(Number(e.target.value))}
              className="input"
            />
          </Field>

          <Field label="Martingale multiplier">
            <input
              type="number"
              step="0.01"
              value={martingale}
              onChange={(e) => setMartingale(Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>

        {/* Risk management row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Field label="Stop Loss ($)">
            <input
              type="number"
              step="0.5"
              min={0}
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="input"
              placeholder="0 = off"
            />
          </Field>

          <Field label="Take Profit ($)">
            <input
              type="number"
              step="0.5"
              min={0}
              value={takeProfit}
              onChange={(e) => setTakeProfit(Number(e.target.value))}
              className="input"
              placeholder="0 = off"
            />
          </Field>
        </div>

        {/* Live status row */}
        <div className="flex flex-wrap justify-between items-center gap-4 text-xs text-white/70 border-t border-white/10 pt-4 mb-6">
          <span>
            Total Profit/Loss:{' '}
            <span
              className={`font-mono font-semibold ${
                speedPL > 0
                  ? 'text-green-400'
                  : speedPL < 0
                  ? 'text-red-400'
                  : 'text-white/70'
              }`}
            >
              {speedPL >= 0 ? '+' : ''}
              {speedPL.toFixed(2)}
            </span>
          </span>
          <span>
            Last Digit:{' '}
            <span className="font-mono font-semibold text-white">
              {lastDigit !== null ? lastDigit : '-'}
            </span>
          </span>
          <span>
            Consecutive Wins:{' '}
            <span className="font-semibold text-green-400">{consecWins}</span>{' '}
            Consecutive Losses:{' '}
            <span className="font-semibold text-red-400">{consecLosses}</span>
          </span>
        </div>

        {/* Trades / W/L summary */}
        {speedTrades > 0 && (
          <div className="flex justify-between items-center text-xs text-white/60 border-t border-white/10 pt-3 mb-4">
            <span>
              Trades:{' '}
              <span className="text-white font-semibold">{speedTrades}</span>
            </span>
            <span>
              Wins:{' '}
              <span className="text-green-400 font-semibold">{wins}</span> ·
              Losses:{' '}
              <span className="text-red-400 font-semibold">{losses}</span>
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={placeTradeOnce}
            className="bg-teal-500/70 hover:bg-teal-500 text-white text-sm font-semibold px-6 py-2.5 rounded-md transition"
          >
            Trade once
          </button>
          <button
            onClick={toggleStart}
            className={`${
              running
                ? 'bg-red-500/80 hover:bg-red-500 animate-pulse'
                : 'bg-green-600/70 hover:bg-green-600'
            } text-white text-sm font-semibold px-6 py-2.5 rounded-md transition flex items-center gap-2`}
          >
            {running ? (
              <>
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Auto trading — every 6s
              </>
            ) : (
              'Start auto trading'
            )}
          </button>
        </div>

        {/* Status messages */}
        {running && (
          <div className="text-center text-[11px] text-teal-300 mt-3">
            ● Auto trading active — new trade every 6 seconds
          </div>
        )}

        {stoppedReasonRef.current === 'TP' && !running && (
          <div className="text-center text-[11px] text-green-400 mt-3">
            🎯 Auto stopped — Take Profit hit
          </div>
        )}

        {stoppedReasonRef.current === 'SL' && !running && (
          <div className="text-center text-[11px] text-red-400 mt-3">
            🛑 Auto stopped — Stop Loss hit
          </div>
        )}
      </div>

      {/* Local styles */}
      <style>{`
        .input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 13px;
          outline: none;
        }
        .input:focus {
          border-color: rgba(90,190,250,0.6);
        }
        .input option {
          color: #111;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-white/50 mb-1">
        {label}
      </span>
      {children}
    </label>
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
      <span className="text-white/80">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition relative ${
          value ? 'bg-teal-500' : 'bg-white/20'
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