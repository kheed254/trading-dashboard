import { useEffect, useMemo, useRef, useState } from 'react';
import { useDigitStream } from '../lib/deriv';
import { computeDigitStats } from '../lib/digitStats';
import { useAuthWs } from '../lib/auth-ws-context';

/* ---------- Config ---------- */
const MARKET_MAP: Record<string, string> = {
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 30 (1s) Index': '1HZ30V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
  'Volatility 10 Index': 'R_10',
  'Volatility 25 Index': 'R_25',
  'Volatility 50 Index': 'R_50',
  'Volatility 75 Index': 'R_75',
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

type JournalEntry = { time: string; text: string; kind: string };

export default function ManualTrader() {
  const [marketName, setMarketName] = useState('Volatility 100 Index');
  const [tradeType, setTradeType] = useState<TradeTypeKey>('evenodd');
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [isTrading, setIsTrading] = useState(false);

  // Take Profit / Stop Loss
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfitTarget, setTakeProfitTarget] = useState(50);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossTarget, setStopLossTarget] = useState(50);
  const [targetReached, setTargetReached] = useState<'tp' | 'sl' | null>(null);

  // Session
  const [sessionPL, setSessionPL] = useState(0);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [showJournal, setShowJournal] = useState(false);

  // Auto-Trade
  const [autoTrade, setAutoTrade] = useState(false);
  const [autoDirection, setAutoDirection] = useState<'primary' | 'secondary'>('primary');
  const [autoDelay, setAutoDelay] = useState(3);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live payouts
  const [primaryPayout, setPrimaryPayout] = useState<number | null>(null);
  const [secondaryPayout, setSecondaryPayout] = useState<number | null>(null);

  // Stake
  const [stake, setStake] = useState(10);

  const { authorized, placeTrade, subscribeProposal, unsubscribeProposal, openTrades } = useAuthWs();

  const symbol = MARKET_MAP[marketName] as any;

  /* ---- Live stream ---- */
  const { currentDigit, digits, connected } = useDigitStream(symbol, 1000);

  /* ---- Digit stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);

  /* ---- Journal helper ---- */
  const addJournal = (text: string, kind = 'info') =>
    setJournal((prev) => [{ time: new Date().toLocaleTimeString(), text, kind }, ...prev].slice(0, 100));

  /* ---- Resolve contract types ---- */
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

  /* ---- Subscribe to live payouts ---- */
  useEffect(() => {
    if (!authorized) return;

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

  /* ---- Track settled trades for TP/SL ---- */
  const trackedContractIds = useRef(new Set<number>());

  useEffect(() => {
    openTrades.forEach((t) => {
      if (t.is_sold && !trackedContractIds.current.has(t.contract_id)) {
        trackedContractIds.current.add(t.contract_id);

        setSessionPL((prev) => {
          const newPL = +(prev + t.profit).toFixed(2);
          addJournal(
            `${t.profit > 0 ? '✓ Won' : '✗ Lost'} ${t.profit >= 0 ? '+' : ''}$${t.profit.toFixed(2)} — Session P/L: $${newPL.toFixed(2)}`,
            t.profit > 0 ? 'profit' : 'loss'
          );

          if (takeProfitEnabled && newPL >= takeProfitTarget && !targetReached) {
            setTargetReached('tp');
            setAutoTrade(false);
            addJournal(`🎯 Take Profit hit (+$${newPL.toFixed(2)}) — stopped`, 'profit');
          }

          if (stopLossEnabled && newPL <= -stopLossTarget && !targetReached) {
            setTargetReached('sl');
            setAutoTrade(false);
            addJournal(`🛑 Stop Loss hit ($${newPL.toFixed(2)}) — stopped`, 'loss');
          }

          return newPL;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades, takeProfitEnabled, takeProfitTarget, stopLossEnabled, stopLossTarget, targetReached]);

  /* ---- Reset session ---- */
  const resetSession = () => {
    setSessionPL(0);
    setTargetReached(null);
    trackedContractIds.current.clear();
    addJournal('Session reset', 'info');
  };

  /* ---- Stake controls ---- */
  const adjustStake = (delta: number) => {
    setStake((s) => Math.max(0.35, +(s + delta).toFixed(2)));
  };

  /* ---- Place trade ---- */
  const handleTrade = async (direction: 'primary' | 'secondary') => {
    if (!authorized) {
      alert('Please log in to place trades.');
      return;
    }

    if (targetReached) {
      alert(`Already stopped by ${targetReached === 'tp' ? 'Take Profit' : 'Stop Loss'}. Reset session to continue.`);
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
      addJournal(`Placing ${contractType} — $${stake.toFixed(2)}`, 'buy');
    } catch (error) {
      console.error('Manual Trader error:', error);
      addJournal(`Error: ${String(error)}`, 'loss');
    } finally {
      setIsTrading(false);
    }
  };

  /* ---- Auto-Trade loop ---- */
  useEffect(() => {
    if (!autoTrade || targetReached || !authorized) {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    const run = async () => {
      if (!autoTrade || targetReached || isTrading) return;
      await handleTrade(autoDirection);
      autoTimerRef.current = setTimeout(run, autoDelay * 1000);
    };

    addJournal(`Auto-Trade ON — every ${autoDelay}s on ${autoDirection}`, 'info');
    autoTimerRef.current = setTimeout(run, autoDelay * 1000);

    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrade, autoDirection, autoDelay, targetReached, authorized]);

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

  const buttonsDisabled = isTrading || !authorized || !!targetReached || autoTrade;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#0a0e27] overflow-hidden">
      {/* ============ TOP: MARKET SELECTOR + SESSION P/L ============ */}
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

          <div className={`px-3 py-1.5 rounded-lg border ${
            sessionPL > 0 ? 'bg-green-500/10 border-green-500/30' :
            sessionPL < 0 ? 'bg-red-500/10 border-red-500/30' :
            'bg-white/5 border-white/10'
          }`}>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider text-center">Session</div>
            <div className={`text-sm font-bold font-mono text-center ${
              sessionPL > 0 ? 'text-green-400' :
              sessionPL < 0 ? 'text-red-400' :
              'text-gray-400'
            }`}>
              {sessionPL >= 0 ? '+' : ''}{sessionPL.toFixed(2)}
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
      </div>

      {/* ============ BOTTOM: TRADE TICKET ============ */}
      <div className="bg-[#141832] rounded-t-2xl border-t border-white/10 px-4 pt-4 pb-6 max-h-[60vh] overflow-y-auto">

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

        {/* Stake */}
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

        {/* Quick chips */}
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

        {/* TP/SL Row */}
        <div className="bg-[#0a0e27] border border-white/10 rounded-lg mb-4 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={takeProfitEnabled}
                  onChange={(e) => { setTakeProfitEnabled(e.target.checked); if (!e.target.checked && !stopLossEnabled) resetSession(); }}
                  className="w-4 h-4 accent-teal-500"
                />
                <span className="text-xs text-white font-medium">Take Profit</span>
                {targetReached === 'tp' && (
                  <span className="ml-auto text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">🎯</span>
                )}
              </label>
              {takeProfitEnabled && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={takeProfitTarget}
                    onChange={(e) => setTakeProfitTarget(Math.max(1, Number(e.target.value) || 1))}
                    className="flex-1 bg-[#141832] border border-white/10 rounded-md px-2 py-1 text-white font-bold text-xs text-center outline-none"
                  />
                  <span className="text-[10px] text-gray-400">USD</span>
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={stopLossEnabled}
                  onChange={(e) => { setStopLossEnabled(e.target.checked); if (!e.target.checked && !takeProfitEnabled) resetSession(); }}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-xs text-white font-medium">Stop Loss</span>
                {targetReached === 'sl' && (
                  <span className="ml-auto text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">🛑</span>
                )}
              </label>
              {stopLossEnabled && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={stopLossTarget}
                    onChange={(e) => setStopLossTarget(Math.max(1, Number(e.target.value) || 1))}
                    className="flex-1 bg-[#141832] border border-white/10 rounded-md px-2 py-1 text-white font-bold text-xs text-center outline-none"
                  />
                  <span className="text-[10px] text-gray-400">USD</span>
                </div>
              )}
            </div>
          </div>

          {(takeProfitEnabled || stopLossEnabled) && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
              <span className="text-[10px] text-gray-500">Session P/L:</span>
              <span className={`text-xs font-bold ${sessionPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {sessionPL >= 0 ? '+' : ''}{sessionPL.toFixed(2)} USD
              </span>
              {targetReached && (
                <button
                  onClick={resetSession}
                  className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* Auto-Trade Row */}
        <div className="bg-[#0a0e27] border border-white/10 rounded-lg mb-4 p-3">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={autoTrade}
              onChange={(e) => setAutoTrade(e.target.checked)}
              disabled={!!targetReached}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-xs text-white font-medium">Auto-Trade</span>
            {autoTrade && (
              <span className="ml-auto text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                ● Running
              </span>
            )}
          </label>

          {autoTrade && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-gray-400 w-16">Side:</span>
                <button
                  onClick={() => setAutoDirection('primary')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                    autoDirection === 'primary' ? 'bg-teal-500 text-white' : 'bg-[#141832] text-gray-400'
                  }`}
                >
                  {primaryLabel}
                </button>
                <button
                  onClick={() => setAutoDirection('secondary')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                    autoDirection === 'secondary' ? 'bg-red-500 text-white' : 'bg-[#141832] text-gray-400'
                  }`}
                >
                  {secondaryLabel}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-16">Every:</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={autoDelay}
                  onChange={(e) => setAutoDelay(Math.max(1, Math.min(60, Number(e.target.value) || 3)))}
                  className="w-16 bg-[#141832] border border-white/10 rounded-md px-2 py-1 text-white font-bold text-xs text-center outline-none"
                />
                <span className="text-[10px] text-gray-400">seconds</span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => handleTrade('primary')}
            disabled={buttonsDisabled}
            className={`rounded-xl overflow-hidden transition ${buttonsDisabled ? 'opacity-50' : ''}`}
          >
            <div className="bg-teal-500 text-white py-4 flex items-center justify-center gap-2">
              <span className="font-bold text-lg">{primaryLabel}</span>
            </div>
            <div className="bg-teal-600 text-white py-2 text-center text-xs flex items-center justify-between px-4">
              <span>Payout</span>
              <span className="font-bold">
                {primaryPayout !== null ? `${primaryPayout.toFixed(2)}` : '...'}
              </span>
            </div>
          </button>

          <button
            onClick={() => handleTrade('secondary')}
            disabled={buttonsDisabled}
            className={`rounded-xl overflow-hidden transition ${buttonsDisabled ? 'opacity-50' : ''}`}
          >
            <div className="bg-red-500 text-white py-4 flex items-center justify-center gap-2">
              <span className="font-bold text-lg">{secondaryLabel}</span>
            </div>
            <div className="bg-red-600 text-white py-2 text-center text-xs flex items-center justify-between px-4">
              <span>Payout</span>
              <span className="font-bold">
                {secondaryPayout !== null ? `${secondaryPayout.toFixed(2)}` : '...'}
              </span>
            </div>
          </button>
        </div>

        {/* Target reached banner */}
        {targetReached && (
          <div className={`rounded-lg p-3 text-center mb-3 ${
            targetReached === 'tp' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <span className={`text-xs font-medium ${
              targetReached === 'tp' ? 'text-green-400' : 'text-red-400'
            }`}>
              {targetReached === 'tp' ? '🎯 Take Profit hit!' : '🛑 Stop Loss hit!'} Tap Reset to continue.
            </span>
          </div>
        )}

        {/* Journal Toggle */}
        <button
          onClick={() => setShowJournal(!showJournal)}
          className="w-full text-xs py-2 text-gray-400 hover:text-white border border-white/10 rounded-lg transition"
        >
          {showJournal ? '▲ Hide Journal' : `▼ Show Journal (${journal.length})`}
        </button>

        {/* Journal Panel */}
        {showJournal && (
          <div className="mt-3 max-h-48 overflow-y-auto bg-[#0a0e27] border border-white/10 rounded-lg p-3">
            {journal.length === 0 ? (
              <div className="text-center text-gray-500 text-xs py-4">Journal empty</div>
            ) : (
              journal.map((j, i) => (
                <div key={i} className="border-b border-white/5 py-1.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 font-mono">{j.time}</span>
                    <span className={`text-[11px] ${
                      j.kind === 'profit' ? 'text-green-400' :
                      j.kind === 'loss' ? 'text-red-400' :
                      j.kind === 'buy' ? 'text-blue-400' :
                      'text-gray-400'
                    }`}>
                      {j.text}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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