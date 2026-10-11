import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

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

const TIMEFRAMES: { label: string; seconds: number }[] = [
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
];

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

/* ---------- Component ---------- */
export default function Charts() {
  const [marketName, setMarketName] = useState('Volatility 10 (1s) Index');
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

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
      timeScale: {
        borderColor: '#e5e5e5',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
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

  /* ---------- Stream candles ---------- */
  useEffect(() => {
    const ws = new WebSocket(DERIV_WS_URL);
    let closed = false;

    setConnected(false);
    setLastPrice(null);

    ws.onopen = () => {
      setConnected(true);
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 200,
          end: 'latest',
          style: 'candles',
          granularity: timeframe.seconds,
          subscribe: 1,
        })
      );
    };

    ws.onmessage = (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data);

        // Initial history
        if (data.msg_type === 'candles' && data.candles) {
          const points = data.candles.map((c: any) => ({
            time: Number(c.epoch) as UTCTimestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));
          seriesRef.current?.setData(points);
          if (points.length > 0) setLastPrice(points[points.length - 1].close);
          chartRef.current?.timeScale().fitContent();
        }

        // Live updates
        if (data.msg_type === 'ohlc' && data.ohlc) {
          const c = data.ohlc;
          const bar = {
            time: Number(c.open_time ?? c.epoch) as UTCTimestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          };
          seriesRef.current?.update(bar);
          setLastPrice(bar.close);
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
          ws.send(JSON.stringify({ forget_all: 'candles' }));
        }
      } catch {}
      ws.close();
    };
  }, [symbol, timeframe]);

  return (
    <main className="h-[calc(100vh-56px-48px)] md:h-[calc(100vh-56px)] flex flex-col bg-white overflow-hidden">
      {/* ============ TOOLBAR ============ */}
      <div className="px-3 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <select
          value={marketName}
          onChange={(e) => setMarketName(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 min-w-[200px]"
        >
          {MARKETS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                timeframe.label === tf.label
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-gray-500 font-mono tabular-nums">
            {lastPrice !== null ? lastPrice.toFixed(4) : '—'}
          </span>
          <span className="text-gray-400 text-xs">live</span>
        </div>
      </div>

      {/* ============ CHART ============ */}
      <div ref={chartContainerRef} className="flex-1 w-full" />
    </main>
  );
}