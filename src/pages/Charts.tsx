import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';

/* ---------- Config ---------- */
const MARKET_MAP: Record<string, string> = {
  'Bull Market Index': 'BOOM1000',
  'Bear Market Index': 'CRASH1000',
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
  'Volatility 100 Index': 'R_100',
};

const MARKETS = Object.keys(MARKET_MAP);

const TIMEFRAMES: { label: string; granularity: number }[] = [
  { label: '1m', granularity: 60 },
  { label: '5m', granularity: 300 },
  { label: '15m', granularity: 900 },
  { label: '1h', granularity: 3600 },
  { label: '1d', granularity: 86400 },
];

const DERIV_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

export default function Charts() {
  const [marketName, setMarketName] = useState('Bull Market Index');
  const [tfIndex, setTfIndex] = useState(0); // 1m default
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const currentCandleRef = useRef<Candle | null>(null);

  const symbol = MARKET_MAP[marketName];
  const granularity = TIMEFRAMES[tfIndex].granularity;

  /* ---------- Create chart once ---------- */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      rightPriceScale: { borderColor: '#e5e5e5' },
      timeScale: { borderColor: '#e5e5e5', timeVisible: true },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26b0a3',
      downColor: '#ef4444',
      borderUpColor: '#26b0a3',
      borderDownColor: '#ef4444',
      wickUpColor: '#26b0a3',
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

  /* ---------- Stream data on market or timeframe change ---------- */
  useEffect(() => {
    const ws = new WebSocket(DERIV_WS_URL);
    let closed = false;

    setConnected(false);
    setLastPrice(null);
    currentCandleRef.current = null;

    ws.onopen = () => {
      setConnected(true);
      const end = Math.floor(Date.now() / 1000);
      const start = end - granularity * 200;

      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 200,
          end: 'latest',
          start,
          style: 'candles',
          granularity,
          subscribe: 1,
        })
      );
    };

    ws.onmessage = (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data);

        /* Historical candles */
        if (data.msg_type === 'candles' && Array.isArray(data.candles)) {
          const candles: Candle[] = data.candles.map((c: any) => ({
            time: c.epoch as UTCTimestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));
          seriesRef.current?.setData(candles);
          if (candles.length > 0) {
            currentCandleRef.current =
              candles[candles.length - 1];
            setLastPrice(candles[candles.length - 1].close);
          }
          chartRef.current?.timeScale().fitContent();
        }

        /* Live OHLC updates */
        if (data.msg_type === 'ohlc' && data.ohlc) {
          const o = data.ohlc;
          const candle: Candle = {
            time: o.open_time as UTCTimestamp,
            open: Number(o.open),
            high: Number(o.high),
            low: Number(o.low),
            close: Number(o.close),
          };
          seriesRef.current?.update(candle);
          currentCandleRef.current = candle;
          setLastPrice(candle.close);
        }
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    return () => {
      closed = true;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              forget_all: 'candles',
            })
          );
        }
      } catch {
        /* ignore */
      }
      ws.close();
    };
  }, [symbol, granularity]);

  return (
    <main className="h-[calc(100vh-56px)] flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
        {/* Symbol dropdown */}
        <div className="flex flex-col">
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm font-semibold text-navy outline-none cursor-pointer"
          >
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {lastPrice !== null ? lastPrice.toFixed(4) : '—'}
            <span className="text-gray-400">
              {connected ? 'live' : 'connecting'}
            </span>
          </div>
        </div>

        {/* Timeframes */}
        <div className="flex gap-1 ml-4">
          {TIMEFRAMES.map((tf, i) => (
            <button
              key={tf.label}
              onClick={() => setTfIndex(i)}
              className={`px-3 py-1.5 text-xs rounded font-medium transition ${
                tfIndex === i
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* AI floating button */}
        <button className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center z-10">
          AI
        </button>
      </div>
    </main>
  );
}