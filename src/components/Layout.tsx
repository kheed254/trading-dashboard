import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { startDerivLogin } from '../lib/auth';

/* ---------- Inline SVG icons ---------- */
const IconDashboard = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 3h8v5h-8v-5z" />
  </svg>
);

const IconBotBuilder = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2l3 3h-2v3h2V6l3 3-3 3v-2h-2v3h2l-3 3-3-3h2v-3H9v2l-3-3 3-3v2h2V5H9l3-3z" />
  </svg>
);

const IconTradingBots = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M5 3h14v4H5V3zm0 7h14v4H5v-4zm0 7h14v4H5v-4z" />
  </svg>
);

const IconBulkTrader = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M4 18l5-6 4 4 7-9v4l-7 9-4-4-5 6z" />
  </svg>
);

const IconAnalysis = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M4 20V10h3v10H4zm6 0V4h3v16h-3zm6 0v-8h3v8h-3z" />
  </svg>
);

const IconCharts = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M3 17l6-6 4 4 8-9v5l-8 9-4-4-6 6z" />
  </svg>
);

const IconReports = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M6 2h9l5 5v15H6V2zm8 1v5h5" />
  </svg>
);

const IconManualTrader = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M4 6h16v3H4V6zm0 5h10v3H4v-3zm0 5h16v3H4v-3z" />
  </svg>
);

const IconCopyTrading = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M8 8h11v11H8V8zm-3 3V4h11v3H8v4H5z" />
  </svg>
);

/* ---------- Nav items with icons ---------- */
const navItems = [
  { label: 'Dashboard', to: '/', Icon: IconDashboard },
  { label: 'Bot Builder', to: '/bot_builder', Icon: IconBotBuilder },
  { label: 'Trading Bots', to: '/trading_bots', Icon: IconTradingBots },
  { label: 'Bulk Trader', to: '/bulk_trader', Icon: IconBulkTrader },
  { label: 'Analysis Tool', to: '/analysis_tool', Icon: IconAnalysis },
  { label: 'Charts', to: '/charts', Icon: IconCharts },
  { label: 'Reports', to: '/reports', Icon: IconReports },
  { label: 'Manual Trader', to: '/manual_trader', Icon: IconManualTrader },
  { label: 'Copy Trading', to: '/copy_trading', Icon: IconCopyTrading },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============ TOP NAV ============ */}
      <header className="bg-navy text-white sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-3 sm:px-6 h-14 gap-2">
          {/* Left: logo + desktop tabs */}
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <NavLink
              to="/"
              className="text-lg sm:text-xl font-bold whitespace-nowrap shrink-0"
            >
              Deriv<span className="text-brand-teal">Analyser</span>
            </NavLink>

            {/* Desktop nav */}
            <nav className="hidden xl:flex items-center gap-0.5 text-[13px]">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-2.5 py-4 transition whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? 'border-b-2 border-red-500 font-medium'
                        : 'hover:text-brand-teal'
                    }`
                  }
                >
                  <item.Icon />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: auth buttons + mobile hamburger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={startDerivLogin}
              className="hidden sm:block text-xs sm:text-sm px-3 sm:px-4 py-1.5 border border-white/40 rounded-full hover:bg-white/10 whitespace-nowrap"
            >
              Log in
            </button>
            <button
              onClick={startDerivLogin}
              className="hidden sm:block text-xs sm:text-sm px-3 sm:px-4 py-1.5 bg-brand-pink text-navy rounded-full font-semibold hover:opacity-90 whitespace-nowrap"
            >
              Sign up
            </button>

            {/* Hamburger — visible below xl */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="xl:hidden p-2 rounded hover:bg-white/10"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ============ MOBILE DRAWER ============ */}
        {mobileOpen && (
          <nav className="xl:hidden border-t border-white/10 bg-navy max-h-[80vh] overflow-y-auto">
            {navItems.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 text-sm ${
                    isActive
                      ? 'bg-white/10 text-brand-teal font-semibold'
                      : 'text-white/90 hover:bg-white/5'
                  }`}
                >
                  <item.Icon />
                  {item.label}
                </NavLink>
              );
            })}
            {/* Auth buttons inside drawer for mobile */}
            <div className="flex gap-2 p-4 sm:hidden">
              <button
                onClick={startDerivLogin}
                className="flex-1 text-sm px-3 py-2 border border-white/40 rounded-full hover:bg-white/10"
              >
                Log in
              </button>
              <button
                onClick={startDerivLogin}
                className="flex-1 text-sm px-3 py-2 bg-brand-pink text-navy rounded-full font-semibold"
              >
                Sign up
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* PAGE CONTENT */}
      <Outlet />
    </div>
  );
}