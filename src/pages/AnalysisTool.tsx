import { useMemo, useState, useEffect } from 'react';
import { useDigitStream } from '../lib/deriv';
import { computeDigitStats } from '../lib/digitStats';

/* ---------- Config ---------- */
const MARKET_MAP: Record<string, string> = {
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 30 (1s) Index': '1HZ30V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
  'Volatility 15 (1s) Index': '1HZ15V',
  'Volatility 90 (1s) Index': '1HZ90V',
  'Volatility 10 Index': 'R_10',
  'Volatility 25 Index': 'R_25',
  'Volatility 50 Index': 'R_50',
  'Volatility 75 Index': 'R_75',
  'Volatility 100 Index': 'R_100',
  'Jump 10 Index': 'JD10',
  'Jump 25 Index': 'JD25',
  'Jump 50 Index': 'JD50',
  'Jump 75 Index': 'JD75',
  'Jump 100 Index': 'JD100',
};

const MARKETS = Object.keys(MARKET_MAP);

/* Show percentages without trailing zeros: 8.10 -> 8.1, 10.00 -> 10, 0.00 -> 0 */
const fmtPct = (n: number) => `${parseFloat(n.toFixed(2))}%`;

/* Don't mark most/least digits until there are enough ticks to be meaningful */
const MIN_TICKS_FOR_MARKS = 20;

const TABS = ['Dcircles', 'Signals', 'Analysis Tool', 'DP Tools', 'Smart Analysis'] as const;
type Tab = typeof TABS[number];

const STRATEGIES = [
  'Matches & Differs',
  'Over & Under',
  'Even & Odd',
  'Rise & Fall',
];

/* ---------- Component ---------- */
export default function AnalysisTool() {
  const [activeTab, setActiveTab] = useState<Tab>('Dcircles');

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      {/* ============ TAB PILLS ============ */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto tab-scroll">
        <div className="flex gap-2 px-3 py-3 min-w-max">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeTab === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ============ TAB CONTENT ============ */}
      {activeTab === 'Dcircles' && <DcirclesTab />}
      {activeTab === 'Signals' && <SignalsTab />}

      {activeTab !== 'Dcircles' && activeTab !== 'Signals' && (
        <div className="px-4 py-20 text-center text-gray-400 text-sm">
          <div className="text-4xl mb-3">🚧</div>
          <div className="font-semibold text-gray-600 mb-1">{activeTab}</div>
          <div>Coming soon</div>
        </div>
      )}

      {/* ============ BOTTOM DOCK (same look as the Bot Builder run bar) ============ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] z-20">
        <div className="flex items-stretch px-3 py-2">
          <button className="bg-[#4db3b0] hover:bg-[#3f9f9c] text-white font-bold text-lg px-5 py-2.5 rounded-l-md flex items-center gap-2.5 shrink-0 transition">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
            Run
          </button>
          <div className="flex-1 min-w-0 border border-gray-200 border-l-0 rounded-r-md bg-white px-3 py-1.5 flex flex-col justify-center">
            <div className="text-[13px] font-bold text-gray-900 text-center truncate mb-2">
              Bot is not running
            </div>
            <div className="relative h-1 bg-gray-200 rounded-full">
              <span className="absolute top-0 left-0 w-1 h-1 bg-gray-700 rounded-full" />
              <span className="absolute top-0 left-1/2 w-1 h-1 bg-gray-700 rounded-full" />
              <span className="absolute top-0 right-0 w-1 h-1 bg-gray-700 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tab-scroll::-webkit-scrollbar { display: none; }
        .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}

/* ================================================================
   DCIRCLES TAB
   ================================================================ */
function DcirclesTab() {
  const [marketName, setMarketName] = useState('Volatility 10 (1s) Index');
  const [ticksWindow, setTicksWindow] = useState(1000);
  const [showTradingConfig, setShowTradingConfig] = useState(false);
  const [wideEyeActive, setWideEyeActive] = useState(true);
  const [ouTarget, setOuTarget] = useState(5);
  const [mdTarget, setMdTarget] = useState(5);

  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(symbol, ticksWindow);

  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);

  /* Most and least appearing digit */
  const { highestDigit, lowestDigit } = useMemo(() => {
    if (digits.length < MIN_TICKS_FOR_MARKS || !digitStats.length) {
      return { highestDigit: -1, lowestDigit: -1 };
    }
    let hi = digitStats[0];
    let lo = digitStats[0];
    digitStats.forEach((d) => {
      if (d.pct > hi.pct) hi = d;
      if (d.pct < lo.pct) lo = d;
    });
    if (hi.pct === lo.pct) return { highestDigit: -1, lowestDigit: -1 };
    return { highestDigit: hi.digit, lowestDigit: lo.digit };
  }, [digitStats, digits.length]);

  const evenOdd = useMemo(() => {
    let even = 0, odd = 0;
    digits.forEach((d) => (d % 2 === 0 ? even++ : odd++));
    const total = even + odd || 1;
    return { even, odd, evenPct: (even / total) * 100, oddPct: (odd / total) * 100 };
  }, [digits]);

  const overUnder = useMemo(() => {
    let under = 0, equal = 0, over = 0;
    digits.forEach((d) => {
      if (d < ouTarget) under++;
      else if (d === ouTarget) equal++;
      else over++;
    });
    const total = digits.length || 1;
    return {
      under, equal, over,
      underPct: (under / total) * 100,
      equalPct: (equal / total) * 100,
      overPct: (over / total) * 100,
    };
  }, [digits, ouTarget]);

  const matchesDiffers = useMemo(() => {
    let matches = 0, differs = 0;
    digits.forEach((d) => (d === mdTarget ? matches++ : differs++));
    const total = digits.length || 1;
    return {
      matches, differs,
      matchesPct: (matches / total) * 100,
      differsPct: (differs / total) * 100,
    };
  }, [digits, mdTarget]);

  const recentEO = useMemo(() => digits.slice(-12).map((d) => (d % 2 === 0 ? 'E' : 'O')), [digits]);
  const recentUO = useMemo(
    () => digits.slice(-12).map((d) => (d < ouTarget ? 'U' : d === ouTarget ? '=' : 'O')),
    [digits, ouTarget]
  );
  const recentMD = useMemo(() => digits.slice(-12).map((d) => (d === mdTarget ? 'M' : 'D')), [digits, mdTarget]);

  const pillStyle = (kind: string) => {
    switch (kind) {
      case 'E': case 'U': case 'M': return 'bg-teal-500 text-white';
      case 'O': return 'bg-red-500 text-white';
      case '=': case 'D': return 'bg-gray-500 text-white';
      default: return 'bg-gray-300 text-white';
    }
  };

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowTradingConfig(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition"
        >
          Trading Configuration
        </button>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setWideEyeActive((x) => !x)}
          className={`px-5 py-2.5 rounded-full text-sm font-bold text-white transition shadow-sm ${
            wideEyeActive
              ? 'bg-gradient-to-r from-red-500 via-orange-400 to-teal-400'
              : 'bg-gray-300'
          }`}
        >
          Wide Eye
        </button>
        <button
          onClick={() => alert('Launch AI coming soon')}
          className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 shadow-sm hover:opacity-90 transition"
        >
          Launch AI
        </button>
        <button
          onClick={() => alert('Info: This shows live digit analysis for the selected market.')}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 text-xs font-bold hover:bg-gray-50"
          title="Info"
        >
          i
        </button>
        <div className="ml-auto flex items-center gap-1.5 text-sm text-gray-500">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          Live
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Market:</label>
        <select
          value={marketName}
          onChange={(e) => setMarketName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white outline-none focus:border-blue-500"
        >
          {MARKETS.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
      </div>

      <div className="bg-gray-50 rounded-xl px-5 py-6 mb-5 flex items-center justify-between">
        <div className="text-3xl md:text-4xl font-bold text-navy font-mono tabular-nums">
          {price !== null ? price.toFixed(2) : '—'}
        </div>
        <div className="text-5xl md:text-6xl font-bold text-blue-500 font-mono tabular-nums">
          {currentDigit !== null ? currentDigit : '—'}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Ticks window:</label>
          <input
            type="number"
            min={50}
            max={5000}
            value={ticksWindow}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTicksWindow(Math.max(50, Math.min(5000, v || 1000)));
            }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 font-mono text-center"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">(50-5000)</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-gray-700">
            Last {ticksWindow} ticks digit distribution
          </div>
          <div className="text-xs text-gray-400">{digits.length}/{ticksWindow}</div>
        </div>

        <div className="grid grid-cols-5 gap-x-2 gap-y-4">
          {digitStats.map((d) => {
            const isCurrent = d.digit === currentDigit;
            const isHigh = d.digit === highestDigit;
            const isLow = d.digit === lowestDigit;

            const wedgeColor = isHigh ? '#14b8a6' : isLow ? '#ef4444' : '#b4b8be';
            const ringColor = isHigh ? '#14b8a6' : isLow ? '#ef4444' : '#d9dce0';

            const R = 22;
            const C = 2 * Math.PI * R;
            const dash = (Math.min(100, Math.max(0, d.pct)) / 100) * C;

            return (
              <div key={d.digit} className="relative flex flex-col items-center">
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
                <div className="relative w-full max-w-[72px] aspect-square rounded-full">
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
                    <span className="text-base font-bold text-navy">{d.digit}</span>
                    <span className="text-[10px] font-bold text-navy">{fmtPct(d.pct)}</span>
                  </div>
                </div>
                <div
                  className={`h-4 mt-1 text-[10px] font-bold uppercase tracking-wide ${
                    isHigh ? 'text-teal-600' : isLow ? 'text-red-500' : ''
                  }`}
                >
                  {isHigh ? 'Most' : isLow ? 'Least' : ''}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Most appearing digit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Least appearing digit
          </span>
        </div>
      </div>

      {/* EVEN/ODD */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Even/Odd</h3>
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Even</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-navy font-mono">{evenOdd.even}</span>
                <span className="text-xs text-gray-500 ml-1.5">({evenOdd.evenPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${evenOdd.evenPct}%` }} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Odd</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-navy font-mono">{evenOdd.odd}</span>
                <span className="text-xs text-gray-500 ml-1.5">({evenOdd.oddPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${evenOdd.oddPct}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-2">Recent E/O</div>
          <div className="flex flex-wrap gap-1.5">
            {recentEO.map((k, i) => (
              <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${pillStyle(k)}`}>{k}</span>
            ))}
          </div>
        </div>
      </div>

      {/* OVER/UNDER */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Over/Under</h3>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-700 whitespace-nowrap">Over/Under:</label>
          <select
            value={ouTarget}
            onChange={(e) => setOuTarget(Number(e.target.value))}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 font-mono text-center"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </div>
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Under</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-navy font-mono">{overUnder.under}</span>
                <span className="text-xs text-gray-500 ml-1.5">({overUnder.underPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${overUnder.underPct}%` }} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Equal</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-navy font-mono">{overUnder.equal}</span>
                <span className="text-xs text-gray-500 ml-1.5">({overUnder.equalPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gray-500 transition-all" style={{ width: `${overUnder.equalPct}%` }} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Over</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-navy font-mono">{overUnder.over}</span>
                <span className="text-xs text-gray-500 ml-1.5">({overUnder.overPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${overUnder.overPct}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-2">Recent U/= /O</div>
          <div className="flex flex-wrap gap-1.5">
            {recentUO.map((k, i) => (
              <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${pillStyle(k)}`}>{k}</span>
            ))}
          </div>
        </div>
      </div>

      {/* MATCHES/DIFFERS */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Matches/Differs</h3>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-700 whitespace-nowrap">Digit:</label>
          <select
            value={mdTarget}
            onChange={(e) => setMdTarget(Number(e.target.value))}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 font-mono text-center"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </div>
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Matches</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-navy font-mono">{matchesDiffers.matches}</span>
                <span className="text-xs text-gray-500 ml-1.5">({matchesDiffers.matchesPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${matchesDiffers.matchesPct}%` }} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Differs</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-navy font-mono">{matchesDiffers.differs}</span>
                <span className="text-xs text-gray-500 ml-1.5">({matchesDiffers.differsPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${matchesDiffers.differsPct}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-2">Recent M/D</div>
          <div className="flex flex-wrap gap-1.5">
            {recentMD.map((k, i) => (
              <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${pillStyle(k)}`}>{k}</span>
            ))}
          </div>
        </div>
      </div>

      {showTradingConfig && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={() => setShowTradingConfig(false)}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-navy mb-3">Trading Configuration</h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure which digit properties you want to monitor.
            </p>
            <button
              onClick={() => setShowTradingConfig(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SIGNALS TAB (POLISH #11 APPLIED)
   ================================================================ */
function SignalsTab() {
  const [strategy, setStrategy] = useState('Matches & Differs');
  const [marketName, setMarketName] = useState('Volatility 10 Index');
  const [showTradingConfig, setShowTradingConfig] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const symbol = MARKET_MAP[marketName] as any;
  // POLISH #11: grab `connected` from the hook
  const { price, currentDigit, digits, connected } = useDigitStream(symbol, 1000);

  const targetDigit = 5;

  const analyze = () => {
    let matches = 0, differs = 0;
    digits.forEach((d) => (d === targetDigit ? matches++ : differs++));
    const total = digits.length || 1;
    const matchPct = (matches / total) * 100;
    const differPct = (differs / total) * 100;

    const lines = [
      `Analysis Dashboard - ${strategy} on ${symbol}`,
      `Analysis Complete!`,
      `MATCH with ${targetDigit} (${matchPct.toFixed(2)}% accuracy)`,
      `DIFFERS with ${targetDigit} (${differPct.toFixed(2)}% accuracy)`,
      `Running bot in 5 seconds...`,
    ];
    setTerminalLines(lines);
    setTerminalOpen(true);
    setCountdown(5);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setTerminalLines((prev) => [...prev, 'Bot activated!']);
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => {
      setTerminalLines((prev) => [
        ...prev.filter((l) => !l.startsWith('Running bot in')),
        `Running bot in ${countdown - 1} seconds...`,
      ]);
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowTradingConfig(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition"
        >
          Trading Configuration
        </button>
      </div>

      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl mb-4"
        style={{
          background: 'linear-gradient(135deg, #000000 0%, #0a1a0a 100%)',
          minHeight: '520px',
        }}
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><text x='0' y='20' font-family='monospace' font-size='11' fill='%2300ff00'>[INFO]</text><text x='0' y='40' font-family='monospace' font-size='11' fill='%2300ff00'>[OK]</text></svg>")`,
            backgroundRepeat: 'repeat',
          }}
        />

        <h2
          className="relative text-center pt-6 pb-4 text-4xl font-extrabold tracking-wider"
          style={{
            color: '#ff1744',
            textShadow: '0 0 10px #ff1744, 0 0 20px #ff1744, 0 0 30px #b71c1c',
            fontFamily: 'Georgia, serif',
          }}
        >
          Signal Analyzer
        </h2>

        <div className="relative px-6 pb-6">
          <div className="mb-5">
            <div className="text-center text-gray-200 text-sm font-semibold mb-2 drop-shadow-md">
              Select Strategy
            </div>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-base font-bold outline-none cursor-pointer appearance-none text-center"
              style={{
                background: '#0a0a0a',
                color: '#ff1744',
                border: '1px solid #2a2a2a',
                boxShadow: 'inset 0 0 20px rgba(255,23,68,0.15)',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff1744'><path d='M7 10l5 5 5-5z'/></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '20px',
              }}
            >
              {STRATEGIES.map((s) => (<option key={s} value={s} style={{ background: '#0a0a0a' }}>{s}</option>))}
            </select>
          </div>

          <div className="mb-6">
            <div className="text-center text-gray-200 text-sm font-semibold mb-2 drop-shadow-md">
              Select Market
            </div>
            <select
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-base font-bold outline-none cursor-pointer appearance-none text-center"
              style={{
                background: '#0a0a0a',
                color: '#ff1744',
                border: '1px solid #2a2a2a',
                boxShadow: 'inset 0 0 20px rgba(255,23,68,0.15)',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff1744'><path d='M7 10l5 5 5-5z'/></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '20px',
              }}
            >
              {MARKETS.map((m) => (<option key={m} value={m} style={{ background: '#0a0a0a' }}>{m}</option>))}
            </select>
          </div>

          <div
            className="rounded-lg px-4 py-6 mb-6 text-center"
            style={{
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid #1a3a1a',
              boxShadow: 'inset 0 0 30px rgba(0,255,0,0.08)',
            }}
          >
            <div
              className="text-2xl font-bold mb-3"
              style={{
                color: '#00ff41',
                textShadow: '0 0 8px #00ff41, 0 0 16px #00ff41',
                fontFamily: 'monospace',
              }}
            >
              Latest Tick: {price !== null ? price.toFixed(2) : '--'}
            </div>
            <div
              className="text-2xl font-bold"
              style={{
                color: '#00ff41',
                textShadow: '0 0 8px #00ff41, 0 0 16px #00ff41',
                fontFamily: 'monospace',
              }}
            >
              Last Digit: {currentDigit !== null ? currentDigit : '--'}
            </div>
          </div>

          {/* POLISH #11: Analyse button — disabled until socket ready + 50 ticks */}
          <button
            onClick={analyze}
            disabled={!connected || digits.length < 50}
            className={`w-full py-3.5 rounded-lg font-bold text-white text-base shadow-lg transition ${
              !connected || digits.length < 50
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:opacity-90 active:scale-[0.98]'
            }`}
            style={
              !connected || digits.length < 50
                ? { background: '#333' }
                : {
                    background: 'linear-gradient(135deg, #00c853 0%, #00e676 100%)',
                    boxShadow: '0 0 20px rgba(0,230,118,0.5)',
                  }
            }
          >
            {!connected ? 'Connecting…' : digits.length < 50 ? `Collecting… (${digits.length}/50)` : 'Analyse'}
          </button>
        </div>

        {terminalOpen && (
          <div
            className="absolute inset-4 rounded-lg z-20 flex flex-col overflow-hidden"
            style={{
              background: '#000000',
              border: '2px solid #1a3a1a',
              boxShadow: '0 0 40px rgba(0,255,0,0.3)',
            }}
          >
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-green-900/40">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <button
                onClick={() => { setTerminalOpen(false); setCountdown(null); }}
                className="ml-auto w-7 h-7 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div
              className="flex-1 p-4 overflow-y-auto text-sm leading-relaxed"
              style={{ fontFamily: 'monospace' }}
            >
              {terminalLines.map((line, i) => (
                <div
                  key={i}
                  className="mb-1.5"
                  style={{
                    color: line.includes('Bot activated') ? '#00ff41'
                      : line.startsWith('Running bot in') ? '#00ff41'
                      : line.includes('DIFFERS') ? '#00ff41'
                      : '#00c853',
                    textShadow: '0 0 4px rgba(0,255,65,0.4)',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showTradingConfig && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={() => setShowTradingConfig(false)}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-navy mb-3">Trading Configuration</h3>
            <p className="text-sm text-gray-600 mb-4">Configure your analysis parameters.</p>
            <button
              onClick={() => setShowTradingConfig(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}