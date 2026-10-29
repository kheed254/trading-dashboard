import { useEffect, useRef, useState } from 'react';
import * as LWC from 'lightweight-charts';
import { DERIV_WS_URL, useMarkets } from '../lib/deriv';

/* ================================================================
   CONFIG
   ================================================================ */
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

type ChartType = 'candles' | 'hollow' | 'bars' | 'line' | 'area' | 'heikin';
const CHART_TYPES: [ChartType, string][] = [
  ['candles', 'Candles'],
  ['hollow', 'Hollow candles'],
  ['bars', 'Bars'],
  ['line', 'Line'],
  ['area', 'Area'],
  ['heikin', 'Heikin Ashi'],
];

type IndicatorKey = 'sma' | 'ema' | 'bb' | 'rsi' | 'macd';
const INDICATOR_LIST: { key: IndicatorKey; label: string; color: string }[] = [
  { key: 'sma', label: 'SMA 20 — Simple Moving Average', color: '#f59e0b' },
  { key: 'ema', label: 'EMA 20 — Exponential Moving Average', color: '#8b5cf6' },
  { key: 'bb', label: 'Bollinger Bands (20, 2)', color: '#2962ff' },
  { key: 'rsi', label: 'RSI 14 — Relative Strength Index', color: '#7e57c2' },
  { key: 'macd', label: 'MACD (12, 26, 9)', color: '#26a69a' },
];
const NO_INDICATORS: Record<IndicatorKey, boolean> = {
  sma: false,
  ema: false,
  bb: false,
  rsi: false,
  macd: false,
};

type Candle = { time: number; open: number; high: number; low: number; close: number };

/* a point on the chart: time (seconds) + price, so drawings survive timeframe changes */
type Pt = { t: number; p: number };
type Drawing =
  | { id: number; type: 'trend' | 'ray' | 'rect' | 'fib' | 'measure'; a: Pt; b: Pt; color: string }
  | { id: number; type: 'hline' | 'vline'; a: Pt; color: string }
  | { id: number; type: 'text'; a: Pt; text: string; color: string; size?: number }
  | { id: number; type: 'brush'; pts: Pt[]; color: string };

type Tool =
  | 'cursor'
  | 'trend'
  | 'ray'
  | 'hline'
  | 'vline'
  | 'rect'
  | 'fib'
  | 'measure'
  | 'brush'
  | 'text'
  | 'emoji'
  | 'zoom'
  | 'eraser';

const TWO_POINT: Tool[] = ['trend', 'ray', 'rect', 'fib', 'measure'];
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const EMOJIS = ['🙂', '🚀', '📈', '📉', '🔥', '⚠️', '✅', '❌', '💰', '⭐'];

const TOOL_LIST: { key: Tool; title: string }[] = [
  { key: 'cursor', title: 'Cursor' },
  { key: 'trend', title: 'Trend line' },
  { key: 'ray', title: 'Ray' },
  { key: 'hline', title: 'Horizontal line' },
  { key: 'vline', title: 'Vertical line' },
  { key: 'rect', title: 'Rectangle' },
  { key: 'fib', title: 'Fib retracement' },
  { key: 'measure', title: 'Measure (ruler)' },
  { key: 'brush', title: 'Brush' },
  { key: 'text', title: 'Text' },
  { key: 'emoji', title: 'Emoji' },
  { key: 'zoom', title: 'Zoom in (drag a box)' },
  { key: 'eraser', title: 'Eraser (tap a drawing)' },
];

/* tiny stroke icons (24x24) */
const ICONS: Record<string, string[]> = {
  cursor: ['M12 3v7', 'M12 14v7', 'M3 12h7', 'M14 12h7'],
  trend: ['M5 19L19 5', 'M5 19m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0', 'M19 5m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0'],
  ray: ['M5 19L20 4', 'M14 4h6v6'],
  hline: ['M3 12h18', 'M3 12m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0'],
  vline: ['M12 3v18'],
  rect: ['M5 6h14v12H5z'],
  fib: ['M4 4h16', 'M4 9h16', 'M4 14h16', 'M4 19h16'],
  measure: ['M3.5 16.5l13-13 4 4-13 13z', 'M7 13l2 2', 'M10 10l2 2', 'M13 7l2 2'],
  brush: ['M4 20l1-4L17 4l3 3L8 19z'],
  text: ['M5 5h14', 'M12 5v14', 'M9 19h6'],
  emoji: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M9 10h.01', 'M15 10h.01', 'M8.5 14.5c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2'],
  zoom: ['M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M20 20l-4-4', 'M11 8v6', 'M8 11h6'],
  eraser: ['M4 16l9-9 6 6-5 5H8z', 'M10 21h10'],
  magnet: ['M6 3v8a6 6 0 0012 0V3', 'M6 7h4', 'M14 7h4'],
  trash: ['M5 7h14', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13'],
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 010 12h-4'],
  redo: ['M15 14l5-5-5-5', 'M20 9H10a6 6 0 000 12h4'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 13m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0'],
  full: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  fit: ['M4 12h16', 'M8 8l-4 4 4 4', 'M16 8l4 4-4 4'],
  save: ['M5 4h11l3 3v13H5z', 'M8 4v5h7V4', 'M8 20v-6h8v6'],
};

function Icon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(ICONS[name] || []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ================================================================
   HELPERS
   ================================================================ */
const LAYOUT_KEY = 'sfx_tv_layout_v2';
const drawKey = (symbol: string) => `sfx_tv_draw_v2:${symbol}`;

function loadLayout(): any {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function loadDrawings(symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(drawKey(symbol));
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveDrawings(symbol: string, list: Drawing[]) {
  try {
    localStorage.setItem(drawKey(symbol), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/* works with lightweight-charts v4 and v5 */
function addSeries(chart: any, kind: 'Candlestick' | 'Bar' | 'Line' | 'Area' | 'Histogram', opts: any) {
  const fn = chart[`add${kind}Series`];
  if (typeof fn === 'function') return fn.call(chart, opts);
  return chart.addSeries((LWC as any)[`${kind}Series`], opts);
}

const smaArr = (v: number[], n: number): (number | null)[] =>
  v.map((_, i) => (i < n - 1 ? null : v.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n));

const emaArr = (v: number[], n: number): (number | null)[] => {
  const k = 2 / (n + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  v.forEach((x, i) => {
    if (i < n - 1) {
      out.push(null);
      return;
    }
    if (prev === null) prev = v.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else prev = x * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
};

const bbArr = (v: number[], n = 20, mult = 2) => {
  const mid = smaArr(v, n);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  v.forEach((_, i) => {
    const m = mid[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      return;
    }
    const slice = v.slice(i - n + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - m) * (b - m), 0) / n);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  });
  return { mid, upper, lower };
};

const rsiArr = (v: number[], n = 14): (number | null)[] => {
  const out: (number | null)[] = v.map(() => null);
  if (v.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = v[i] - v[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let ag = gain / n;
  let al = loss / n;
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    ag = (ag * (n - 1) + (d > 0 ? d : 0)) / n;
    al = (al * (n - 1) + (d < 0 ? -d : 0)) / n;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
};

const macdArr = (v: number[]) => {
  const e12 = emaArr(v, 12);
  const e26 = emaArr(v, 26);
  const macd: (number | null)[] = v.map((_, i) =>
    e12[i] !== null && e26[i] !== null ? (e12[i] as number) - (e26[i] as number) : null
  );
  const start = macd.findIndex((x) => x !== null);
  const sig: (number | null)[] = v.map(() => null);
  if (start >= 0) {
    const e = emaArr(macd.slice(start) as number[], 9);
    e.forEach((x, j) => {
      sig[start + j] = x;
    });
  }
  const hist: (number | null)[] = macd.map((m, i) =>
    m !== null && sig[i] !== null ? m - (sig[i] as number) : null
  );
  return { macd, sig, hist };
};

const toHeikin = (c: Candle[]): Candle[] => {
  const out: Candle[] = [];
  c.forEach((k, i) => {
    const close = (k.open + k.high + k.low + k.close) / 4;
    const open = i === 0 ? (k.open + k.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out.push({
      time: k.time,
      open,
      high: Math.max(k.high, open, close),
      low: Math.min(k.low, open, close),
      close,
    });
  });
  return out;
};

const distSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/* ================================================================
   COMPONENT
   ================================================================ */
export default function TradingView() {
  const init = useRef<any>(loadLayout()).current;

  const [marketName, setMarketName] = useState<string>(init.market ?? 'Volatility 25 Index');
  const [granularity, setGranularity] = useState<number>(init.granularity ?? 60);
  const [chartType, setChartType] = useState<ChartType>(init.chartType ?? 'candles');
  const [dark, setDark] = useState<boolean>(init.dark ?? false);
  const [indicators, setIndicators] = useState<Record<IndicatorKey, boolean>>({
    ...NO_INDICATORS,
    ...(init.indicators ?? {}),
  });
  const [grid, setGrid] = useState<boolean>(init.grid ?? true);
  const [magnet, setMagnet] = useState<boolean>(init.magnet ?? false);
  const [drawColor, setDrawColor] = useState<string>(init.color ?? '#2962ff');
  const [tool, setTool] = useState<Tool>('cursor');
  const [compare, setCompare] = useState<string>('');
  const [panel, setPanel] = useState<null | 'indicators' | 'settings' | 'compare'>(null);
  const [emoji, setEmoji] = useState('🙂');

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCandle, setLastCandle] = useState<Candle | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);
  const [precision, setPrecision] = useState(2);
  const [savedFlash, setSavedFlash] = useState(false);
  const [histVersion, setHistVersion] = useState(0);
  const [isFs, setIsFs] = useState(false);

  const { groups: marketGroups, symbolFor } = useMarkets();
  const symbol = symbolFor(marketName) ?? 'R_25';
  const tfLabel = TIMEFRAMES.find((t) => t.g === granularity)?.label ?? '';

  /* refs (used by the chart, the overlay and the event handlers) */
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const compareSeriesRef = useRef<any>(null);
  const indSeriesRef = useRef<Record<string, any[]>>({});
  const candlesRef = useRef<Candle[]>([]);

  const chartTypeRef = useRef<ChartType>(chartType);
  const toolRef = useRef<Tool>(tool);
  const magnetRef = useRef(magnet);
  const colorRef = useRef(drawColor);
  const darkRef = useRef(dark);
  const gRef = useRef(granularity);
  const symbolRef = useRef(symbol);
  const emojiRef = useRef(emoji);
  const indicatorsRef = useRef(indicators);
  const pipRef = useRef(2);
  const symbolForRef = useRef(symbolFor);
  chartTypeRef.current = chartType;
  toolRef.current = tool;
  magnetRef.current = magnet;
  colorRef.current = drawColor;
  darkRef.current = dark;
  gRef.current = granularity;
  symbolRef.current = symbol;
  emojiRef.current = emoji;
  indicatorsRef.current = indicators;
  symbolForRef.current = symbolFor;

  const dirtyRef = useRef(true);
  const drawingsRef = useRef<Drawing[]>([]);
  const undoRef = useRef<Drawing[][]>([]);
  const redoRef = useRef<Drawing[][]>([]);
  const draftRef = useRef<any>(null);
  const pendingRef = useRef<Pt | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; moved: boolean } | null>(null);
  const zoomRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const idRef = useRef(Date.now());

  /* ---------- chart <-> screen conversions ---------- */
  const ptToXY = (pt: Pt) => {
    const first = candlesRef.current[0]?.time;
    const chart = chartRef.current;
    const s = seriesRef.current;
    if (first === undefined || !chart || !s) return null;
    const l = (pt.t - first) / gRef.current;
    const x = chart.timeScale().logicalToCoordinate(l);
    const y = s.priceToCoordinate(pt.p);
    if (x === null || x === undefined || y === null || y === undefined) return null;
    return { x: x as number, y: y as number };
  };

  const xyToPt = (x: number, y: number): Pt | null => {
    const candles = candlesRef.current;
    const chart = chartRef.current;
    const s = seriesRef.current;
    if (!candles.length || !chart || !s) return null;
    const l = chart.timeScale().coordinateToLogical(x);
    const p = s.coordinateToPrice(y);
    if (l === null || l === undefined || p === null || p === undefined) return null;
    const first = candles[0].time;
    let t = first + (l as number) * gRef.current;
    let price = p as number;
    if (magnetRef.current) {
      const idx = Math.round(l as number);
      if (idx >= 0 && idx < candles.length) {
        const c = candles[idx];
        t = c.time;
        price = [c.open, c.high, c.low, c.close].reduce((best, v) =>
          Math.abs(v - price) < Math.abs(best - price) ? v : best
        );
      }
    }
    return { t, p: price };
  };

  /* ---------- drawings: add / undo / redo / persist ---------- */
  const commit = (list: Drawing[]) => {
    undoRef.current.push(drawingsRef.current);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    drawingsRef.current = list;
    saveDrawings(symbolRef.current, list);
    dirtyRef.current = true;
    setHistVersion((v) => v + 1);
  };
  const addDrawing = (d: Drawing) => commit([...drawingsRef.current, d]);
  const nextId = () => ++idRef.current;

  const undo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(drawingsRef.current);
    drawingsRef.current = prev;
    saveDrawings(symbolRef.current, prev);
    dirtyRef.current = true;
    setHistVersion((v) => v + 1);
  };
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(drawingsRef.current);
    drawingsRef.current = next;
    saveDrawings(symbolRef.current, next);
    dirtyRef.current = true;
    setHistVersion((v) => v + 1);
  };
  const clearAll = () => {
    if (drawingsRef.current.length) commit([]);
  };
  const finishTool = () => {
    draftRef.current = null;
    pendingRef.current = null;
    dragRef.current = null;
    zoomRef.current = null;
    dirtyRef.current = true;
    setTool('cursor');
  };

  /* ---------- series data helpers ---------- */
  const displayData = (): any[] => {
    const arr = candlesRef.current;
    const t = chartTypeRef.current;
    if (t === 'heikin') return toHeikin(arr);
    if (t === 'line' || t === 'area') return arr.map((c) => ({ time: c.time, value: c.close }));
    return arr;
  };
  const toPoint = (c: Candle): any =>
    chartTypeRef.current === 'line' || chartTypeRef.current === 'area'
      ? { time: c.time, value: c.close }
      : c;

  const applyPrecision = () => {
    const p = pipRef.current;
    const fmtOpts = { type: 'price', precision: p, minMove: 1 / Math.pow(10, p) };
    seriesRef.current?.applyOptions({ priceFormat: fmtOpts });
  };

  const setSeriesData = (fit: boolean) => {
    const s = seriesRef.current;
    if (!s) return;
    s.setData(displayData());
    if (fit) chartRef.current?.timeScale().fitContent();
    dirtyRef.current = true;
  };

  /* ---------- indicators ---------- */
  const updateIndicatorData = () => {
    const S = indSeriesRef.current;
    const c = candlesRef.current;
    if (!c.length) return;
    const times = c.map((k) => k.time);
    const closes = c.map((k) => k.close);
    const mk = (arr: (number | null)[]) =>
      arr
        .map((v, i) => (v === null ? null : { time: times[i], value: v }))
        .filter((x) => x !== null);
    if (S.sma) S.sma[0].setData(mk(smaArr(closes, 20)));
    if (S.ema) S.ema[0].setData(mk(emaArr(closes, 20)));
    if (S.bb) {
      const b = bbArr(closes, 20, 2);
      S.bb[0].setData(mk(b.upper));
      S.bb[1].setData(mk(b.mid));
      S.bb[2].setData(mk(b.lower));
    }
    if (S.rsi) S.rsi[0].setData(mk(rsiArr(closes, 14)));
    if (S.macd) {
      const m = macdArr(closes);
      S.macd[0].setData(
        m.hist
          .map((v, i) =>
            v === null ? null : { time: times[i], value: v, color: v >= 0 ? '#26a69a' : '#ef5350' }
          )
          .filter((x) => x !== null)
      );
      S.macd[1].setData(mk(m.macd));
      S.macd[2].setData(mk(m.sig));
    }
  };

  const rebuildIndicators = () => {
    const chart = chartRef.current;
    if (!chart) return;
    Object.values(indSeriesRef.current)
      .flat()
      .forEach((s: any) => {
        try {
          chart.removeSeries(s);
        } catch {
          /* ignore */
        }
      });
    indSeriesRef.current = {};

    const on = indicatorsRef.current;
    const sub = [on.rsi, on.macd].filter(Boolean).length;
    chart
      .priceScale('right')
      .applyOptions({ scaleMargins: { top: 0.06, bottom: sub === 0 ? 0.08 : sub === 1 ? 0.32 : 0.36 } });

    const line = (color: string, extra: any = {}) =>
      addSeries(chart, 'Line', {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        ...extra,
      });

    if (on.sma) indSeriesRef.current.sma = [line('#f59e0b')];
    if (on.ema) indSeriesRef.current.ema = [line('#8b5cf6')];
    if (on.bb) {
      indSeriesRef.current.bb = [
        line('#2962ff', { lineWidth: 1 }),
        line('#f59e0b', { lineWidth: 1 }),
        line('#2962ff', { lineWidth: 1 }),
      ];
    }
    if (on.rsi) {
      const s = line('#7e57c2', { priceScaleId: 'rsi', lastValueVisible: true });
      s.createPriceLine({ price: 70, color: '#9ca3af', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      s.createPriceLine({ price: 30, color: '#9ca3af', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      indSeriesRef.current.rsi = [s];
      chart
        .priceScale('rsi')
        .applyOptions({ scaleMargins: sub === 2 ? { top: 0.66, bottom: 0.18 } : { top: 0.72, bottom: 0.03 } });
    }
    if (on.macd) {
      const hist = addSeries(chart, 'Histogram', {
        priceScaleId: 'macd',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const m = line('#2962ff', { priceScaleId: 'macd', lineWidth: 1 });
      const sg = line('#f59e0b', { priceScaleId: 'macd', lineWidth: 1 });
      indSeriesRef.current.macd = [hist, m, sg];
      chart
        .priceScale('macd')
        .applyOptions({ scaleMargins: sub === 2 ? { top: 0.84, bottom: 0.02 } : { top: 0.72, bottom: 0.03 } });
    }
    updateIndicatorData();
  };

  const pushLive = (c: Candle) => {
    const s = seriesRef.current;
    if (!s) return;
    if (chartTypeRef.current === 'heikin') s.setData(displayData());
    else s.update(toPoint(c));
    updateIndicatorData();
    dirtyRef.current = true;
  };

  /* ================================================================
     DRAWING ON THE OVERLAY CANVAS
     ================================================================ */
  const drawOne = (ctx: CanvasRenderingContext2D, d: any, w: number, h: number, draft = false) => {
    const prec = pipRef.current;
    const isDark = darkRef.current;
    ctx.save();
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    if (draft) ctx.globalAlpha = 0.85;

    const dot = (p: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    };
    const tag = (text: string, x: number, y: number, bg: string, fg = '#ffffff') => {
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = bg;
      ctx.fillRect(x, y - 9, tw + 8, 18);
      ctx.fillStyle = fg;
      ctx.fillText(text, x + 4, y);
    };

    switch (d.type) {
      case 'trend': {
        const a = ptToXY(d.a);
        const b = ptToXY(d.b);
        if (!a || !b) break;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        dot(a);
        dot(b);
        break;
      }
      case 'ray': {
        const a = ptToXY(d.a);
        const b = ptToXY(d.b);
        if (!a || !b) break;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let ex = b.x;
        let ey = b.y;
        if (Math.abs(dx) > 0.001) {
          const k = ((dx > 0 ? w : 0) - a.x) / dx;
          ex = a.x + k * dx;
          ey = a.y + k * dy;
        } else {
          ey = dy >= 0 ? h : 0;
        }
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        dot(a);
        dot(b);
        break;
      }
      case 'hline': {
        const a = ptToXY(d.a);
        if (!a) break;
        ctx.beginPath();
        ctx.moveTo(0, a.y);
        ctx.lineTo(w, a.y);
        ctx.stroke();
        tag(d.a.p.toFixed(prec), Math.max(0, w - 72), a.y, d.color);
        break;
      }
      case 'vline': {
        const a = ptToXY(d.a);
        if (!a) break;
        ctx.beginPath();
        ctx.moveTo(a.x, 0);
        ctx.lineTo(a.x, h);
        ctx.stroke();
        break;
      }
      case 'rect': {
        const a = ptToXY(d.a);
        const b = ptToXY(d.b);
        if (!a || !b) break;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        ctx.globalAlpha = draft ? 0.85 : 1;
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        break;
      }
      case 'fib': {
        const a = ptToXY(d.a);
        const b = ptToXY(d.b);
        if (!a || !b) break;
        ctx.lineWidth = 1;
        const x0 = Math.min(a.x, b.x);
        FIB_LEVELS.forEach((r) => {
          const price = d.b.p + (d.a.p - d.b.p) * r;
          const y = seriesRef.current?.priceToCoordinate(price);
          if (y === null || y === undefined) return;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.fillStyle = d.color;
          ctx.fillText(`${r} (${price.toFixed(prec)})`, x0 + 4, y - 8);
        });
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'measure': {
        const a = ptToXY(d.a);
        const b = ptToXY(d.b);
        if (!a || !b) break;
        const diff = d.b.p - d.a.p;
        const pct = d.a.p ? (diff / d.a.p) * 100 : 0;
        const bars = Math.round((d.b.t - d.a.t) / gRef.current);
        const col = diff >= 0 ? '#26a69a' : '#ef5350';
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        ctx.globalAlpha = draft ? 0.85 : 1;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        ctx.setLineDash([]);
        dot(a);
        dot(b);
        const line1 = `${diff >= 0 ? '+' : ''}${diff.toFixed(prec)} (${diff >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        const line2 = `${Math.abs(bars)} bars`;
        const bx = Math.min(Math.max(b.x + 8, 4), Math.max(4, w - 130));
        const by = Math.min(Math.max(b.y, 20), Math.max(20, h - 30));
        tag(line1, bx, by - 10, col);
        tag(line2, bx, by + 10, col);
        break;
      }
      case 'text': {
        const a = ptToXY(d.a);
        if (!a) break;
        const size = d.size ?? 15;
        ctx.font = `bold ${size}px system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        if (!d.size) {
          const tw = ctx.measureText(d.text).width;
          ctx.fillStyle = isDark ? 'rgba(19,23,34,0.7)' : 'rgba(255,255,255,0.7)';
          ctx.fillRect(a.x - 3, a.y - size / 2 - 3, tw + 6, size + 6);
          ctx.fillStyle = d.color;
        }
        ctx.fillText(d.text, a.x, a.y);
        break;
      }
      case 'brush': {
        ctx.beginPath();
        let started = false;
        d.pts.forEach((p: Pt) => {
          const xy = ptToXY(p);
          if (!xy) return;
          if (!started) {
            ctx.moveTo(xy.x, xy.y);
            started = true;
          } else {
            ctx.lineTo(xy.x, xy.y);
          }
        });
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  };

  const render = () => {
    const canvas = overlayRef.current;
    const box = boxRef.current;
    if (!canvas || !box || !chartRef.current || !seriesRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawingsRef.current.forEach((d) => drawOne(ctx, d, w, h));
    if (draftRef.current) drawOne(ctx, draftRef.current, w, h, true);
    const z = zoomRef.current;
    if (z) {
      ctx.save();
      ctx.strokeStyle = '#2962ff';
      ctx.fillStyle = 'rgba(41,98,255,0.12)';
      ctx.setLineDash([5, 4]);
      ctx.fillRect(Math.min(z.x0, z.x1), Math.min(z.y0, z.y1), Math.abs(z.x1 - z.x0), Math.abs(z.y1 - z.y0));
      ctx.strokeRect(Math.min(z.x0, z.x1), Math.min(z.y0, z.y1), Math.abs(z.x1 - z.x0), Math.abs(z.y1 - z.y0));
      ctx.restore();
    }
  };

  const hitTest = (x: number, y: number): number | null => {
    const list = drawingsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const d: any = list[i];
      let dist = Infinity;
      if (d.type === 'trend' || d.type === 'ray' || d.type === 'measure') {
        const a = ptToXY(d.a);
        const b = ptToXY(d.b);
        if (a && b) dist = distSeg(x, y, a.x, a.y, b.x, b.y);
      } else if (d.type === 'rect') {
        const a = ptToXY(d.a);
        const b = ptToXY(d.b);
        if (a && b) {
          const x0 = Math.min(a.x, b.x);
          const x1 = Math.max(a.x, b.x);
          const y0 = Math.min(a.y, b.y);
          const y1 = Math.max(a.y, b.y);
          dist = Math.min(
            distSeg(x, y, x0, y0, x1, y0),
            distSeg(x, y, x1, y0, x1, y1),
            distSeg(x, y, x1, y1, x0, y1),
            distSeg(x, y, x0, y1, x0, y0)
          );
        }
      } else if (d.type === 'fib') {
        const a = ptToXY(d.a);
        if (a) {
          FIB_LEVELS.forEach((r) => {
            const yy = seriesRef.current?.priceToCoordinate(d.b.p + (d.a.p - d.b.p) * r);
            if (yy !== null && yy !== undefined) dist = Math.min(dist, Math.abs(y - yy));
          });
        }
      } else if (d.type === 'hline') {
        const a = ptToXY(d.a);
        if (a) dist = Math.abs(y - a.y);
      } else if (d.type === 'vline') {
        const a = ptToXY(d.a);
        if (a) dist = Math.abs(x - a.x);
      } else if (d.type === 'text') {
        const a = ptToXY(d.a);
        if (a) dist = Math.hypot(x - a.x, y - a.y) - 12;
      } else if (d.type === 'brush') {
        const pts = d.pts.map((p: Pt) => ptToXY(p)).filter(Boolean) as { x: number; y: number }[];
        for (let k = 1; k < pts.length; k++) {
          dist = Math.min(dist, distSeg(x, y, pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y));
        }
      }
      if (dist <= 10) return i;
    }
    return null;
  };

  /* ================================================================
     POINTER EVENTS ON THE OVERLAY (only active while a tool is picked)
     ================================================================ */
  const getXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = toolRef.current;
    if (t === 'cursor') return;
    const { x, y } = getXY(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (t === 'eraser') {
      const idx = hitTest(x, y);
      if (idx !== null) commit(drawingsRef.current.filter((_, i) => i !== idx));
      return;
    }
    if (t === 'zoom') {
      zoomRef.current = { x0: x, y0: y, x1: x, y1: y };
      dirtyRef.current = true;
      return;
    }

    const pt = xyToPt(x, y);
    if (!pt) return;
    const color = colorRef.current;

    if (t === 'hline' || t === 'vline') {
      addDrawing({ id: nextId(), type: t, a: pt, color });
      finishTool();
      return;
    }
    if (t === 'text') {
      const text = window.prompt('Text');
      if (text && text.trim()) addDrawing({ id: nextId(), type: 'text', a: pt, text: text.trim(), color });
      finishTool();
      return;
    }
    if (t === 'emoji') {
      addDrawing({ id: nextId(), type: 'text', a: pt, text: emojiRef.current, color, size: 26 });
      finishTool();
      return;
    }
    if (t === 'brush') {
      draftRef.current = { id: 0, type: 'brush', pts: [pt], color };
      dragRef.current = { sx: x, sy: y, moved: true };
      return;
    }
    if (TWO_POINT.includes(t)) {
      if (pendingRef.current) {
        const a = pendingRef.current;
        addDrawing({ id: nextId(), type: t as 'trend' | 'ray' | 'rect' | 'fib' | 'measure', a, b: pt, color });
        finishTool();
        return;
      }
      draftRef.current = { id: 0, type: t, a: pt, b: pt, color };
      dragRef.current = { sx: x, sy: y, moved: false };
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getXY(e);
    const z = zoomRef.current;
    if (z) {
      z.x1 = x;
      z.y1 = y;
      dirtyRef.current = true;
      return;
    }
    const draft = draftRef.current;
    if (!draft) return;
    const pt = xyToPt(x, y);
    if (!pt) return;
    if (draft.type === 'brush') {
      draft.pts.push(pt);
      dirtyRef.current = true;
      return;
    }
    const drag = dragRef.current;
    if (drag && Math.hypot(x - drag.sx, y - drag.sy) > 6) drag.moved = true;
    draft.b = pt;
    dirtyRef.current = true;
  };

  const onUp = () => {
    const t = toolRef.current;
    const z = zoomRef.current;
    if (t === 'zoom' && z) {
      const chart = chartRef.current;
      const l0 = chart?.timeScale().coordinateToLogical(Math.min(z.x0, z.x1));
      const l1 = chart?.timeScale().coordinateToLogical(Math.max(z.x0, z.x1));
      if (chart && l0 !== null && l0 !== undefined && l1 !== null && l1 !== undefined && l1 - l0 > 2) {
        chart.timeScale().setVisibleLogicalRange({ from: l0, to: l1 });
      }
      finishTool();
      return;
    }
    const draft = draftRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    if (!draft) return;
    if (draft.type === 'brush') {
      if (draft.pts.length > 1) addDrawing({ id: nextId(), type: 'brush', pts: draft.pts, color: draft.color });
      draftRef.current = null;
      dirtyRef.current = true;
      return;
    }
    if (drag && drag.moved) {
      addDrawing({ id: nextId(), type: draft.type, a: draft.a, b: draft.b, color: draft.color });
      finishTool();
    } else {
      // a simple tap: remember the first point and wait for the second tap
      pendingRef.current = draft.a;
    }
  };

  /* ================================================================
     EFFECTS
     ================================================================ */

  /* 1. create the chart once */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const chart: any = (LWC as any).createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: '#ffffff' }, textColor: '#131722' },
      grid: { vertLines: { color: '#f0f3fa' }, horzLines: { color: '#f0f3fa' } },
      rightPriceScale: { borderColor: '#e0e3eb', scaleMargins: { top: 0.06, bottom: 0.08 } },
      leftPriceScale: { visible: false, borderColor: '#e0e3eb' },
      timeScale: { borderColor: '#e0e3eb', timeVisible: true, secondsVisible: false, rightOffset: 10 },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      dirtyRef.current = true;
    });
    ro.observe(el);

    chart.subscribeCrosshairMove((param: any) => {
      if (!param || param.time === undefined || param.time === null) {
        setHover(null);
        return;
      }
      const c = candlesRef.current.find((k) => k.time === Number(param.time));
      setHover(c ?? null);
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      dirtyRef.current = true;
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      compareSeriesRef.current = null;
      indSeriesRef.current = {};
    };
  }, []);

  /* 2. main series — rebuilt when the chart type changes */
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
    const upColor = '#26a69a';
    const downColor = '#ef5350';
    let s: any;
    if (chartType === 'line') {
      s = addSeries(chart, 'Line', { color: '#2962ff', lineWidth: 2 });
    } else if (chartType === 'area') {
      s = addSeries(chart, 'Area', {
        lineColor: '#2962ff',
        topColor: 'rgba(41,98,255,0.35)',
        bottomColor: 'rgba(41,98,255,0.02)',
        lineWidth: 2,
      });
    } else if (chartType === 'bars') {
      s = addSeries(chart, 'Bar', { upColor, downColor });
    } else if (chartType === 'hollow') {
      s = addSeries(chart, 'Candlestick', {
        upColor: 'rgba(0,0,0,0)',
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    } else {
      s = addSeries(chart, 'Candlestick', {
        upColor,
        downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    }
    seriesRef.current = s;
    applyPrecision();
    setSeriesData(candlesRef.current.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  /* 3. colours (light / dark) and grid */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const border = dark ? '#2a2e39' : '#e0e3eb';
    const gridColor = grid ? (dark ? '#1e222d' : '#f0f3fa') : 'rgba(0,0,0,0)';
    chart.applyOptions({
      layout: {
        background: { color: dark ? '#131722' : '#ffffff' },
        textColor: dark ? '#d1d4dc' : '#131722',
      },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor: border },
      leftPriceScale: { borderColor: border },
      timeScale: { borderColor: border },
    });
    dirtyRef.current = true;
  }, [dark, grid]);

  /* 4. indicators */
  useEffect(() => {
    rebuildIndicators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators]);

  /* 5. load this market's drawings */
  useEffect(() => {
    drawingsRef.current = loadDrawings(symbol);
    undoRef.current = [];
    redoRef.current = [];
    draftRef.current = null;
    pendingRef.current = null;
    dirtyRef.current = true;
    setHistVersion((v) => v + 1);
  }, [symbol]);

  /* 6. live data from Deriv (history + live candle), auto-reconnect */
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
    updateIndicatorData();

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
          updateIndicatorData();
          setLastCandle(list.length ? list[list.length - 1] : null);
          setLoading(false);
          setError(null);
        }

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
          if (last && last.time === candle.time) arr[arr.length - 1] = candle;
          else if (!last || candle.time > last.time) arr.push(candle);
          else return;
          pushLive(candle);
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
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget_all: ['ticks', 'candles'] }));
        } catch {
          /* ignore */
        }
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, granularity]);

  /* 7. compare with another market (second line on the left scale) */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (compareSeriesRef.current) {
      try {
        chart.removeSeries(compareSeriesRef.current);
      } catch {
        /* ignore */
      }
      compareSeriesRef.current = null;
    }
    chart.applyOptions({ leftPriceScale: { visible: !!compare } });
    if (!compare) return;
    const code = symbolForRef.current(compare);
    if (!code) return;

    let cancelled = false;
    const s = addSeries(chart, 'Line', {
      color: '#ef6c00',
      lineWidth: 2,
      priceScaleId: 'left',
      priceLineVisible: false,
    });
    compareSeriesRef.current = s;

    const ws = new WebSocket(DERIV_WS_URL);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          ticks_history: code,
          adjust_start_time: 1,
          count: 500,
          end: 'latest',
          style: 'candles',
          granularity,
          subscribe: 0,
        })
      );
    ws.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const d = JSON.parse(ev.data);
        if (d.msg_type === 'candles' && Array.isArray(d.candles)) {
          s.setData(d.candles.map((c: any) => ({ time: Number(c.epoch), value: Number(c.close) })));
          ws.close();
        } else if (d.error) {
          ws.close();
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      cancelled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [compare, granularity]);

  /* 8. remember the layout */
  useEffect(() => {
    try {
      localStorage.setItem(
        LAYOUT_KEY,
        JSON.stringify({
          market: marketName,
          granularity,
          chartType,
          dark,
          indicators,
          grid,
          magnet,
          color: drawColor,
        })
      );
    } catch {
      /* ignore */
    }
  }, [marketName, granularity, chartType, dark, indicators, grid, magnet, drawColor]);

  /* 9. keep the drawings glued to the chart (only redraws when something moved) */
  useEffect(() => {
    let raf = 0;
    let lastSig = '';
    const loop = () => {
      const chart = chartRef.current;
      const s = seriesRef.current;
      if (chart && s) {
        const c = candlesRef.current;
        const ref = c.length ? c[c.length - 1].close : 1;
        const ts = chart.timeScale();
        const sig = [
          ts.logicalToCoordinate(0),
          ts.logicalToCoordinate(50),
          s.priceToCoordinate(ref),
          s.priceToCoordinate(ref * 1.01 + 1),
          boxRef.current?.clientWidth,
          boxRef.current?.clientHeight,
        ].join('|');
        if (dirtyRef.current || sig !== lastSig) {
          lastSig = sig;
          dirtyRef.current = false;
          render();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 10. keyboard shortcuts + fullscreen state */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') finishTool();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    const onFs = () => setIsFs(document.fullscreenElement === wrapRef.current);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* picking a tool cancels a half-finished drawing */
  useEffect(() => {
    draftRef.current = null;
    pendingRef.current = null;
    dragRef.current = null;
    zoomRef.current = null;
    dirtyRef.current = true;
  }, [tool]);

  /* ================================================================
     TOOLBAR ACTIONS
     ================================================================ */
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  const takeScreenshot = () => {
    try {
      const shot: HTMLCanvasElement | undefined = chartRef.current?.takeScreenshot?.();
      if (!shot) return;
      const ctx = shot.getContext('2d');
      const overlay = overlayRef.current;
      if (ctx && overlay) ctx.drawImage(overlay, 0, 0, shot.width, shot.height);
      shot.toBlob((blob) => {
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

  const saveLayout = () => {
    saveDrawings(symbolRef.current, drawingsRef.current);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const resetLayout = () => {
    try {
      localStorage.removeItem(LAYOUT_KEY);
      localStorage.removeItem(drawKey(symbolRef.current));
    } catch {
      /* ignore */
    }
    setIndicators({ ...NO_INDICATORS });
    setChartType('candles');
    setGrid(true);
    setMagnet(false);
    setDark(false);
    setCompare('');
    clearAll();
  };

  const fitChart = () => {
    chartRef.current?.timeScale().fitContent();
    dirtyRef.current = true;
  };

  /* ================================================================
     RENDER
     ================================================================ */
  const shown = hover ?? lastCandle;
  const isUp = shown ? shown.close >= shown.open : true;
  const change = shown ? shown.close - shown.open : 0;
  const changePct = shown && shown.open ? (change / shown.open) * 100 : 0;
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
  const valueColor = isUp ? 'text-teal-500' : 'text-red-500';

  const canUndo = histVersion >= 0 && undoRef.current.length > 0;
  const canRedo = histVersion >= 0 && redoRef.current.length > 0;
  const activeSub = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);

  const shell = dark
    ? 'bg-[#131722] text-gray-100 border-[#2a2e39]'
    : 'bg-white text-gray-900 border-gray-200';
  const bar = dark ? 'border-[#2a2e39] bg-[#131722]' : 'border-gray-200 bg-white';
  const btn = dark
    ? 'border-[#363a45] text-gray-200 hover:bg-[#2a2e39]'
    : 'border-gray-300 text-gray-700 hover:bg-gray-50';
  const field = dark
    ? 'bg-[#1e222d] border-[#363a45] text-gray-100'
    : 'bg-white border-gray-300 text-gray-900';
  const popup = dark ? 'bg-[#1e222d] border-[#363a45] text-gray-100' : 'bg-white border-gray-200 text-gray-900';

  const toolBtn = (active: boolean) =>
    `w-9 h-9 shrink-0 rounded-md flex items-center justify-center transition ${
      active
        ? dark
          ? 'bg-[#2a2e39] text-blue-400'
          : 'bg-blue-50 text-blue-600'
        : dark
        ? 'text-gray-300 hover:bg-[#2a2e39]'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <main className="max-w-[1600px] mx-auto px-1 sm:px-3 py-2">
      <div
        ref={wrapRef}
        className={`relative border rounded-xl overflow-hidden flex flex-col ${shell} ${
          isFs ? 'h-screen rounded-none' : 'h-[calc(100vh-290px)] md:h-[calc(100vh-190px)]'
        } min-h-[360px]`}
      >
        {/* ============ TOP TOOLBAR ============ */}
        <div className={`flex items-center gap-1.5 px-2 py-1.5 border-b overflow-x-auto whitespace-nowrap ${bar}`}>
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className={`border rounded-md px-2 py-1.5 text-sm font-bold outline-none cursor-pointer max-w-[170px] ${field}`}
          >
            {marketGroups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((m) => (
                  <option key={m.symbol} value={m.name}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            onClick={() => setPanel(panel === 'compare' ? null : 'compare')}
            title="Compare with another market"
            className={`w-8 h-8 shrink-0 rounded-md border text-lg leading-none flex items-center justify-center ${btn} ${compare ? 'ring-2 ring-orange-400' : ''}`}
          >
            +
          </button>

          <select
            value={granularity}
            onChange={(e) => setGranularity(Number(e.target.value))}
            className={`border rounded-md px-2 py-1.5 text-sm font-bold outline-none cursor-pointer ${field}`}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.g} value={t.g}>{t.label}</option>
            ))}
          </select>

          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className={`border rounded-md px-2 py-1.5 text-sm outline-none cursor-pointer ${field}`}
            title="Chart type"
          >
            {CHART_TYPES.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>

          <button
            onClick={() => setPanel(panel === 'indicators' ? null : 'indicators')}
            className={`px-2.5 h-8 shrink-0 rounded-md border text-sm font-semibold ${btn}`}
          >
            <span className="italic font-serif mr-1">ƒx</span>Indicators
          </button>

          <button onClick={undo} disabled={!canUndo} title="Undo" className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center disabled:opacity-30 ${btn}`}>
            <Icon name="undo" className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo" className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center disabled:opacity-30 ${btn}`}>
            <Icon name="redo" className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-[8px]" />

          <span className="flex items-center gap-1.5 text-xs opacity-70 shrink-0">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>

          <button onClick={fitChart} title="Fit all candles" className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center ${btn}`}>
            <Icon name="fit" className="w-4 h-4" />
          </button>
          <button onClick={saveLayout} title="Save layout" className={`px-2.5 h-8 shrink-0 rounded-md border text-sm font-semibold flex items-center gap-1 ${btn}`}>
            <Icon name="save" className="w-4 h-4" />
            {savedFlash ? 'Saved ✓' : 'Save'}
          </button>
          <button onClick={() => setPanel(panel === 'settings' ? null : 'settings')} title="Settings" className={`w-8 h-8 shrink-0 rounded-md border text-base leading-none flex items-center justify-center ${btn}`}>
            ⚙
          </button>
          <button onClick={() => setDark((d) => !d)} title="Dark / light" className={`w-8 h-8 shrink-0 rounded-md border text-base leading-none flex items-center justify-center ${btn}`}>
            {dark ? '☀' : '☾'}
          </button>
          <button onClick={takeScreenshot} title="Save chart as image" className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center ${btn}`}>
            <Icon name="camera" className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} title="Full screen" className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center ${btn}`}>
            <Icon name="full" className="w-4 h-4" />
          </button>
        </div>

        {/* ============ BODY: left tools + chart ============ */}
        <div className="flex flex-1 min-h-0">
          {/* left drawing toolbar */}
          <div className={`w-11 shrink-0 border-r flex flex-col items-center gap-0.5 py-1.5 overflow-y-auto ${bar}`}>
            {TOOL_LIST.map((t) => (
              <button
                key={t.key}
                title={t.title}
                onClick={() => setTool(tool === t.key && t.key !== 'cursor' ? 'cursor' : t.key)}
                className={toolBtn(tool === t.key)}
              >
                <Icon name={t.key} />
              </button>
            ))}
            <div className={`w-6 border-t my-1 ${dark ? 'border-[#2a2e39]' : 'border-gray-200'}`} />
            <button title="Magnet (snap to candle prices)" onClick={() => setMagnet((m) => !m)} className={toolBtn(magnet)}>
              <Icon name="magnet" />
            </button>
            <button title="Remove all drawings" onClick={clearAll} className={toolBtn(false)}>
              <Icon name="trash" />
            </button>
          </div>

          {/* chart area */}
          <div className="relative flex-1 min-w-0">
            <div ref={boxRef} className="absolute inset-0" />

            {/* drawings live on this canvas; it only catches touches while a tool is picked */}
            <canvas
              ref={overlayRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="absolute inset-0 w-full h-full"
              style={{
                pointerEvents: tool === 'cursor' ? 'none' : 'auto',
                touchAction: 'none',
                cursor: tool === 'eraser' ? 'pointer' : 'crosshair',
              }}
            />

            {/* legend / OHLC */}
            <div className="absolute top-1 left-2 z-10 pointer-events-none text-xs sm:text-sm max-w-[calc(100%-70px)]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="font-bold">{marketName} · {tfLabel}</span>
                {shown && (
                  <>
                    <span className="opacity-70">O <span className={valueColor}>{fmt(shown.open)}</span></span>
                    <span className="opacity-70">H <span className={valueColor}>{fmt(shown.high)}</span></span>
                    <span className="opacity-70">L <span className={valueColor}>{fmt(shown.low)}</span></span>
                    <span className="opacity-70">C <span className={valueColor}>{fmt(shown.close)}</span></span>
                    <span className={valueColor}>
                      {change >= 0 ? '+' : ''}{fmt(change)} ({change >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                    </span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 text-[11px] mt-0.5">
                {INDICATOR_LIST.filter((i) => indicators[i.key]).map((i) => (
                  <span key={i.key} style={{ color: i.color }}>{i.label.split(' — ')[0]}</span>
                ))}
                {compare && <span style={{ color: '#ef6c00' }}>vs {compare}</span>}
              </div>
            </div>

            {/* labels for the RSI / MACD panes */}
            {indicators.rsi && (
              <div
                className="absolute left-2 z-10 pointer-events-none text-[11px] font-semibold"
                style={{ color: '#7e57c2', top: activeSub === 2 ? '66%' : '72%' }}
              >
                RSI 14
              </div>
            )}
            {indicators.macd && (
              <div
                className="absolute left-2 z-10 pointer-events-none text-[11px] font-semibold"
                style={{ color: '#26a69a', top: activeSub === 2 ? '84%' : '72%' }}
              >
                MACD 12, 26, 9
              </div>
            )}

            {/* hints while a tool is picked */}
            {tool !== 'cursor' && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-[11px] px-2.5 py-1 rounded-full bg-black/70 text-white whitespace-nowrap">
                {tool === 'eraser'
                  ? 'Tap a drawing to remove it'
                  : tool === 'brush'
                  ? 'Drag to draw'
                  : tool === 'text'
                  ? 'Tap where the text goes'
                  : tool === 'emoji'
                  ? 'Pick an emoji, then tap the chart'
                  : tool === 'hline' || tool === 'vline'
                  ? 'Tap on the chart'
                  : 'Drag on the chart (or tap two points) · Esc to cancel'}
              </div>
            )}

            {/* emoji picker */}
            {tool === 'emoji' && (
              <div className={`absolute top-10 left-2 z-20 flex flex-wrap gap-1 p-1.5 rounded-lg border shadow-lg max-w-[230px] ${popup}`}>
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`w-8 h-8 rounded-md text-xl flex items-center justify-center ${
                      emoji === e ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {(loading || error) && (
              <div
                className={`absolute inset-0 z-10 flex items-center justify-center text-sm pointer-events-none ${
                  dark ? 'bg-[#131722]/70 text-gray-300' : 'bg-white/70 text-gray-500'
                }`}
              >
                {error ? error : 'Loading chart…'}
              </div>
            )}
          </div>
        </div>

        {/* ============ POPUP PANELS ============ */}
        {panel === 'indicators' && (
          <div className={`absolute top-12 right-2 z-30 w-72 max-w-[calc(100%-16px)] rounded-lg border shadow-xl p-3 ${popup}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm">Indicators</div>
              <button onClick={() => setPanel(null)} className="text-xl leading-none opacity-60">×</button>
            </div>
            {INDICATOR_LIST.map((i) => (
              <label key={i.key} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={indicators[i.key]}
                  onChange={(e) => setIndicators((prev) => ({ ...prev, [i.key]: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: i.color }} />
                <span>{i.label}</span>
              </label>
            ))}
            <button
              onClick={() => setIndicators({ ...NO_INDICATORS })}
              className={`mt-2 w-full text-xs py-1.5 rounded-md border ${btn}`}
            >
              Remove all indicators
            </button>
          </div>
        )}

        {panel === 'compare' && (
          <div className={`absolute top-12 left-12 z-30 w-72 max-w-[calc(100%-16px)] rounded-lg border shadow-xl p-3 ${popup}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm">Compare with another market</div>
              <button onClick={() => setPanel(null)} className="text-xl leading-none opacity-60">×</button>
            </div>
            <select
              value={compare}
              onChange={(e) => setCompare(e.target.value)}
              className={`w-full border rounded-md px-2 py-1.5 text-sm outline-none ${field}`}
            >
              <option value="">— none —</option>
              {marketGroups.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((m) => (
                    <option key={m.symbol} value={m.name}>{m.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-[11px] opacity-60 mt-2">
              The second market is drawn as an orange line with its own price scale on the left.
            </p>
          </div>
        )}

        {panel === 'settings' && (
          <div className={`absolute top-12 right-2 z-30 w-72 max-w-[calc(100%-16px)] rounded-lg border shadow-xl p-3 ${popup}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm">Chart settings</div>
              <button onClick={() => setPanel(null)} className="text-xl leading-none opacity-60">×</button>
            </div>
            <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
              <span>Grid lines</span>
              <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} className="w-4 h-4" />
            </label>
            <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
              <span>Dark theme</span>
              <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} className="w-4 h-4" />
            </label>
            <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
              <span>Magnet (snap to candle prices)</span>
              <input type="checkbox" checked={magnet} onChange={(e) => setMagnet(e.target.checked)} className="w-4 h-4" />
            </label>
            <label className="flex items-center justify-between py-1.5 text-sm">
              <span>Drawing colour</span>
              <input
                type="color"
                value={drawColor}
                onChange={(e) => setDrawColor(e.target.value)}
                className="w-9 h-7 p-0 border-0 bg-transparent cursor-pointer"
              />
            </label>
            <button onClick={clearAll} className={`mt-2 w-full text-xs py-1.5 rounded-md border ${btn}`}>
              Remove all drawings on this market
            </button>
            <button onClick={resetLayout} className={`mt-2 w-full text-xs py-1.5 rounded-md border ${btn}`}>
              Reset everything
            </button>
            <p className="text-[10px] opacity-50 mt-2">
              Charts powered by TradingView Lightweight Charts · market data from Deriv. Drawings and
              settings are saved on this device.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}