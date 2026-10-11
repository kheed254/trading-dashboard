import { useMemo, useState } from 'react';
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
  'Volatility 10 Index': 'R_10',
  'Volatility 25 Index': 'R_25',
  'Volatility 50 Index': 'R_50',
  'Volatility 75 Index': 'R_75',
  'Volatility 100 Index': 'R_100',
};

const MARKETS = Object.keys(MARKET_MAP);

const TABS = ['Dcircles', 'Signals', 'Analysis Tool', 'DP Tools', 'Smart Analysis'] as const;
type Tab = typeof TABS[number];

/* ---------- Component ---------- */
export default function AnalysisTool() {
  const [activeTab, setActiveTab] = useState<Tab>('Dcircles');
  const [marketName, setMarketName] = useState('Volatility 10 (1s) Index');
  const [ticksWindow, setTicksWindow] = useState(1000);
  const [showTradingConfig, setShowTradingConfig] = useState(false);
  const [wideEyeActive, setWideEyeActive] = useState(true);
  const [ouTarget, setOuTarget] = useState(5);
  const [mdTarget, setMdTarget] = useState(5);

  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(symbol, ticksWindow);

  /* ---- Digit stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);

  /* ---- Hottest digit ---- */
  const hottestDigit = useMemo(() => {
    if (!digitStats.length) return null;
    return digitStats.reduce((max, d) => (d.pct > max.pct ? d : max), digitStats[0]).digit;
  }, [digitStats]);

  /* ---- Even/Odd ---- */
  const evenOdd = useMemo(() => {
    let even = 0, odd = 0;
    digits.forEach((d) => (d % 2 === 0 ? even++ : odd++));
    const total = even + odd || 1;
    return {
      even,
      odd,
      evenPct: (even / total) * 100,
      oddPct: (odd / total) * 100,
    };
  }, [digits]);

  /* ---- Over/Under/Equal (against ouTarget) ---- */
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

  /* ---- Matches/Differs (against mdTarget) ---- */
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

  /* ---- Recent sequences (last 12 ticks) ---- */
  const recentEO = useMemo(() => digits.slice(-12).map((d) => (d % 2 === 0 ? 'E' : 'O')), [digits]);
  const recentUO = useMemo(
    () => digits.slice(-12).map((d) => (d < ouTarget ? 'U' : d === ouTarget ? '=' : 'O')),
    [digits, ouTarget]
  );
  const recentMD = useMemo(() => digits.slice(-12).map((d) => (d === mdTarget ? 'M' : 'D')), [digits, mdTarget]);

  /* ---- Ring color ---- */
  const getRingColor = (digit: number) => {
    if (digit === hottestDigit) return { stroke: '#f97316', bg: '#fff7ed' };
    if (digit % 2 === 0) return { stroke: '#10b981', bg: '#ecfdf5' };
    return { stroke: '#ef4444', bg: '#fef2f2' };
  };

  /* ---- Pill style for E/O, U/= /O, M/D ---- */
  const pillStyle = (kind: string) => {
    switch (kind) {
      case 'E':
      case 'U':
      case 'M':
        return 'bg-teal-500 text-white';
      case 'O':
        return 'bg-red-500 text-white';
      case '=':
      case 'D':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-300 text-white';
    }
  };

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

      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* ============ TRADING CONFIGURATION ============ */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowTradingConfig(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition"
          >
            Trading Configuration
          </button>
        </div>

        {/* ============ WIDE EYE / LAUNCH AI ROW ============ */}
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

        {/* ============ SELECT MARKET ============ */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Market:</label>
          <select
            value={marketName}
            onChange={(e) => setMarketName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white outline-none focus:border-blue-500"
          >
            {MARKETS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* ============ LIVE PRICE PANEL ============ */}
        <div className="bg-gray-50 rounded-xl px-5 py-6 mb-5 flex items-center justify-between">
          <div className="text-3xl md:text-4xl font-bold text-navy font-mono tabular-nums">
            {price !== null ? price.toFixed(2) : '—'}
          </div>
          <div className="text-5xl md:text-6xl font-bold text-blue-500 font-mono tabular-nums">
            {currentDigit !== null ? currentDigit : '—'}
          </div>
        </div>

        {/* ============ TICKS WINDOW ============ */}
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

        {/* ============ DIGIT DISTRIBUTION ============ */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">
              Last {ticksWindow} ticks digit distribution
            </div>
            <div className="text-xs text-gray-400">
              {digits.length}/{ticksWindow}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {digitStats.map((d) => {
              const colors = getRingColor(d.digit);
              const r = 22;
              const strokeDasharray = 2 * Math.PI * r;
              const strokeDashoffset = strokeDasharray - (d.pct / 100) * strokeDasharray;

              return (
                <div key={d.digit} className="flex flex-col items-center">
                  <div
                    className="relative w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: colors.bg }}
                  >
                    <svg viewBox="0 0 56 56" className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle
                        cx="28" cy="28" r={r}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth="3"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="relative text-lg font-bold text-navy">
                      {d.digit}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1.5 font-medium">
                    {d.pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============ EVEN/ODD ============ */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Even/Odd</h3>

          <div className="space-y-3">
            {/* Even card */}
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

            {/* Odd card */}
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

          {/* Recent E/O */}
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-2">Recent E/O</div>
            <div className="flex flex-wrap gap-1.5">
              {recentEO.map((k, i) => (
                <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${pillStyle(k)}`}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ============ OVER/UNDER ============ */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Over/Under</h3>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-700 whitespace-nowrap">Over/Under:</label>
            <select
              value={ouTarget}
              onChange={(e) => setOuTarget(Number(e.target.value))}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 font-mono text-center"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {/* Under card */}
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

            {/* Equal card */}
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

            {/* Over card */}
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

          {/* Recent U/=/O */}
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-2">Recent U/= /O</div>
            <div className="flex flex-wrap gap-1.5">
              {recentUO.map((k, i) => (
                <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${pillStyle(k)}`}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ============ MATCHES/DIFFERS ============ */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Matches/Differs</h3>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-700 whitespace-nowrap">Digit:</label>
            <select
              value={mdTarget}
              onChange={(e) => setMdTarget(Number(e.target.value))}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 font-mono text-center"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {/* Matches card */}
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

            {/* Differs card */}
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

          {/* Recent M/D */}
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-2">Recent M/D</div>
            <div className="flex flex-wrap gap-1.5">
              {recentMD.map((k, i) => (
                <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${pillStyle(k)}`}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ BOTTOM DOCK ============ */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0b1c3f] text-white border-t border-white/10 z-20">
        <div className="flex items-center gap-2 px-3 py-2">
          <button className="bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-md flex items-center gap-2 shrink-0">
            <span className="text-xs">▶</span>
            Run
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-white/70 mb-1 truncate text-center">
              Bot is not running
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ============ RISK DISCLAIMER (standalone floating) ============ */}
      <button
        onClick={() => alert('Trading derivatives involves significant risk. Only trade with money you can afford to lose.')}
        className="fixed bottom-20 left-4 bg-yellow-400 hover:bg-yellow-500 text-navy text-[11px] font-bold px-3 py-1.5 rounded shadow-lg z-[100] hover:scale-105 transition-transform pointer-events-auto"
        aria-label="Risk Disclaimer"
      >
        Risk Disclaimer
      </button>

      {/* ============ AI BUTTON (standalone floating) ============ */}
      <button
        onClick={() => alert('AI Assistant coming soon')}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold shadow-lg flex items-center justify-center z-[100] hover:scale-105 transition-transform pointer-events-auto"
        aria-label="AI Assistant"
      >
        AI
      </button>

      {/* ============ TRADING CONFIGURATION MODAL ============ */}
      {showTradingConfig && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTradingConfig(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-navy mb-3">Trading Configuration</h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure which digit properties you want to monitor: even/odd, over/under, matches/differs, and more.
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

      <style>{`
        .tab-scroll::-webkit-scrollbar { display: none; }
        .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}