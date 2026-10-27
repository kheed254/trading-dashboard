import { useEffect, useMemo, useRef, useState } from 'react';
import { useDigitStream, useMarkets } from '../lib/deriv';
import { computeDigitStats } from '../lib/digitStats';
import { useAuthWs } from '../lib/auth-ws-context';

/* ---------- Config ---------- */

/* Show percentages without trailing zeros: 8.10 -> 8.1, 10.00 -> 10, 0.00 -> 0 */
const fmtPct = (n: number) => `${parseFloat(n.toFixed(2))}%`;

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
  const [showMore, setShowMore] = useState(false);

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

  const { groups: marketGroups, symbolFor } = useMarkets();
  const symbol = (symbolFor(marketName) ?? 'R_100') as any;

  /* ---- Live stream ---- */
  const { price, currentDigit, digits, connected } = useDigitStream(symbol, 1000);

  /* ---- Price change vs previous tick ---- */
  const prevPriceRef = useRef<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);

  useEffect(() => {
    if (price === null) {
      prevPriceRef.current = null;
      setPriceChange(null);
      return;
    }
    if (prevPriceRef.current !== null) {
      setPriceChange(price - prevPriceRef.current);
    }
    prevPriceRef.current = price;
  }, [price]);

  /* ---- Digit stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);

  /* ---- Most / least appearing digit for circle colours ---- */
  const { highestDigit, lowestDigit } = useMemo(() => {
    if (digits.length < 20) return { highestDigit: -1, lowestDigit: -1 };
    let hi = digitStats[0];
    let lo = digitStats[0];
    digitStats.forEach((d) => {
      if (d.pct > hi.pct) hi = d;
      if (d.pct < lo.pct) lo = d;
    });
    if (hi.pct === lo.pct) return { highestDigit: -1, lowestDigit: -1 };
    return { highestDigit: hi.digit, lowestDigit: lo.digit };
  }, [digitStats, digits.length]);

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

  /* ---- Subscribe to live payouts (increased delay for socket readiness) ---- */
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
    }, 2000);

    const secondaryTimeout = setTimeout(() => {
      subscribeProposal(
        { symbol, contractType: secondary, stake, duration, durationUnit: 't', barrier },
        (payout) => setSecondaryPayout(payout)
      );
    }, 2500);

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

  const changePct =
    price !== null && priceChange !== null && price !== 0
      ? (priceChange / (price - priceChange)) * 100
      : null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f4f3f1] pb-8">
      <div className="max-w-xl mx-auto px-3 pt-2 space-y-2 sm:pt-3 sm:space-y-4">

        {/* ============ MARKET CARD ============ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-2 sm:py-3 flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">100</span>
          </div>
          <div className="flex-1 min-w-0">
            <select
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              className="font-bold text-gray-900 bg-transparent outline-none cursor-pointer text-base w-full truncate"
            >
              {marketGroups.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((m) => (
                    <option key={m.symbol} value={m.name} className="bg-white text-gray-900">{m.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              {price !== null ? (
                <>
                  <span>{price.toFixed(2)}</span>
                  {priceChange !== null && changePct !== null && (
                    <>
                      <span>
                        {priceChange >= 0 ? '+' : '-'} {Math.abs(priceChange).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
                      </span>
                      <span className={priceChange >= 0 ? 'text-teal-500' : 'text-red-500'}>
                        {priceChange >= 0 ? '▲' : '▼'}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span>{connected ? 'live' : 'connecting…'}</span>
              )}
            </div>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border flex-shrink-0 ${
            sessionPL > 0 ? 'bg-green-50 border-green-300' :
            sessionPL < 0 ? 'bg-red-50 border-red-300' :
            'bg-gray-50 border-gray-200'
          }`}>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider text-center leading-none mb-0.5">
              Session
            </div>
            <div className={`text-sm font-bold font-mono text-center leading-none ${
              sessionPL > 0 ? 'text-green-600' :
              sessionPL < 0 ? 'text-red-600' :
              'text-gray-500'
            }`}>
              {sessionPL >= 0 ? '+' : ''}{sessionPL.toFixed(2)}
            </div>
          </div>
        </div>

        {/* ============ DIGIT CIRCLES ============ */}
        <div className="px-1">
          <div className="grid grid-cols-5 gap-x-2 gap-y-2 mb-2">
            {digitStats.slice(0, 5).map((d) => (
              <DigitGauge
                key={d.digit}
                digit={d.digit}
                pct={d.pct}
                isCurrent={d.digit === currentDigit}
                kind={d.digit === highestDigit ? 'high' : d.digit === lowestDigit ? 'low' : 'normal'}
              />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-x-2 gap-y-2">
            {digitStats.slice(5, 10).map((d) => (
              <DigitGauge
                key={d.digit}
                digit={d.digit}
                pct={d.pct}
                isCurrent={d.digit === currentDigit}
                kind={d.digit === highestDigit ? 'high' : d.digit === lowestDigit ? 'low' : 'normal'}
              />
            ))}
          </div>
        </div>

        {/* ============ TRADE TICKET ============ */}
        <div className="bg-[#eeedeb] rounded-xl border border-gray-200 p-2 sm:p-3 space-y-2 sm:space-y-3">

          {/* Trade type + Digit */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTypePicker(true)}
              className="flex-1 flex items-center gap-3 px-3 py-2 sm:py-3 bg-white border border-gray-200 rounded-lg text-left"
            >
              <span className="text-lg">
                {tradeType === 'evenodd' ? '🎯' :
                 tradeType === 'matchesdiffers' ? '🔢' :
                 tradeType === 'overunder' ? '📊' :
                 tradeType === 'callput' ? '📈' :
                 tradeType === 'higherlower' ? '↕️' : '👆'}
              </span>
              <span className="font-bold text-gray-900 text-sm flex-1">
                {TRADE_TYPE_LABELS[tradeType]}
              </span>
              <span className="text-gray-500 text-lg">›</span>
            </button>

            {(tradeType === 'matchesdiffers' || tradeType === 'overunder') && (
              <div className="flex items-center gap-1 px-3 py-2 sm:py-3 bg-white border border-gray-200 rounded-lg">
                <span className="text-xs text-gray-500">Digit:</span>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={selectedDigit}
                  onChange={(e) => setSelectedDigit(Math.max(0, Math.min(9, Number(e.target.value))))}
                  className="w-8 bg-transparent text-gray-900 font-bold text-center outline-none"
                />
              </div>
            )}
          </div>

          {/* Stake row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustStake(-1)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white border border-gray-200 text-gray-800 text-xl font-bold hover:bg-gray-50 transition flex items-center justify-center"
            >
              −
            </button>
            <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg py-1.5 sm:py-2.5">
              <input
                type="number"
                step="0.5"
                min="0.35"
                value={stake}
                onChange={(e) => setStake(Math.max(0.35, Number(e.target.value) || 0.35))}
                className="bg-transparent text-gray-900 font-bold text-xl sm:text-2xl text-center outline-none w-28"
              />
              <span className="text-gray-500 text-sm ml-2">USD</span>
            </div>
            <button
              onClick={() => adjustStake(1)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white border border-gray-200 text-gray-800 text-xl font-bold hover:bg-gray-50 transition flex items-center justify-center"
            >
              +
            </button>
          </div>

          {/* Quick chips */}
          <div className="flex gap-1.5">
            {[1, 5, 10, 25, 50].map((amount) => (
              <button
                key={amount}
                onClick={() => setStake(amount)}
                className={`flex-1 py-1 sm:py-1.5 rounded text-xs font-semibold transition ${
                  stake === amount
                    ? 'bg-[#4db3b0] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleTrade('primary')}
              disabled={buttonsDisabled}
              className={`rounded-lg overflow-hidden transition ${buttonsDisabled ? 'opacity-50' : 'hover:opacity-90'}`}
            >
              <div className="bg-[#4db3b0] text-white py-3 sm:py-4 flex items-center justify-center gap-2">
                <span className="font-bold text-lg">{primaryLabel}</span>
              </div>
              <div className="bg-[#3b9a97] text-white py-1.5 sm:py-2 text-xs flex items-center justify-between px-4">
                <span>Payout</span>
                <span className="font-bold">
                  {primaryPayout !== null ? `${primaryPayout.toFixed(2)} USD` : '...'}
                </span>
              </div>
            </button>

            <button
              onClick={() => handleTrade('secondary')}
              disabled={buttonsDisabled}
              className={`rounded-lg overflow-hidden transition ${buttonsDisabled ? 'opacity-50' : 'hover:opacity-90'}`}
            >
              <div className="bg-[#ff1f1f] text-white py-3 sm:py-4 flex items-center justify-center gap-2">
                <span className="font-bold text-lg">{secondaryLabel}</span>
              </div>
              <div className="bg-[#d94a3d] text-white py-1.5 sm:py-2 text-xs flex items-center justify-between px-4">
                <span>Payout</span>
                <span className="font-bold">
                  {secondaryPayout !== null ? `${secondaryPayout.toFixed(2)} USD` : '...'}
                </span>
              </div>
            </button>
          </div>

          {/* Target reached banner */}
          {targetReached && (
            <div className={`rounded-lg p-3 text-center ${
              targetReached === 'tp' ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'
            }`}>
              <span className={`text-xs font-medium ${
                targetReached === 'tp' ? 'text-green-700' : 'text-red-700'
              }`}>
                {targetReached === 'tp' ? '🎯 Take Profit hit!' : '🛑 Stop Loss hit!'} Tap Reset to continue.
              </span>
            </div>
          )}

          {/* More options (folded away so the phone screen fits without scrolling) */}
          <button
            onClick={() => setShowMore((v) => !v)}
            className="w-full text-xs py-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg transition"
          >
            {showMore ? '▲ Hide options' : '▼ More options · Take Profit · Stop Loss · Auto-Trade · Journal'}
            {!showMore && autoTrade ? '  ● Auto-Trade ON' : ''}
          </button>

          {showMore && (
            <div className="space-y-2 sm:space-y-3">
          {/* TP/SL Row */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={takeProfitEnabled}
                    onChange={(e) => { setTakeProfitEnabled(e.target.checked); if (!e.target.checked && !stopLossEnabled) resetSession(); }}
                    className="w-4 h-4 accent-teal-500"
                  />
                  <span className="text-xs text-gray-800 font-semibold">Take Profit</span>
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
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-900 font-bold text-xs text-center outline-none"
                    />
                    <span className="text-[10px] text-gray-500">USD</span>
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
                  <span className="text-xs text-gray-800 font-semibold">Stop Loss</span>
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
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-900 font-bold text-xs text-center outline-none"
                    />
                    <span className="text-[10px] text-gray-500">USD</span>
                  </div>
                )}
              </div>
            </div>

            {(takeProfitEnabled || stopLossEnabled) && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <span className="text-[10px] text-gray-500">Session P/L:</span>
                <span className={`text-xs font-bold ${sessionPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {sessionPL >= 0 ? '+' : ''}{sessionPL.toFixed(2)} USD
                </span>
                {targetReached && (
                  <button
                    onClick={resetSession}
                    className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Auto-Trade Row */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoTrade}
                onChange={(e) => setAutoTrade(e.target.checked)}
                disabled={!!targetReached}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-xs text-gray-800 font-semibold">Auto-Trade</span>
              {autoTrade && (
                <span className="ml-auto text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  ● Running
                </span>
              )}
            </label>

            {autoTrade && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-gray-500 w-16">Side:</span>
                  <button
                    onClick={() => setAutoDirection('primary')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                      autoDirection === 'primary' ? 'bg-[#4db3b0] text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {primaryLabel}
                  </button>
                  <button
                    onClick={() => setAutoDirection('secondary')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                      autoDirection === 'secondary' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {secondaryLabel}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-16">Every:</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={autoDelay}
                    onChange={(e) => setAutoDelay(Math.max(1, Math.min(60, Number(e.target.value) || 3)))}
                    className="w-16 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-900 font-bold text-xs text-center outline-none"
                  />
                  <span className="text-[10px] text-gray-500">seconds</span>
                </div>
              </div>
            )}
          </div>

          {/* Journal Toggle */}
          <button
            onClick={() => setShowJournal(!showJournal)}
            className="w-full text-xs py-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg transition"
          >
            {showJournal ? '▲ Hide Journal' : `▼ Show Journal (${journal.length})`}
          </button>

          {/* Journal Panel */}
          {showJournal && (
            <div className="max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg p-3">
              {journal.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-4">Journal empty</div>
              ) : (
                journal.map((j, i) => (
                  <div key={i} className="border-b border-gray-100 py-1.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 font-mono">{j.time}</span>
                      <span className={`text-[11px] ${
                        j.kind === 'profit' ? 'text-green-600' :
                        j.kind === 'loss' ? 'text-red-600' :
                        j.kind === 'buy' ? 'text-blue-600' :
                        'text-gray-500'
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
          )}
        </div>
      </div>

      {/* ============ TRADE TYPE PICKER ============ */}
      {showTypePicker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
          onClick={() => setShowTypePicker(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-2xl max-h-[80vh] overflow-auto border-t border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-900">Trade types</h2>
              <button onClick={() => setShowTypePicker(false)} className="text-gray-500 text-2xl leading-none">×</button>
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

/* ---------- Digit Gauge (same look as Bulk Trader) ---------- */
function DigitGauge({
  digit,
  pct,
  isCurrent,
  kind,
}: {
  digit: number;
  pct: number;
  isCurrent: boolean;
  kind: 'high' | 'low' | 'normal';
}) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * C;

  const wedgeColor = kind === 'high' ? '#14b8a6' : kind === 'low' ? '#ef4444' : '#b4b8be';
  const ringColor = kind === 'high' ? '#14b8a6' : kind === 'low' ? '#ef4444' : '#d9dce0';

  return (
    <div className="relative flex flex-col items-center">
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
      <div className="relative w-full max-w-[52px] sm:max-w-[72px] aspect-square rounded-full">
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
          <span className="text-sm sm:text-base font-bold text-navy">{digit}</span>
          <span className="text-[9px] sm:text-[10px] font-bold text-navy">{fmtPct(pct)}</span>
        </div>
      </div>
      <div
        className={`h-3.5 sm:h-4 mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide ${
          kind === 'high' ? 'text-teal-600' : kind === 'low' ? 'text-red-500' : ''
        }`}
      >
        {kind === 'high' ? 'Most' : kind === 'low' ? 'Least' : ''}
      </div>
    </div>
  );
}

/* ---------- Type Card ---------- */
function TypeCard({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-semibold text-gray-900">{label}</span>
    </button>
  );
}