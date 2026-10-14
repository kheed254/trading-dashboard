import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  startDerivLogin,
  exchangeCodeForToken,
  saveAccessToken,
} from '../lib/auth';
import { useMultiTicks, type SymbolCode } from '../lib/deriv';

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

const IconCheck = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

const IconArrow = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const FEATURES = [
  {
    Icon: IconBolt,
    title: 'Live market data',
    desc: "Real-time ticks, digit distributions, and probabilities streamed straight from Deriv's API.",
  },
  {
    Icon: IconBot,
    title: 'Visual bot builder',
    desc: 'Drag-and-drop blocks to assemble trading bots — no code required. Save and reload your strategies.',
  },
  {
    Icon: IconChart,
    title: 'Pro charts',
    desc: 'Candlestick and area charts with multiple timeframes, powered by the same engine as TradingView.',
  },
  {
    Icon: IconCopy,
    title: 'Copy trading',
    desc: 'Mirror trades from other accounts automatically. Manage followers and stake from one dashboard.',
  },
  {
    Icon: IconShield,
    title: 'Secure OAuth',
    desc: "Log in through Deriv's official OAuth — we never see or store your password.",
  },
  {
    Icon: IconBell,
    title: 'Trade reports',
    desc: 'Track P&L, win rate, and every closed trade in a clean, sortable table.',
  },
];

const STATS = [
  { value: '9+', label: 'Pages & tools' },
  { value: '6', label: 'Live data feeds' },
  { value: '∞', label: 'Strategies' },
  { value: '100%', label: 'Free to use' },
];

const WHY = [
  "Log in with Deriv's official OAuth — we never see your password",
  'Live ticks and digit statistics from the Deriv API',
  'Visual bot builder with save and reload',
  'Bulk Trader and Manual Trader for quick entries',
  'Practice on a demo account before going live',
  'Works on your phone and on desktop',
];

/* ---------- Live ticker strip ---------- */
const TICKER: { code: SymbolCode; label: string }[] = [
  { code: 'R_10', label: 'VOL 10' },
  { code: 'R_25', label: 'VOL 25' },
  { code: 'R_50', label: 'VOL 50' },
  { code: 'R_75', label: 'VOL 75' },
  { code: 'R_100', label: 'VOL 100' },
  { code: '1HZ10V', label: 'VOL 10 (1S)' },
  { code: '1HZ100V', label: 'VOL 100 (1S)' },
];
const TICKER_CODES = TICKER.map((t) => t.code);

function TickerStrip() {
  const { ticks } = useMultiTicks(TICKER_CODES);

  const renderItems = (keyPrefix: string) =>
    TICKER.map((t) => {
      const entry = ticks[t.code];
      const price = entry?.price ?? null;
      const h = entry?.history ?? [];
      const dir = h.length >= 2 ? h[h.length - 1] - h[h.length - 2] : 0;
      return (
        <div
          key={`${keyPrefix}-${t.code}`}
          className="flex items-center gap-2 px-6 border-r border-white/5 whitespace-nowrap"
        >
          <span className="text-[11px] font-bold tracking-wider text-blue-400/80">{t.label}</span>
          <span
            className={`text-[11px] font-mono font-semibold ${
              price === null ? 'text-white/30' : dir > 0 ? 'text-emerald-400' : dir < 0 ? 'text-red-400' : 'text-white/80'
            }`}
          >
            {price !== null ? price.toFixed(2) : '---'}
            {price !== null && dir !== 0 ? (dir > 0 ? ' ▲' : ' ▼') : ''}
          </span>
        </div>
      );
    });

  return (
    <div className="bg-[#050a18] border-b border-white/5 overflow-hidden">
      <div className="sfx-marquee py-2">
        {renderItems('a')}
        {renderItems('b')}
      </div>
      <style>{`
        @keyframes sfx-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .sfx-marquee { display: flex; width: max-content; animation: sfx-marquee 45s linear infinite; }
        .sfx-marquee:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}

export default function Landing() {
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authOk, setAuthOk] = useState(false);

  /* On page load — if Deriv redirected back with ?code=..., exchange it */
  useEffect(() => {
    /* Show a hint that we're processing */
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) setAuthBusy(true);

    exchangeCodeForToken().then((result) => {
      if (!result) return; // no code in URL, nothing to do

      if (result.ok) {
        saveAccessToken(result.access_token);
        setAuthBusy(false);
        setAuthOk(true);
        /* Give the user a moment to see the success state, then go to dashboard */
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        setAuthBusy(false);
        setAuthErr(result.error);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#070d1f] text-white">
      {/* ============ LIVE TICKER ============ */}
      <TickerStrip />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 pt-12 pb-10 text-center">
          <div className="inline-flex items-center gap-2 border border-teal-500/30 bg-teal-500/5 rounded-full px-4 py-1.5 text-xs text-teal-200 mb-8">
            <IconShield />
            <span>Built on Deriv&apos;s official API</span>
          </div>

          {/* Auth status banners */}
          <div className="flex flex-col items-center">
            {authBusy && (
              <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-400/40 rounded-full px-4 py-2 text-sm mb-4">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Completing login…
              </div>
            )}
            {authOk && (
              <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-400/40 rounded-full px-4 py-2 text-sm mb-4">
                ✓ Logged in — taking you to the dashboard…
              </div>
            )}
            {authErr && (
              <div className="bg-red-500/20 border border-red-400/40 rounded-lg px-4 py-3 text-sm mb-4 max-w-xl">
                ⚠️ {authErr}
              </div>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
            Trade with{' '}
            <span className="bg-gradient-to-r from-teal-300 to-emerald-400 bg-clip-text text-transparent">
              better tools
            </span>
            <span className="inline-block w-[3px] h-[0.85em] bg-teal-400 ml-1 align-middle animate-pulse" />
          </h1>

          <p className="text-base md:text-lg text-white/65 leading-relaxed mb-9 max-w-2xl mx-auto">
            Real-time market analysis, a visual bot builder, and professional
            charts — all in one free platform for Deriv traders.
          </p>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={startDerivLogin}
              disabled={authBusy}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 disabled:opacity-60 text-white font-bold px-8 py-3.5 rounded-full transition shadow-lg shadow-emerald-500/30"
            >
              Start Trading Now
              <IconArrow />
            </button>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={startDerivLogin}
                disabled={authBusy}
                className="border border-white/20 hover:bg-white/10 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2 rounded-full transition"
              >
                Sign up
              </button>
              <Link
                to="/dashboard"
                className="text-sm text-white/70 hover:text-white underline-offset-4 hover:underline"
              >
                View live demo →
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-white/55 mt-1">
              <span className="inline-flex items-center gap-1.5 text-white/55">
                <span className="text-emerald-400"><IconCheck /></span> No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-400"><IconCheck /></span> Practice on a demo account
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE CARDS ============ */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-12">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="relative bg-[#0d1530] border border-white/10 rounded-2xl px-6 pt-12 pb-7 text-center hover:border-teal-400/40 transition"
            >
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#0f4d6e] border border-teal-300/40 flex items-center justify-center text-teal-200 shadow-[0_0_28px_rgba(20,184,166,0.35)]">
                <f.Icon />
              </div>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-wrap justify-center gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full border border-white/10 bg-[#0d1530] flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.12)]">
                <span className="text-xl font-extrabold text-emerald-400">{s.value}</span>
              </div>
              <span className="text-xs text-white/55">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ WHY STINGERFX ============ */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <div className="bg-[#0a1226] border border-white/10 rounded-3xl px-6 py-12">
          <div className="text-center mb-10">
            <span className="inline-block text-[10px] font-bold tracking-widest text-teal-300 border border-teal-400/30 bg-teal-400/5 rounded-full px-3 py-1 mb-4">
              WHY STINGERFX
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-2">Why choose StingerFX?</h2>
            <p className="text-sm text-white/55">Simple tools for traders who want more control.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
            {WHY.map((w) => (
              <div
                key={w}
                className="flex items-center gap-3 bg-[#0d1530] border border-white/10 rounded-lg px-4 py-3 text-xs text-white/80"
              >
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center flex-shrink-0">
                  <IconCheck />
                </span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-[#0a1a38] to-[#071427] px-6 py-14 text-center">
          <div
            className="absolute inset-y-0 left-1/4 w-1/2 bg-teal-400/[0.07] pointer-events-none"
            style={{ transform: 'skewX(-30deg)' }}
          />
          <div className="relative">
            <span className="inline-block text-[10px] font-bold tracking-widest text-teal-300 border border-teal-400/30 bg-teal-400/5 rounded-full px-3 py-1 mb-4">
              GET STARTED
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-3">Ready to start?</h2>
            <p className="text-sm text-white/60 mb-7 max-w-xl mx-auto">
              Sign in with your Deriv account, explore live markets, build your
              first bot, and track your trades.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={startDerivLogin}
                disabled={authBusy}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 disabled:opacity-60 text-white font-bold px-7 py-3 rounded-full transition shadow-lg shadow-emerald-500/30"
              >
                Log in with Deriv
                <IconArrow />
              </button>
              <Link
                to="/dashboard"
                className="border border-white/20 hover:bg-white/10 text-white font-semibold px-7 py-3 rounded-full transition"
              >
                Explore the app
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ RISK DISCLAIMER ============ */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="border-t border-amber-500/30 pt-8">
          <h3 className="flex items-center gap-2 text-amber-400 font-bold mb-3">
            <span>⚠</span> Risk Disclaimer
          </h3>
          <p className="text-xs text-white/60 leading-relaxed mb-3">
            Trading derivatives and similar products involves a high level of
            risk and may not be suitable for everyone. Make sure you understand
            the risks before you trade.
          </p>
          <ul className="space-y-1.5 text-xs text-white/60 list-disc pl-5">
            <li>You can lose some or all of the money you trade with.</li>
            <li>Never trade with money you cannot afford to lose, or with borrowed money.</li>
            <li>Trading bots and automated tools do not guarantee profit.</li>
            <li>
              StingerFX is a third-party platform built on Deriv&apos;s public
              API and is not affiliated with Deriv.
            </li>
          </ul>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#050a18] text-white/70 text-sm border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="text-white font-bold text-base mb-3">
              Stinger<span className="text-brand-teal">FX</span>
            </div>
            <p className="text-xs leading-relaxed">
              A third-party trading platform built on Deriv&apos;s public
              API. Not affiliated with Deriv.
            </p>
          </div>

          <div>
            <div className="text-white font-semibold mb-3">Platform</div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/dashboard" className="hover:text-white">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/bot_builder" className="hover:text-white">
                  Bot Builder
                </Link>
              </li>
              <li>
                <Link to="/charts" className="hover:text-white">
                  Charts
                </Link>
              </li>
              <li>
                <Link to="/analysis_tool" className="hover:text-white">
                  Analysis Tool
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-white font-semibold mb-3">Tools</div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/trading_bots" className="hover:text-white">
                  Trading Bots
                </Link>
              </li>
              <li>
                <Link to="/bulk_trader" className="hover:text-white">
                  Bulk Trader
                </Link>
              </li>
              <li>
                <Link to="/manual_trader" className="hover:text-white">
                  Manual Trader
                </Link>
              </li>
              <li>
                <Link to="/copy_trading" className="hover:text-white">
                  Copy Trading
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-white font-semibold mb-3">Legal</div>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="cursor-pointer hover:text-white">Terms</span>
              </li>
              <li>
                <span className="cursor-pointer hover:text-white">
                  Privacy
                </span>
              </li>
              <li>
                <span className="cursor-pointer hover:text-white">
                  Risk Disclaimer
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 text-xs flex flex-wrap justify-between gap-2">
            <span>
              © {new Date().getFullYear()} StingerFX. All rights reserved.
            </span>
            <span className="text-amber-400">
              ⚠ Trading involves risk. Trade responsibly.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}