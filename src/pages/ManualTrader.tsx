import { useEffect, useMemo, useState } from 'react';
import { useDigitStream } from '../lib/deriv';
import { computeDigitStats } from '../lib/digitStats';
import { useAuthWs } from '../lib/auth-ws';

/* ---------- Config ---------- */
const MARKET_MAP: Record<string, string> = {
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
  'Volatility 100 Index': 'R_100',
};

const MARKETS = Object.keys(MARKET_MAP);

type TradeTypeKey =
  | 'evenodd'
  | 'matchesdiffers'
  | 'overunder'
  | 'callput'
  | 'higherlower'
  | 'touchnotouch';

const TRADE_TYPE_LABELS: Record<TradeTypeKey, string> = {
  evenodd: 'Even/Odd',
  matchesdiffers: 'Matches/Differs',
  overunder: 'Over/Under',
  callput: 'Call/Put',
  higherlower: 'Higher/Lower',
  touchnotouch: 'Touch/No Touch',
};

export default function ManualTrader() {
  const [marketName, setMarketName] = useState('Volatility 100 Index');
  const [tradeType, setTradeType] = useState<TradeTypeKey>('evenodd');
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [isTrading, setIsTrading] = useState(false);

  // FIX: Stake is now dynamic
  const [stake, setStake] = useState(10);

  // Live payouts from Deriv
  const [primaryPayout, setPrimaryPayout] = useState<number | null>(null);
  const [secondaryPayout, setSecondaryPayout] = useState<number | null>(null);

  const { authorized, placeTrade, subscribeProposal, unsubscribeProposal } = useAuthWs();

  const symbol = MARKET_MAP[marketName] as any;

  /* ---- Live stream ---- */
  const { currentDigit, digits, connected } = useDigitStream(symbol, 1000);

  /* ---- Digit stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);

  /* ---- Resolve contract types based on trade type ---- */
  const getContractTypes = () => {
    switch (tradeType) {
      case 'evenodd': return { primary: 'DIGITEVEN', secondary: 'DIGITODD', barrier: undefined };
      case 'matchesdiffers': return { primary: 'DIGITMATCH', secondary: 'DIGITDIFF', barrier: String(selectedDigit) };
      case 'overunder': return { primary: 'DIGITOVER', secondary: 'DIGITUNDER', barrier: String(selectedDigit) };
      case 'callput': return { primary: 'CALL', secondary: 'PUT', barrier: undefined };
      case 'higherlower': return { primary: 'CALLE', secondary: 'PUTE', barrier: undefined };
      case 'touchnotouch': return { primary: 'ONETOUCH', secondary: 'NOTOUCH', barrier: undefined };
    }
  };

  /* ---- Subscribe to live payouts (waits for WebSocket) ---- */
  useEffect(() => {
    if (!authorized) return;

    // Reset old payouts when parameters change
    setPrimaryPayout(null);
    setSecondaryPayout(null);

    const { primary, secondary, barrier } = getContractTypes();
    const isDigit = primary.startsWith('DIGIT');
    const duration = isDigit ? 1 : 2;

    const primaryTimeout = setTimeout(() => {
      subscribeProposal(
        { symbol, contractType: primary, stake, duration, durationUnit: 't', barrier },
        (payout) => setPrimaryPayout(payout)
      );
    }, 1000);

    const secondaryTimeout = setTimeout(() => {
      subscribeProposal(
        { symbol, contractType: secondary, stake, duration, durationUnit: 't', barrier },
        (payout) => setSecondaryPayout(payout)
      );
    }, 1500);

    return () => {
      clearTimeout(primaryTimeout);
      clearTimeout(secondaryTimeout);
      unsubscribeProposal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, symbol, tradeType, selectedDigit, stake]);

  /* ---- Stake controls ---- */
  const adjustStake = (delta: number) => {
    setStake((s) => {
      const next = +(s + delta).toFixed(2);
      return Math.max(0.35, next); // Deriv minimum stake
    });
  };

  /* ---- Place trade ---- */
  const handleTrade = async (direction: 'primary' | 'secondary') => {
    if (!authorized) {
      alert('Please log in to place trades.');
      return;
    }

    setIsTrading(true);

    const { primary, secondary, barrier } = getContractTypes();
    const contractType = direction === 'primary' ? primary : secondary;

    const isDigit = contractType.startsWith('DIGIT');
    const duration = isDigit ? 1 : 2;
    const durationUnit = 't';

    try {
      await placeTrade({
        symbol,
        contractType,
        stake,
        duration,
        durationUnit,
        barrier,
      });
      console.log(`[Manual Trader] Placed ${contractType}`, { symbol, stake, barrier });
    } catch (error) {
      console.error('Manual Trader error:', error);
    } finally {
      setIsTrading(false);
    }
  };

  /* ---- Button labels ---- */
  const primaryLabel =
    tradeType === 'evenodd' ? 'Even' :
    tradeType === 'matchesdiffers' ? 'Matches' :
    tradeType === 'overunder' ? 'Over' :
    tradeType === 'callput' ? 'Rise' :
    tradeType === 'higherlower' ? 'Higher' : 'Touch';

  const secondaryLabel =
    tradeType === 'evenodd' ? 'Odd' :
    tradeType === 'matchesdiffers' ? 'Differs' :
    tradeType === 'overunder' ? 'Under' :
    tradeType === 'callput' ? 'Fall' :
    tradeType === 'higherlower' ? 'Lower' : 'No Touch';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#0a0e27] overflow-hidden">
      {/* ============ TOP: MARKET SELECTOR ============ */}
      <div className="px-4 py-3 border-b border-white/5 bg-[#141832]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">100</span>
          </div>
          <div className="flex-1">
            <select
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              className="font-semibold text-white bg-transparent outline-none cursor-pointer text-base w-full"
            >
              {MARKETS.map((m) => (
                <option key={m} value={m} className="bg-[#141832]">{m}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-500">live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ MIDDLE: DIGIT GAUGES ============ */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative">
        <div className="w-full max-w-md">
          <div className="grid grid-cols-5 gap-3 mb-6">
            {digitStats.slice(0, 5).map((d) => (
              <DigitGauge key={d.digit} digit={d.digit} pct={d.pct} isCurrent={d.digit === currentDigit} />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {digitStats.slice(5, 10).map((d) => (
              <DigitGauge key={d.digit} digit={d.digit} pct={d.pct} isCurrent={d.digit === currentDigit} />
            ))}
          </div>
        </div>
        <button className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-2xl">‹</button>
        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-2xl">›</button>
      </div>

      {/* ============ BOTTOM: TRADE TICKET ============ */}
      <div className="bg-[#141832] rounded-t-2xl border-t border-white/10 px-4 pt-4 pb-6">
        {/* Trade type + Digit */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowTypePicker(true)}
            className="flex-1 flex items-center gap-3 px-3 py-3 bg-[#0a0e27] border border-white/10 rounded-lg text-left"
          >
            <span className="text-lg">
              {tradeType === 'evenodd' ? '🎯' :
               tradeType === 'matchesdiffers' ? '🔢' :
               tradeType === 'overunder' ? '📊' :
               tradeType === 'callput' ? '📈' :
               tradeType === 'higherlower' ? '↕️' : '👆'}
            </span>
            <span className="font-semibold text-white text-sm flex-1">
              {TRADE_TYPE_LABELS[tradeType]}
            </span>
            <span className="text-gray-400">›</span>
          </button>

          {(tradeType === 'matchesdiffers' || tradeType === 'overunder') && (
            <div className="flex items-center gap-1 px-3 py-3 bg-[#0a0e27] border border-white/10 rounded-lg">
              <span className="text-xs text-gray-400">Digit:</span>
              <input
                type="number"
                min={0}
                max={9}
                value={selectedDigit}
                onChange={(e) => setSelectedDigit(Math.max(0, Math.min(9, Number(e.target.value))))}
                className="w-8 bg-transparent text-white font-bold text-center outline-none"
              />
            </div>
          )}
        </div>

        {/* FIX: Stake input with +/- controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => adjustStake(-1)}
            className="w-12 h-12 rounded-lg bg-[#0a0e27] border border-white/10 text-white text-xl font-bold hover:bg-white/5 transition flex items-center justify-center"
          >
            −
          </button>
          <div className="flex-1 flex items-center justify-center bg-[#0a0e27] border border-white/10 rounded-lg py-3">
            <input
              type="number"
              step="0.5"
              min="0.35"
              value={stake}
              onChange={(e) => setStake(Math.max(0.35, Number(e.target.value) || 0.35))}
              className="bg-transparent text-white font-bold text-2xl text-center outline-none w-32"
            />
            <span className="text-gray-400 text-sm ml-2">USD</span>
          </div>
          <button
            onClick={() => adjustStake(1)}
            className="w-12 h-12 rounded-lg bg-[#0a0e27] border border-white/10 text-white text-xl font-bold hover:bg-white/5 transition flex items-center justify-center"
          >
            +
          </button>
        </div>

        {/* Quick stake chips */}
        <div className="flex gap-1 mb-4">
          {[1, 5, 10, 25, 50].map((amount) => (
            <button
              key={amount}
              onClick={() => setStake(amount)}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
                stake === amount
                  ? 'bg-teal-500 text-white'
                  : 'bg-[#0a0e27] text-gray-400 border border-white/10 hover:bg-white/5'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>

        {/* Risk disclaimer row */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0e27] border border-white/10 rounded-lg mb-4">
          <span className="text-xs text-yellow-500 font-medium">Risk Disclaimer</span>
          <span className="text-xs text-gray-500">Max payout: {((primaryPayout || 0)).toFixed(2)} USD</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleTrade('primary')}
            disabled={isTrading || !authorized}
            className={`rounded-xl overflow-hidden transition ${
              isTrading || !authorized ? 'opacity-50' : ''
            }`}
          >
            <div className="bg-teal-500 text-white py-4 flex items-center justify-center gap-2">
              <span className="text-lg">
                {tradeType === 'matchesdiffers' ? '❄️' : tradeType === 'overunder' ? '📈' : '🎲'}
              </span>
              <span className="font-bold text-lg">{primaryLabel}</span>
            </div>
            <div className="bg-teal-600 text-white py-2 text-center text-xs flex items-center justify-between px-4">
              <span>Payout</span>
              <span className="font-bold">
                {primaryPayout !== null ? `${primaryPayout.toFixed(2)} USD` : '...'}
              </span>
            </div>
          </button>

          <button
            onClick={() => handleTrade('secondary')}
            disabled={isTrading || !authorized}
            className={`rounded-xl overflow-hidden transition ${
              isTrading || !authorized ? 'opacity-50' : ''
            }`}
          >
            <div className="bg-red-500 text-white py-4 flex items-center justify-center gap-2">
              <span className="text-lg">
                {tradeType === 'matchesdiffers' ? '❄️' : tradeType === 'overunder' ? '📉' : '🎲'}
              </span>
              <span className="font-bold text-lg">{secondaryLabel}</span>
            </div>
            <div className="bg-red-600 text-white py-2 text-center text-xs flex items-center justify-between px-4">
              <span>Payout</span>
              <span className="font-bold">
                {secondaryPayout !== null ? `${secondaryPayout.toFixed(2)} USD` : '...'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ============ TRADE TYPE PICKER ============ */}
      {showTypePicker && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowTypePicker(false)}
        >
          <div
            className="bg-[#141832] rounded-t-2xl w-full max-w-2xl max-h-[80vh] overflow-auto border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#141832] p-4 border-b border-white/10 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-white">Trade types</h2>
              <button onClick={() => setShowTypePicker(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <TypeCard label="Even/Odd" icon="🎯" onClick={() => { setTradeType('evenodd'); setShowTypePicker(false); }} />
              <TypeCard label="Matches/Differs" icon="🔢" onClick={() => { setTradeType('matchesdiffers'); setShowTypePicker(false); }} />
              <TypeCard label="Over/Under" icon="📊" onClick={() => { setTradeType('overunder'); setShowTypePicker(false); }} />
              <TypeCard label="Call/Put (Rise/Fall)" icon="📈" onClick={() => { setTradeType('callput'); setShowTypePicker(false); }} />
              <TypeCard label="Higher/Lower" icon="↕️" onClick={() => { setTradeType('higherlower'); setShowTypePicker(false); }} />
              <TypeCard label="Touch/No Touch" icon="👆" onClick={() => { setTradeType('touchnotouch'); setShowTypePicker(false); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Digit Gauge ---------- */
function DigitGauge({ digit, pct, isCurrent }: { digit: number; pct: number; isCurrent: boolean }) {
  const r = 22;
  const strokeDasharray = 2 * Math.PI * r;
  const strokeDashoffset = strokeDasharray - (pct / 100) * strokeDasharray;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="#1e2347" strokeWidth="3" />
          <circle
            cx="28" cy="28" r={r}
            fill="none"
            stroke={isCurrent ? '#3b82f6' : '#14b8a6'}
            strokeWidth="3"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-base font-bold ${isCurrent ? 'text-blue-400' : 'text-white'}`}>
            {digit}
          </span>
        </div>
        {isCurrent && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500" />
        )}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">{pct.toFixed(1)}%</div>
    </div>
  );
}

/* ---------- Type Card ---------- */
function TypeCard({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-4 bg-[#0a0e27] hover:bg-[#1a1f3d] border border-white/10 rounded-lg text-left transition"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-white">{label}</span>
    </button>
  );
}