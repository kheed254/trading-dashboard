import { Link } from 'react-router-dom';
import { startDerivLogin } from '../lib/auth';

/* ---------- Inline SVG icons ---------- */
const IconBolt = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

const IconChart = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M3 17l6-6 4 4 8-9v5l-8 9-4-4-6 6z" />
  </svg>
);

const IconBot = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2l3 3h-2v3h2V6l3 3-3 3v-2h-2v3h2l-3 3-3-3h2v-3H9v2l-3-3 3-3v2h2V5H9l3-3z" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2l9 4v6c0 5-3.5 9.5-9 10-5.5-.5-9-5-9-10V6l9-4z" />
  </svg>
);

const IconCopy = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M8 8h11v11H8V8zm-3 3V4h11v3H8v4H5z" />
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2a6 6 0 016 6v4l2 3H4l2-3V8a6 6 0 016-6zm0 19a2 2 0 002-2h-4a2 2 0 002 2z" />
  </svg>
);

const FEATURES = [
  {
    Icon: IconBolt,
    title: 'Live market data',
    desc: 'Real-time ticks, digit distributions, and probabilities streamed straight from Deriv\'s API.',
    color: 'text-amber-500 bg-amber-50',
  },
  {
    Icon: IconBot,
    title: 'Visual bot builder',
    desc: 'Drag-and-drop blocks to assemble trading bots — no code required. Save and reload your strategies.',
    color: 'text-blue-500 bg-blue-50',
  },
  {
    Icon: IconChart,
    title: 'Pro charts',
    desc: 'Candlestick and area charts with multiple timeframes, powered by the same engine as TradingView.',
    color: 'text-teal-500 bg-teal-50',
  },
  {
    Icon: IconCopy,
    title: 'Copy trading',
    desc: 'Mirror trades from other accounts automatically. Manage followers and stake from one dashboard.',
    color: 'text-purple-500 bg-purple-50',
  },
  {
    Icon: IconShield,
    title: 'Secure OAuth',
    desc: 'Log in through Deriv\'s official OAuth — we never see or store your password.',
    color: 'text-green-500 bg-green-50',
  },
  {
    Icon: IconBell,
    title: 'Trade reports',
    desc: 'Track P&L, win rate, and every closed trade in a clean, sortable table.',
    color: 'text-red-500 bg-red-50',
  },
];

const STATS = [
  { value: '9+', label: 'Pages & tools' },
  { value: '6', label: 'Live data feeds' },
  { value: '∞', label: 'Strategies' },
  { value: '100%', label: 'Free to use' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b1c3f] via-[#12295a] to-[#0b3d91] text-white">
        {/* Decorative blur blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left column */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3 py-1 text-xs font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live trading platform
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Trade smarter with{' '}
                <span className="text-brand-teal">DerivAnalyser</span>
              </h1>

              <p className="text-lg text-white/80 leading-relaxed mb-8 max-w-xl">
                Real-time market analysis, a visual bot builder, and
                professional charts — all in one free platform built on
                Deriv&apos;s official API.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startDerivLogin}
                  className="bg-brand-teal hover:bg-teal-600 text-white font-semibold px-6 py-3 rounded-lg transition shadow-lg shadow-teal-500/30"
                >
                  Get started — it&apos;s free
                </button>
                <Link
                  to="/dashboard"
                  className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white font-semibold px-6 py-3 rounded-lg transition"
                >
                  View live demo →
                </Link>
              </div>

              <p className="text-xs text-white/60 mt-4">
                No credit card required · Works with any Deriv account
              </p>
            </div>

            {/* Right column — mock chart card */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-500 ml-2 font-mono">
                    V100 · live
                  </span>
                </div>
                <div className="p-5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Volatility 100 (1s) Index
                  </div>
                  <div className="text-3xl font-bold text-navy font-mono">
                    1234.56
                  </div>
                  <div className="text-xs text-green-600 font-medium mt-1">
                    ▲ +0.34 (0.03%)
                  </div>

                  {/* Fake mini chart */}
                  <div className="mt-4 h-32 flex items-end gap-1">
                    {[
                      40, 55, 45, 62, 48, 70, 55, 80, 60, 75, 68, 85, 72, 90,
                      78, 95,
                    ].map((h, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t ${
                          i % 2 === 0 ? 'bg-teal-400' : 'bg-red-400'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-5 text-center">
                    {[
                      { l: 'Confidence', v: '58%', c: 'text-teal-600' },
                      { l: 'Even', v: '47.6%', c: 'text-green-600' },
                      { l: 'Odd', v: '52.4%', c: 'text-red-600' },
                    ].map((s) => (
                      <div
                        key={s.l}
                        className="bg-gray-50 rounded-lg py-2"
                      >
                        <div className="text-[10px] text-gray-500 uppercase">
                          {s.l}
                        </div>
                        <div className={`text-sm font-bold ${s.c}`}>
                          {s.v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating bot badge */}
              <div className="absolute -bottom-4 -right-4 bg-white text-navy rounded-xl shadow-xl px-4 py-3 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                  <IconBot />
                </span>
                <div>
                  <div className="text-xs text-gray-400">Bot status</div>
                  <div className="text-sm font-semibold">Running · +12.4%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-navy">
                {s.value}
              </div>
              <div className="text-xs md:text-sm text-gray-500 mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-navy mb-3">
            Everything you need to trade smarter
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            From live analysis to a full bot builder — all built on top of
            Deriv&apos;s real trading API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:border-gray-200 transition"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}
              >
                <f.Icon />
              </div>
              <h3 className="font-semibold text-navy mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CTA BAND ============ */}
      <section className="bg-gradient-to-r from-[#0b1c3f] via-[#12295a] to-[#0b3d91] text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to start?
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Sign in with your Deriv account and explore live markets,
            build your first bot, and track your trades — all in seconds.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={startDerivLogin}
              className="bg-brand-teal hover:bg-teal-600 text-white font-semibold px-8 py-3 rounded-lg transition shadow-lg shadow-teal-500/30"
            >
              Log in with Deriv
            </button>
            <Link
              to="/dashboard"
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-3 rounded-lg transition"
            >
              Explore the app
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#0a1a3c] text-white/70 text-sm">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="text-white font-bold text-base mb-3">
              Deriv<span className="text-brand-teal">Analyser</span>
            </div>
            <p className="text-xs leading-relaxed">
              A third-party trading platform built on Deriv&apos;s public
              API. Not affiliated with Deriv.
            </p>
          </div>

          <div>
            <div className="text-white font-semibold mb-3">Platform</div>
            <ul className="space-y-2 text-xs">
              <li><Link to="/dashboard" className="hover:text-white">Dashboard</Link></li>
              <li><Link to="/bot_builder" className="hover:text-white">Bot Builder</Link></li>
              <li><Link to="/charts" className="hover:text-white">Charts</Link></li>
              <li><Link to="/analysis_tool" className="hover:text-white">Analysis Tool</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-white font-semibold mb-3">Tools</div>
            <ul className="space-y-2 text-xs">
              <li><Link to="/trading_bots" className="hover:text-white">Trading Bots</Link></li>
              <li><Link to="/bulk_trader" className="hover:text-white">Bulk Trader</Link></li>
              <li><Link to="/manual_trader" className="hover:text-white">Manual Trader</Link></li>
              <li><Link to="/copy_trading" className="hover:text-white">Copy Trading</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-white font-semibold mb-3">Legal</div>
            <ul className="space-y-2 text-xs">
              <li><span className="cursor-pointer hover:text-white">Terms</span></li>
              <li><span className="cursor-pointer hover:text-white">Privacy</span></li>
              <li><span className="cursor-pointer hover:text-white">Risk Disclaimer</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 text-xs flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} DerivAnalyser. All rights reserved.</span>
            <span className="text-amber-400">
              ⚠ Trading involves risk. Trade responsibly.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}