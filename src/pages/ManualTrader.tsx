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
  | 'vanillas'
  | 'turbos'
  | 'multipliers';

const GROWTH_RATES = [1, 2, 3, 4, 5];

export default function ManualTrader() {
  const [marketName, setMarketName] = useState('Volatility 100 (1s) Index');
  const [tradeType, setTradeType] = useState<TradeTypeKey>('accumulators');
  const [growthRate, setGrowthRate] = useState(3);
  const [stake, setStake] = useState(10);
  const [takeProfit, setTakeProfit] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  /* Paper-trade fallback (works offline / not logged in) */
  const { placeTrade: placePaperTrade } = useTradeStore();

  /* Real Deriv trade (requires login) */
  const { authorized, placeTrade: placeRealTrade, openTrades } = useAuthWs();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const symbol = MARKET_MAP[marketName];

  /* ---------- Create chart once ---------- */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f5f5f5' },
        horzLines: { color: '#f5f5f5' },
      },
      rightPriceScale: { borderColor: '#e5e5e5' },
      timeScale: { borderColor: '#e5e5e5', timeVisible: true },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#333333',
      topColor: 'rgba(38,176,163,0.25)',
      bottomColor: 'rgba(38,176,163,0.02)',
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
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    return () => {
      closed = true;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ forget_all: 'ticks' }));
        }
      } catch {
        /* ignore */
      }
      ws.close();
    };
  }, [symbol]);

  /* ---------- Buy ---------- */
  const handleBuy = () => {
    /* If authenticated → place a REAL Deriv demo trade */
    if (authorized) {
      placeRealTrade({
        symbol,
        contractType: 'CALL',
        stake,
        duration: 5,
        durationUnit: 't',
      });
      console.log('[Manual Trader] Real trade sent:', {
        symbol,
        contractType: 'CALL',
        stake,
      });
      return;
    }

    /* Otherwise fallback to paper trade */
    const id = placePaperTrade({
      market: marketName,
      symbol,
      type: 'rise_fall',
      direction: 'Rise',
      stake,
      ticks: 5,
      entryPrice: lastPrice ?? undefined,
    });

    if (id) {
      alert(
        `Paper trade placed (not logged in).\n${marketName}\nStake: $${stake.toFixed(
          2
        )}`
      );
    }
  };

  /* Count of currently open real trades */
  const openCount = openTrades.filter((t) => !t.is_sold).length;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* ============ CHART (left) ============ */}
      <div className="flex-1 flex flex-col bg-white relative min-h-[400px]">
        {/* Market dropdown overlay */}
        <div className="absolute top-4 left-4 z-10 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 flex items-center gap-3">
          <div>
            <select
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              className="font-semibold text-navy bg-transparent outline-none cursor-pointer text-sm"
            >
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {lastPrice !== null ? lastPrice.toFixed(2) : '—'}
              <span className="text-gray-400">
                {connected ? 'live' : 'connecting'}
              </span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      {/* ============ TRADE TICKET (right) ============ */}
      <aside className="w-full md:w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
        <div className="p-4">
          <div className="text-xs text-blue-600 underline mb-3 cursor-pointer">
            Learn about this trade type
          </div>

          <button
            onClick={() => setShowTypePicker(true)}
            className="w-full flex items-center gap-2 px-3 py-3 bg-gray-50 border border-gray-200 rounded-md mb-4 hover:bg-gray-100 transition"
          >
            <span className="text-gray-500">‹</span>
            <span className="font-semibold text-navy text-sm">
              {tradeType === 'accumulators'
                ? 'Accumulators'
                : tradeType === 'vanillas'
                ? 'Vanillas'
                : tradeType === 'turbos'
                ? 'Turbos'
                : 'Multipliers'}
            </span>
          </button>

          {/* Live trade status */}
          {openCount > 0 && (
            <div className="mb-4 bg-teal-50 border border-teal-200 rounded-md p-3">
              <div className="text-xs font-semibold text-teal-700">
                {openCount} live trade{openCount !== 1 ? 's' : ''} open
              </div>
              <div className="text-[10px] text-teal-600 mt-1">
                Tracking on the WebSocket
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Growth rate</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {GROWTH_RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => setGrowthRate(r)}
                  className={`py-2 text-sm font-medium rounded-md transition ${
                    growthRate === r
                      ? 'bg-gray-200 text-navy font-semibold'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">Stake</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStake((s) => Math.max(1, s - 1))}
                className="w-9 h-9 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-center text-sm font-semibold text-navy outline-none"
              />
              <button
                onClick={() => setStake((s) => s + 1)}
                className="w-9 h-9 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
              <select className="border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-600 outline-none cursor-pointer">
                <option>USD</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 mb-4 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={takeProfit}
              onChange={(e) => setTakeProfit(e.target.checked)}
              className="w-4 h-4 accent-teal-500"
            />
            Take profit
          </label>

          <div className="grid grid-cols-2 gap-3 text-xs mb-4 py-3 border-t border-b border-gray-100">
            <div>
              <div className="text-gray-500">Max. payout</div>
              <div className="font-semibold text-navy mt-1">
                6,000.00 USD
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500">Max. ticks</div>
              <div className="font-semibold text-navy mt-1">85 ticks</div>
            </div>
          </div>

          <button
            onClick={handleBuy}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 rounded-md flex items-center justify-center gap-3 transition"
          >
            <span className="text-lg">📈</span>
            <span>{authorized ? 'Buy (Demo)' : 'Buy'}</span>
          </button>

          {!authorized && (
            <div className="mt-2 text-[10px] text-gray-400 text-center">
              Not logged in — paper trade mode
            </div>
          )}
        </div>
      </aside>

      {/* ============ TRADE TYPE PICKER MODAL ============ */}
      {showTypePicker && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTypePicker(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-navy">Trade types</h2>
              <input
                type="text"
                placeholder="🔍  Search"
                className="w-full mt-3 border border-gray-200 rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="border-r border-gray-100 py-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'multipliers', label: 'Multipliers' },
                  { id: 'options', label: 'Options', new: true },
                  { id: 'accumulators', label: 'Accumulators', new: true },
                ].map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>{c.label}</span>
                    {c.new && (
                      <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded">
                        NEW
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="md:col-span-2 p-4 space-y-3">
                <div className="text-xs text-gray-500">
                  Learn more about trade types ›
                </div>

                <TypeSection title="Accumulators" isNew>
                  <TypeCard
                    label="Accumulators"
                    icon="📈"
                    onClick={() => {
                      setTradeType('accumulators');
                      setShowTypePicker(false);
                    }}
                  />
                </TypeSection>

                <TypeSection title="Vanillas" isNew>
                  <TypeCard
                    label="Call/Put"
                    icon="📊"
                    onClick={() => {
                      setTradeType('vanillas');
                      setShowTypePicker(false);
                    }}
                  />
                </TypeSection>

                <TypeSection title="Turbos" isNew>
                  <TypeCard
                    label="Turbos"
                    icon="📉"
                    onClick={() => {
                      setTradeType('turbos');
                      setShowTypePicker(false);
                    }}
                  />
                </TypeSection>

                <TypeSection title="Multipliers">
                  <TypeCard
                    label="Multipliers"
                    icon="✖️"
                    onClick={() => {
                      setTradeType('multipliers');
                      setShowTypePicker(false);
                    }}
                  />
                </TypeSection>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Small components ---------- */
function TypeSection({
  title,
  isNew,
  children,
}: {
  title: string;
  isNew?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
        {title}
        {isNew && (
          <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded">
            NEW
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function TypeCard({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-left transition"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium text-navy">{label}</span>
    </button>
  );
}