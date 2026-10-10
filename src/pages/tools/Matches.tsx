import { useEffect, useMemo, useRef, useState } from 'react';
import { useDigitStream } from '../../lib/deriv';
import { computeDigitStats, mostFrequent } from '../../lib/digitStats';
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

export default function Matches() {
  const [marketName, setMarketName] = useState('Volatility 100 (1s) Index');
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [numContracts, setNumContracts] = useState(1);
  const [stakePerContract, setStakePerContract] = useState(0.35);
  const [analysisCount, setAnalysisCount] = useState(100);

  /* ---- Live stream ---- */
  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(
    symbol,
    analysisCount
  );

  /* ---- Stores ---- */
  const { placeTrade: placePaperTrade } = useTradeStore();
  const { authorized, placeTrade: placeRealTrade, openTrades } = useAuthWs();

  /* ---- Stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);
  const most = digits.length >= 5 ? mostFrequent(digitStats) : null;

  /* ---- Local P/L tracking ---- */
  const [matchPL, setMatchPL] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [matchTrades, setMatchTrades] = useState(0);

  const myContractsRef = useRef<Set<number>>(new Set());

  /* Watch settled contracts */
  useEffect(() => {
    openTrades.forEach((t) => {
      if (!myContractsRef.current.has(t.contract_id)) return;
      if (!t.is_sold) return;
      myContractsRef.current.delete(t.contract_id);

      const won = t.profit > 0;
      setMatchPL((prev) => +(prev + t.profit).toFixed(2));
      setMatchTrades((prev) => prev + 1);
      if (won) setWins((w) => w + 1);
      else setLosses((l) => l + 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades]);

  /* ---- Actions ---- */
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<number[]>([]);

  /* ---- Auto-trading loop ---- */
  const [autoRunning, setAutoRunning] = useState(false);
  const autoRunningRef = useRef(false);

  /* ---- Risk management ---- */
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(5);
  const stoppedReasonRef = useRef<string | null>(null);

  const placeContracts = () => {
    setPlacing(true);

    for (let i = 0; i < numContracts; i++) {
      if (authorized) {
        const snapshot = new Set(openTrades.map((t) => t.contract_id));

        placeRealTrade({
          symbol,
          contractType: 'DIGITMATCH',
          stake: stakePerContract,
          duration: 1,
          durationUnit: 't',
          barrier: String(selectedDigit),
        });

        console.log('[Matches] Real trade fired:', {
          symbol,
          contractType: 'DIGITMATCH',
          stake: stakePerContract,
          barrier: String(selectedDigit),
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
              console.log('[Matches] Registered contract', t.contract_id);
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
          type: 'matches_differs',
          direction: `Matches ${selectedDigit}`,
          stake: stakePerContract,
          ticks: 1,
          entryPrice: price ?? undefined,
        });
      }
    }

    setPlaced((p) => [...p, Date.now()]);
    setTimeout(() => setPlacing(false), 500);
  };

  const usePredictedDigit = () => {
    if (most !== null) setSelectedDigit(most);
  };

  /* Auto-fire loop — runs placeContracts every 6 seconds */
  useEffect(() => {
    autoRunningRef.current = autoRunning;
    if (!autoRunning) return;

    placeContracts();

    const interval = setInterval(() => {
      if (!autoRunningRef.current) return;
      placeContracts();
    }, 6000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoRunning,
    authorized,
    marketName,
    selectedDigit,
    numContracts,
    stakePerContract,
  ]);

  /* ---- Auto-stop on SL/TP ---- */
  useEffect(() => {
    if (!autoRunning) return;
    if (stoppedReasonRef.current) return;

    if (takeProfit > 0 && matchPL >= takeProfit) {
      stoppedReasonRef.current = 'TP';
      setAutoRunning(false);
      console.log(
        `[Matches] Take-profit hit (${matchPL.toFixed(
          2
        )} >= ${takeProfit}) — stopped`
      );
    } else if (stopLoss > 0 && matchPL <= -stopLoss) {
      stoppedReasonRef.current = 'SL';
      setAutoRunning(false);
      console.log(
        `[Matches] Stop-loss hit (${matchPL.toFixed(
          2
        )} <= -${stopLoss}) — stopped`
      );
    }
  }, [matchPL, autoRunning, stopLoss, takeProfit]);

  return (
    <div className="mt-2">
      {/* Banner — teal for Matches */}
      <div className="bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 text-white rounded-lg px-6 py-8 text-center shadow-md mb-6">
        <h1 className="text-2xl font-semibold">
          Matches - Digits Market Trading
        </h1>
        <p className="text-sm text-white/80 mt-1">
          Place multiple contracts that target a single digit
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============ LEFT: FORM ============ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <Field label="Market">
            <select
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              className="form-input"
            >
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Select Digit (0-9)">
            <input
              type="number"
              min={0}
              max={9}
              value={selectedDigit}
              onChange={(e) => {
                const v = Math.max(0, Math.min(9, Number(e.target.value)));
                setSelectedDigit(v);
              }}
              className="form-input"
            />
          </Field>

          <Field label="Number of Contracts">
            <input
              type="number"
              min={1}
              value={numContracts}
              onChange={(e) =>
                setNumContracts(Math.max(1, Number(e.target.value)))
              }
              className="form-input"
            />
          </Field>

          <Field label="Stake per Contract">
            <input
              type="number"
              step="0.01"
              min={0.35}
              value={stakePerContract}
              onChange={(e) => setStakePerContract(Number(e.target.value))}
              className="form-input"
            />
          </Field>

          <Field label="Analysis Count (Ticks)">
            <input
              type="number"
              min={20}
              max={1000}
              value={analysisCount}
              onChange={(e) =>
                setAnalysisCount(Math.max(20, Number(e.target.value)))
              }
              className="form-input"
            />
          </Field>

          {/* Risk management row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop Loss ($)">
              <input
                type="number"
                step="0.5"
                min={0}
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="form-input"
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
                className="form-input"
                placeholder="0 = off"
              />
            </Field>
          </div>

          {/* Live displays */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Field label="Current Digit">
              <div className="w-14 h-14 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold text-xl flex items-center justify-center mx-auto">
                {currentDigit !== null ? currentDigit : '—'}
              </div>
            </Field>
            <Field label="AI Prediction (Most Frequent)">
              <div className="w-14 h-14 rounded-md bg-green-600 text-white font-bold text-xl flex items-center justify-center mx-auto">
                {most !== null ? most : '—'}
              </div>
            </Field>
          </div>

          <button
            onClick={usePredictedDigit}
            disabled={most === null}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-md transition"
          >
            Use Predicted Digit ({most !== null ? most : '—'})
          </button>

          <button
            onClick={placeContracts}
            disabled={placing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-md transition"
          >
            {placing
              ? 'Placing…'
              : `Place ${numContracts} Contract${
                  numContracts !== 1 ? 's' : ''
                } - Matches Digit ${selectedDigit}`}
          </button>

          {/* Auto-trading toggle */}
          <button
            onClick={() =>
              setAutoRunning((r) => {
                if (!r) stoppedReasonRef.current = null;
                return !r;
              })
            }
            className={`w-full ${
              autoRunning
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-green-500 hover:bg-green-600'
            } text-white text-sm font-semibold py-2.5 rounded-md transition flex items-center justify-center gap-2`}
          >
            {autoRunning ? (
              <>
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Stop auto trading — every 6s
              </>
            ) : (
              '▶ Start auto trading'
            )}
          </button>

          {/* Live P/L */}
          {matchTrades > 0 && (
            <div className="flex justify-between items-center text-xs text-gray-600 border-t border-gray-100 pt-3">
              <span>
                Total P/L:{' '}
                <span
                  className={`font-mono font-semibold ${
                    matchPL > 0
                      ? 'text-green-600'
                      : matchPL < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {matchPL >= 0 ? '+' : ''}
                  {matchPL.toFixed(2)}
                </span>
              </span>
              <span>
                Wins:{' '}
                <span className="text-green-600 font-semibold">{wins}</span> ·
                Losses:{' '}
                <span className="text-red-600 font-semibold">{losses}</span>
              </span>
            </div>
          )}

          {autoRunning && (
            <div className="text-center text-[11px] text-teal-600 border-t border-gray-100 pt-2">
              ● Auto trading active — new trade every 6 seconds
            </div>
          )}

          {stoppedReasonRef.current === 'TP' && !autoRunning && (
            <div className="text-center text-[11px] text-green-600 border-t border-gray-100 pt-2">
              🎯 Auto stopped — Take Profit hit
            </div>
          )}

          {stoppedReasonRef.current === 'SL' && !autoRunning && (
            <div className="text-center text-[11px] text-red-600 border-t border-gray-100 pt-2">
              🛑 Auto stopped — Stop Loss hit
            </div>
          )}

          {placed.length > 0 && (
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              {placed.length} placement{placed.length !== 1 ? 's' : ''} this
              session
            </div>
          )}

          <div className="text-xs text-gray-400 flex items-center gap-2 pt-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {connected
              ? `Live · ${digits.length}/${analysisCount} ticks collected`
              : 'Connecting…'}
            {price !== null && (
              <span className="ml-auto font-mono">{price.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* ============ RIGHT: HOW IT WORKS ============ */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-navy mb-4">
            How Matches Works:
          </h2>

          <ul className="space-y-3 text-sm">
            <Bullet>Select a digit (0-9) that you want to match</Bullet>
            <Bullet>Set the number of contracts to place in one run</Bullet>
            <Bullet>Set the stake amount per contract</Bullet>
            <Bullet>
              Click "Place Contracts" to place all contracts simultaneously
            </Bullet>
            <Bullet>All contracts will target the same selected digit</Bullet>
            <Bullet>
              Each contract uses DIGITMATCH — you WIN if the result digit IS
              the selected digit
            </Bullet>
            <Bullet>
              Example: if you select digit 3, you win only if result is 3
            </Bullet>
          </ul>

          <h3 className="text-base font-semibold text-navy mt-6 mb-4">
            AI Analysis:
          </h3>

          <ul className="space-y-3 text-sm">
            <Bullet>
              Analyzes the last N ticks (configurable) to find the most
              frequent digit
            </Bullet>
            <Bullet>
              The predicted digit (most frequent) is shown in{' '}
              <span className="text-green-600 font-semibold">GREEN</span>
            </Bullet>
            <Bullet>
              Current digit is highlighted in green if it matches the
              prediction
            </Bullet>
            <Bullet>
              Click "Use Predicted Digit" to automatically select the
              AI-suggested digit
            </Bullet>
            <Bullet>Analysis updates in real-time as new ticks arrive</Bullet>
          </ul>
        </div>
      </div>

      {/* AI floating button */}
      <button className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
        AI
      </button>

      {/* Local input styling */}
      <style>{`
        .form-input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #f9fafb;
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: #10b981;
          background: white;
        }
      `}</style>
    </div>
  );
}

/* ---------- Small components ---------- */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-gray-600">
      <span className="text-teal-500 mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  );
}