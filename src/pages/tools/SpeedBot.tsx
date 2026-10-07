import { useState } from 'react';
import { useTradeStore } from '../../lib/trading/store';

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
  const [stake, setStake] = useState(0.5);
  const [alternate, setAlternate] = useState(false);
  const [alternateOnLoss, setAlternateOnLoss] = useState(false);
  const [predictionBefore, setPredictionBefore] = useState(5);
  const [predictionAfter, setPredictionAfter] = useState(7);
  const [martingale, setMartingale] = useState(1.0);
  const [running, setRunning] = useState(false);

  const { placeTrade } = useTradeStore();

  const placeTradeOnce = () => {
    const direction =
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

    const t: 'rise_fall' | 'even_odd' | 'over_under' | 'digits' =
      tradeType === 'Rise' || tradeType === 'Fall'
        ? 'rise_fall'
        : tradeType === 'Digits Even' || tradeType === 'Digits Odd'
        ? 'even_odd'
        : tradeType === 'Digits Over' || tradeType === 'Digits Under'
        ? 'over_under'
        : 'digits';

    placeTrade({
      market,
      symbol: MARKET_SYMBOL[market] ?? '1HZ100V',
      type: t,
      direction,
      stake,
      ticks,
    });

    alert(
      `Trade placed: ${direction} on ${market}\nStake: $${stake.toFixed(
        2
      )}\nCheck Reports in a few seconds.`
    );
  };

  const toggleStart = () => {
    if (!running) {
      placeTradeOnce();
    }
    setRunning((r) => !r);
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

        {/* Status row */}
        <div className="flex flex-wrap justify-between items-center gap-4 text-xs text-white/70 border-t border-white/10 pt-4 mb-6">
          <span>Total Profit/Loss: 0.00</span>
          <span>Last Digit: -</span>
          <span>Consecutive Wins: 0 Consecutive Losses: 0</span>
        </div>

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
                ? 'bg-red-500/80 hover:bg-red-500'
                : 'bg-green-600/70 hover:bg-green-600'
            } text-white text-sm font-semibold px-6 py-2.5 rounded-md transition`}
          >
            {running ? 'Stop auto trading' : 'Start auto trading'}
          </button>
        </div>
      </div>

      {/* Local styles for input fields */}
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