import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTradeStore } from '../lib/trading/store';
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

const DERIV_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

type TradeTypeKey =
  | 'accumulators'
  | 'callput'
  | 'turbos'
  | 'multipliers'
  | 'higherlower'
  | 'touchnotouch'
  | 'matchesdiffers'
  | 'evenodd'
  | 'overunder';

const GROWTH_RATES = [1, 2, 3, 4, 5];

/* Map trade type to Deriv API contract types */
function resolveContractType(
  tradeType: TradeTypeKey,
  direction: 'Rise' | 'Fall'
): string {
  switch (tradeType) {
    case 'callput': return direction === 'Rise' ? 'CALL' : 'PUT';
    case 'higherlower': return direction === 'Rise' ? 'CALLE' : 'PUTE';
    case 'touchnotouch': return 'ONETOUCH';
    case 'matchesdiffers': return 'DIGITDIFF';
    case 'evenodd': return direction === 'Rise' ? 'DIGITEVEN' : 'DIGITODD';
    case 'overunder': return direction === 'Rise' ? 'DIGITOVER' : 'DIGITUNDER';
    default: return 'CALL';
  }
}

export default function ManualTrader() {
  const [marketName, setMarketName] = useState('Volatility 100 (1s) Index');
  const [tradeType, setTradeType] = useState<TradeTypeKey>('callput');
  const [direction, setDirection] = useState<'Rise' | 'Fall'>('Rise');
  const [growthRate, setGrowthRate] = useState(3);
  const [stake, setStake] = useState(10);
  const [takeProfit, setTakeProfit] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<'all' | 'multipliers' | 'options' | 'accumulators'>('all');

  const { placeTrade: placePaperTrade } = useTradeStore();
  const { authorized, placeTrade: placeRealTrade, openTrades } = useAuthWs();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const symbol = MARKET_MAP[marketName];

  /* ---------- Create chart once (dark theme) ---------- */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0b1c3f' }, // Dark navy matching your header
        textColor: '#a0aec0',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#14b8a6',
      topColor: 'rgba(20, 184, 166, 0.3)',
      bottomColor: 'rgba(20, 184, 166, 0.02)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  /* ---------- Stream ticks ---------- */
  useEffect(() => {
    const ws = new WebSocket(DERIV_WS_URL);
    let closed = false;

    setConnected(false);
    setLastPrice(null);

    ws.onopen = () => {
      setConnected(true);
      const end = Math.floor(Date.now() / 1000);
      const start = end - 60 * 300;

      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 300,
          end: 'latest',
          start,
          style: 'ticks',
          subscribe: 1,
        })
      );
    };

    ws.onmessage = (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data);

        if (data.msg_type === 'history' && data.history) {
          const times: number[] = data.history.times;
          const prices: number[] = data.history.prices;
          const points = times.map((t, i) => ({
            time: t as UTCTimestamp,
            value: Number(prices[i]),
          }));
          seriesRef.current?.setData(points);
          if (points.length > 0) {
            setLastPrice(points[points.length - 1].value);
          }
          chartRef.current?.timeScale().fitContent();
        }

        if (data.msg_type === 'tick' && data.tick) {
          const p = Number(data.tick.quote);
          setLastPrice(p);
          seriesRef.current?.update({
            time: data.tick.epoch as UTCTimestamp,
            value: p,
          });
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    return () => {
      closed = true;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ forget_all: 'ticks' }));
        }
      } catch { /* ignore */ }
      ws.close();
    };
  }, [symbol]);

  /* ---------- Buy ---------- */
  const handleBuy = () => {
    const contractType = resolveContractType(tradeType, direction);
    // Use 2 ticks for CALL/PUT, 1 tick for digits
    const duration = ['DIGITEVEN', 'DIGITODD', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER'].includes(contractType) ? 1 : 2;

    if (authorized) {
      placeRealTrade({
        symbol,
        contractType,
        stake,
        duration,
        durationUnit: 't',
      });
      console.log('[Manual Trader] Real trade sent:', { symbol, contractType, stake });
      return;
    }

    // Paper trade fallback
    const id = placePaperTrade({
      market: marketName,
      symbol,
      type: 'rise_fall',
      direction: direction,
      stake,
      ticks: duration,
      entryPrice: lastPrice ?? undefined,
    });

    if (id) {
      alert(`Paper trade placed (not logged in).\n${marketName}\nStake: $${stake.toFixed(2)}`);
    }
  };

  const openCount = openTrades.filter((t) => !t.is_sold).length;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden bg-[#0b1c3f]">
      {/* ============ CHART (left) ============ */}
      <div className="flex-1 flex flex-col relative min-h-[400px]">
        {/* Market dropdown overlay */}
        <div className="absolute top-4 left-4 z-10 bg-[#0b1c3f] border border-white/10 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <div>
            <select
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              className="font-semibold text-white bg-transparent outline-none cursor-pointer text-sm"
            >
              {MARKETS.map((m) => (
                <option key={m} value={m} className="bg-[#0b1c3f]">{m}</option>
              ))}
            </select>
            <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              {lastPrice !== null ? lastPrice.toFixed(2) : '—'}
              <span className="text-gray-500">{connected ? 'live' : 'connecting'}</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      {/* ============ TRADE TICKET (right) ============ */}
      <aside className="w-full md:w-80 shrink-0 border-l border-white/10 bg-[#0b1c3f] flex flex-col overflow-y-auto">
        <div className="p-4">
          <div className="text-xs text-teal-400 underline mb-3 cursor-pointer">
            Learn about this trade type
          </div>

          <button
            onClick={() => setShowTypePicker(true)}
            className="w-full flex items-center justify-between px-3 py-3 bg-white/5 border border-white/10 rounded-md mb-4 hover:bg-white/10 transition"
          >
            <span className="font-semibold text-white text-sm capitalize">
              {tradeType === 'callput' ? 'Call/Put' :
               tradeType === 'higherlower' ? 'Higher/Lower' :
               tradeType === 'touchnotouch' ? 'Touch/No Touch' :
               tradeType === 'matchesdiffers' ? 'Matches/Differs' :
               tradeType === 'evenodd' ? 'Even/Odd' :
               tradeType === 'overunder' ? 'Over/Under' :
               tradeType.charAt(0).toUpperCase() + tradeType.slice(1)}
            </span>
            <span className="text-gray-400">›</span>
          </button>

          {/* Direction toggle for Rise/Fall, Even/Odd, Over/Under */}
          {(tradeType === 'callput' || tradeType === 'evenodd' || tradeType === 'overunder' || tradeType === 'higherlower') && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDirection('Rise')}
                className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition ${
                  direction === 'Rise' ? 'bg-teal-500 text-white' : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {tradeType === 'evenodd' ? 'Even' : tradeType === 'overunder' ? 'Over' : 'Rise'}
              </button>
              <button
                onClick={() => setDirection('Fall')}
                className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition ${
                  direction === 'Fall' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {tradeType === 'evenodd' ? 'Odd' : tradeType === 'overunder' ? 'Under' : 'Fall'}
              </button>
            </div>
          )}

          {/* Live trade status */}
          {openCount > 0 && (
            <div className="mb-4 bg-teal-500/10 border border-teal-500/30 rounded-md p-3">
              <div className="text-xs font-semibold text-teal-400">
                {openCount} live trade{openCount !== 1 ? 's' : ''} open
              </div>
            </div>
          )}

          {/* Growth rate (only for accumulators/multipliers) */}
          {(tradeType === 'accumulators' || tradeType === 'multipliers') && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Growth rate</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {GROWTH_RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setGrowthRate(r)}
                    className={`py-2 text-sm font-medium rounded-md transition ${
                      growthRate === r
                        ? 'bg-teal-500 text-white font-semibold'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stake */}
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-2">Stake</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStake((s) => Math.max(1, s - 1))}
                className="w-9 h-9 rounded-md border border-white/10 text-gray-400 hover:bg-white/5"
              >
                −
              </button>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-center text-sm font-semibold text-white outline-none"
              />
              <button
                onClick={() => setStake((s) => s + 1)}
                className="w-9 h-9 rounded-md border border-white/10 text-gray-400 hover:bg-white/5"
              >
                +
              </button>
              <select className="bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm text-gray-300 outline-none cursor-pointer">
                <option className="bg-[#0b1c3f]">USD</option>
              </select>
            </div>
          </div>

          {/* Take Profit */}
          <label className="flex items-center gap-2 mb-4 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={takeProfit}
              onChange={(e) => setTakeProfit(e.target.checked)}
              className="w-4 h-4 accent-teal-500"
            />
            Take profit
          </label>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-xs mb-4 py-3 border-t border-b border-white/10">
            <div>
              <div className="text-gray-500">Max. payout</div>
              <div className="font-semibold text-white mt-1">6,000.00 USD</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500">Max. ticks</div>
              <div className="font-semibold text-white mt-1">85 ticks</div>
            </div>
          </div>

          {/* Buy Button */}
          <button
            onClick={handleBuy}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 rounded-md flex items-center justify-center gap-3 transition"
          >
            <span className="text-lg">📈</span>
            <span>{authorized ? 'Buy (Demo)' : 'Buy'}</span>
          </button>

          {!authorized && (
            <div className="mt-2 text-[10px] text-gray-500 text-center">
              Not logged in — paper trade mode
            </div>
          )}
        </div>
      </aside>

      {/* ============ TRADE TYPE PICKER MODAL (Dark Bottom Sheet) ============ */}
      {showTypePicker && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50"
          onClick={() => setShowTypePicker(false)}
        >
          <div
            className="bg-[#0b1c3f] rounded-t-2xl md:rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-auto border-t border-white/10 md:border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#0b1c3f] p-5 border-b border-white/10 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Trade types</h2>
                <button onClick={() => setShowTypePicker(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
              <div className="mt-4 text-xs text-gray-500 border border-white/10 rounded-md px-3 py-2.5">
                Learn more about trade types ›
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4">
              {/* Category sidebar */}
              <div className="hidden md:block border-r border-white/10 py-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'multipliers', label: 'Multipliers' },
                  { id: 'options', label: 'Options', isNew: true },
                  { id: 'accumulators', label: 'Accumulators', isNew: true },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setPickerCategory(c.id as any)}
                    className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 transition ${
                      pickerCategory === c.id ? 'bg-white/10 text-teal-400' : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <span>{c.label}</span>
                    {c.isNew && (
                      <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded">NEW</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Trade Type Cards */}
              <div className="md:col-span-3 p-4 space-y-4">
                {(pickerCategory === 'all' || pickerCategory === 'accumulators') && (
                  <TypeSection title="Accumulators" isNew>
                    <TypeCard label="Accumulators" icon="📈" onClick={() => { setTradeType('accumulators'); setShowTypePicker(false); }} />
                  </TypeSection>
                )}

                {(pickerCategory === 'all' || pickerCategory === 'options') && (
                  <>
                    <TypeSection title="Vanillas" isNew>
                      <TypeCard label="Call/Put" icon="📊" onClick={() => { setTradeType('callput'); setShowTypePicker(false); }} />
                    </TypeSection>
                    <TypeSection title="Turbos" isNew>
                      <TypeCard label="Turbos" icon="📉" onClick={() => { setTradeType('turbos'); setShowTypePicker(false); }} />
                    </TypeSection>
                    <TypeSection title="Ups & Downs">
                      <TypeCard label="Higher/Lower" icon="↕️" onClick={() => { setTradeType('higherlower'); setShowTypePicker(false); }} />
                    </TypeSection>
                    <TypeSection title="Touch & No Touch">
                      <TypeCard label="Touch/No Touch" icon="👆" onClick={() => { setTradeType('touchnotouch'); setShowTypePicker(false); }} />
                    </TypeSection>
                    <TypeSection title="Digits">
                      <div className="grid grid-cols-1 gap-2">
                        <TypeCard label="Matches/Differs" icon="🔢" onClick={() => { setTradeType('matchesdiffers'); setShowTypePicker(false); }} />
                        <TypeCard label="Even/Odd" icon="➗" onClick={() => { setTradeType('evenodd'); setShowTypePicker(false); }} />
                        <TypeCard label="Over/Under" icon="📊" onClick={() => { setTradeType('overunder'); setShowTypePicker(false); }} />
                      </div>
                    </TypeSection>
                  </>
                )}

                {(pickerCategory === 'all' || pickerCategory === 'multipliers') && (
                  <TypeSection title="Multipliers">
                    <TypeCard label="Multipliers" icon="✖️" onClick={() => { setTradeType('multipliers'); setShowTypePicker(false); }} />
                  </TypeSection>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Small components ---------- */
function TypeSection({ title, isNew, children }: { title: string; isNew?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
        {title}
        {isNew && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded">NEW</span>}
      </div>
      {children}
    </div>
  );
}

function TypeCard({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-left transition"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium text-white">{label}</span>
    </button>
  );
}