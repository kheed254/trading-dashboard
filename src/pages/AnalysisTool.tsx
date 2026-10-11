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

  const symbol = MARKET_MAP[marketName] as any;
  const { price, currentDigit, digits, connected } = useDigitStream(symbol, ticksWindow);

  /* ---- Digit stats ---- */
  const digitStats = useMemo(() => computeDigitStats(digits), [digits]);

  /* Determine hottest digit (highest %) */
  const hottestDigit = useMemo(() => {
    if (!digitStats.length) return null;
    return digitStats.reduce((max, d) => (d.pct > max.pct ? d : max), digitStats[0]).digit;
  }, [digitStats]);

  /* Ring color rules:
     - Orange = hottest digit (highest %)
     - Green = even digit
     - Red = odd digit
     - Gray = default */
  const getRingColor = (digit: number) => {
    if (digit === hottestDigit) return { stroke: '#f97316', bg: '#fff7ed' };
    if (digit % 2 === 0) return { stroke: '#10b981', bg: '#ecfdf5' };
    return { stroke: '#ef4444', bg: '#fef2f2' };
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
        {/* ============ TRADING CONFIGURATION (right) ============ */}
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
        <div className="mb-5">
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
      </div>

      {/* ============ BOTTOM DOCK (Bot is not running) ============ */}
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

      {/* ============ FLOATING AI BUTTON ============ */}
      <button className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold shadow-lg flex items-center justify-center z-10">
        AI
      </button>

      {/* ============ RISK DISCLAIMER PILL ============ */}
      <button
        onClick={() => alert('Trading derivatives involves significant risk. Only trade with money you can afford to lose.')}
        className="fixed bottom-20 left-4 bg-yellow-400 hover:bg-yellow-500 text-navy text-[11px] font-bold px-3 py-1.5 rounded shadow-md z-10"
      >
        Risk Disclaimer
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