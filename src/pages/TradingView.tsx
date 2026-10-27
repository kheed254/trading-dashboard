import { useEffect, useRef, useState } from 'react';
import * as LWC from 'lightweight-charts';
import { DERIV_WS_URL, useMarkets } from '../lib/deriv';

/* ---------- Config ---------- */

/* Deriv candle sizes (seconds) */
const TIMEFRAMES = [
  { label: '1m', g: 60 },
  { label: '2m', g: 120 },
  { label: '3m', g: 180 },
  { label: '5m', g: 300 },
  { label: '10m', g: 600 },
  { label: '15m', g: 900 },
  { label: '30m', g: 1800 },
  { label: '1h', g: 3600 },
  { label: '2h', g: 7200 },
  { label: '4h', g: 14400 },
  { label: '8h', g: 28800 },
  { label: '1d', g: 86400 },
];

type ChartType = 'candles' | 'line' | 'area';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export default function TradingView() {
  const [marketName, setMarketName] = useState('Volatility 25 Index');
  const [granularity, setGranularity] = useState(60);
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCandle, setLastCandle] = useState<Candle | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);
  const [precision, setPrecision] = useState(2);

  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const candlesRef = useRef<Candle[]>([]);
  const chartTypeRef = useRef<ChartType>('candles');
  const pipRef = useRef(2);
  chartTypeRef.current = chartType;

  const { groups: marketGroups, symbolFor } = useMarkets();
  const symbol = symbolFor(marketName) ?? 'R_100';
  const tfLabel = TIMEFRAMES.find((t) => t.g === granularity)?.label ?? '';

  /* ---- helpers (only use refs, so they are safe inside effects) ---- */
  const toPoint = (c: Candle): any =>
    chartTypeRef.current === 'candles' ? c : { time: c.time, value: c.close };

  const applyPrecision = () => {
    const s = seriesRef.current;
    if (!s) return;
    const p = pipRef.current;
    s.applyOptions({
      priceFormat: { type: 'price', precision: p, minMove: 1 / Math.pow(10, p) },
    });
  };

  const setSeriesData = (fit: boolean) => {
    const s = seriesRef.current;
    if (!s) return;
    s.setData(candlesRef.current.map(toPoint));
    if (fit) chartRef.current?.timeScale().fitContent();
  };

  /* ---- 1. Create the chart once ---- */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const chart: any = (LWC as any).createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: '#ffffff' }, textColor: '#131722' },
      grid: {
        vertLines: { color: '#f0f3fa' },
        horzLines: { color: '#f0f3fa' },
      },
      rightPriceScale: { borderColor: '#e0e3eb' },
      timeScale: { borderColor: '#e0e3eb', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    chart.subscribeCrosshairMove((param: any) => {
      const s = seriesRef.current;
      const d = s && param && param.seriesData ? param.seriesData.get(s) : null;
      if (d && typeof d.open === 'number') {
        setHover({
          time: Number(param.time),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        });
      } else {
        setHover(null);
      }
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  /* ---- 2. (Re)create the series when the chart type changes ---- */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current) {
      try {
        chart.removeSeries(seriesRef.current);
      } catch {
        /* ignore */
      }
      seriesRef.current = null;
    }

    const api = LWC as any;
    const oldApi = typeof chart.addCandlestickSeries === 'function'; // lightweight-charts v4
    let s: any;

    if (chartType === 'candles') {
      const opts = {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      };
      s = oldApi ? chart.addCandlestickSeries(opts) : chart.addSeries(api.CandlestickSeries, opts);
    } else if (chartType === 'line') {
      const opts = { color: '#2962ff', lineWidth: 2 };
      s = oldApi ? chart.addLineSeries(opts) : chart.addSeries(api.LineSeries, opts);
    } else {
      const opts = {
        lineColor: '#2962ff',
        topColor: 'rgba(41,98,255,0.35)',
        bottomColor: 'rgba(41,98,255,0.02)',
        lineWidth: 2,
      };
      s = oldApi ? chart.addAreaSeries(opts) : chart.addSeries(api.AreaSeries, opts);
    }

    seriesRef.current = s;
    applyPrecision();
    setSeriesData(candlesRef.current.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  /* ---- 3. Live data from Deriv (history + live candle), auto-reconnect ---- */
  useEffect(() => {
    let cancelled = false;
    let current: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    candlesRef.current = [];
    setLastCandle(null);
    setLoading(true);
    setError(null);
    setConnected(false);
    seriesRef.current?.setData([]);

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(DERIV_WS_URL);
      current = ws;

      ws.onopen = () => {
        if (cancelled || current !== ws) return;
        attempts = 0;
        setConnected(true);
        ws.send(
          JSON.stringify({
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 500,
            end: 'latest',
            style: 'candles',
            granularity,
            subscribe: 1,
          })
        );
      };

      ws.onmessage = (event) => {
        if (cancelled || current !== ws) return;
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.error) {
          setError(data.error.message || 'Could not load the chart data');
          setLoading(false);
          return;
        }

        /* history */
        if (data.msg_type === 'candles' && Array.isArray(data.candles)) {
          const pip = Number(data.pip_size);
          if (Number.isFinite(pip) && pip >= 0 && pip <= 10) {
            pipRef.current = pip;
            setPrecision(pip);
          }
          const list: Candle[] = data.candles.map((c: any) => ({
            time: Number(c.epoch),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));
          candlesRef.current = list;
          applyPrecision();
          setSeriesData(true);
          setLastCandle(list.length ? list[list.length - 1] : null);
          setLoading(false);
          setError(null);
        }

        /* live candle update */
        if (data.msg_type === 'ohlc' && data.ohlc) {
          const o = data.ohlc;
          const candle: Candle = {
            time: Number(o.open_time),
            open: Number(o.open),
            high: Number(o.high),
            low: Number(o.low),
            close: Number(o.close),
          };
          const arr = candlesRef.current;
          const last = arr[arr.length - 1];
          if (last && last.time === candle.time) {
            arr[arr.length - 1] = candle;
          } else if (!last || candle.time > last.time) {
            arr.push(candle);
          } else {
            return;
          }
          seriesRef.current?.update(toPoint(candle));
          setLastCandle(candle);
        }
      };

      ws.onerror = () => {
        if (cancelled || current !== ws) return;
        setError('Connection problem — retrying…');
      };

      ws.onclose = () => {
        if (cancelled || current !== ws) return;
        setConnected(false);
        attempts += 1;
        timer = setTimeout(connect, Math.min(15000, 2000 * attempts));
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      const ws = current;
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ forget_all: ['ticks', 'candles'] }));
          }
        } catch {
          /* ignore */
        }
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, granularity]);

  /* ---- toolbar actions ---- */
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  };

  const takeScreenshot = () => {
    try {
      const canvas: HTMLCanvasElement | undefined = chartRef.current?.takeScreenshot?.();
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stingerfx-${symbol}-${tfLabel}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch {
      /* ignore */
    }
  };

  /* ---- OHLC readout ---- */
  const shown = hover ?? lastCandle;
  const up = shown ? shown.close >= shown.open : true;
  const change = shown ? shown.close - shown.open : 0;
  const changePct = shown && shown.open ? (change / shown.open) * 100 : 0;
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
  const valueColor = up ? 'text-teal-600' : 'text-red-500';

  return (
    <main className="max-w-7xl mx-auto px-2 sm:px-4 py-3">
      <div
        ref={wrapRef}
        className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col"
        style={{ height: 'calc(100vh - 175px)', minHeight: 420 }}
      >
        {/* ============ TOOLBAR ============ */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white">
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm font-bold text-gray-900 bg-white outline-none focus:border-blue-500 cursor-pointer max-w-[180px]"
          >
            {marketGroups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((m) => (
                  <option key={m.symbol} value={m.name}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={granularity}
            onChange={(e) => setGranularity(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm font-bold text-gray-900 bg-white outline-none focus:border-blue-500 cursor-pointer"
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.g} value={t.g}>{t.label}</option>
            ))}
          </select>

          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {([
              ['candles', 'Candles'],
              ['line', 'Line'],
              ['area', 'Area'],
            ] as [ChartType, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setChartType(k)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  chartType === k ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
            <button
              onClick={takeScreenshot}
              title="Save chart as image"
              className="w-8 h-8 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              title="Full screen"
              className="w-8 h-8 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          </div>
        </div>

        {/* ============ OHLC READOUT ============ */}
        <div className="px-3 py-2 text-xs sm:text-sm flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-100">
          <span className="font-bold text-gray-900">
            {marketName} · {tfLabel}
          </span>
          {shown && (
            <>
              <span className="text-gray-500">O <span className={valueColor}>{fmt(shown.open)}</span></span>
              <span className="text-gray-500">H <span className={valueColor}>{fmt(shown.high)}</span></span>
              <span className="text-gray-500">L <span className={valueColor}>{fmt(shown.low)}</span></span>
              <span className="text-gray-500">C <span className={valueColor}>{fmt(shown.close)}</span></span>
              <span className={valueColor}>
                {change >= 0 ? '+' : ''}{fmt(change)} ({change >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </>
          )}
        </div>

        {/* ============ CHART ============ */}
        <div className="relative flex-1 min-h-0">
          <div ref={boxRef} className="absolute inset-0" />
          {(loading || error) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-500 pointer-events-none">
              {error ? error : 'Loading chart…'}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-gray-400 mt-2">
        Charts powered by TradingView Lightweight Charts · market data from Deriv
      </p>
    </main>
  );
}