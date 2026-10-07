import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { startDerivLogin, clearAccessToken } from '../lib/auth';
import { useTicks } from '../lib/deriv';
import { useAuthWs } from '../lib/auth-ws';

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

const navItems = [
  { label: 'Dashboard', to: '/dashboard', Icon: IconDashboard },
  { label: 'Bot Builder', to: '/bot_builder', Icon: IconBotBuilder },
  { label: 'Trading Bots', to: '/trading_bots', Icon: IconTradingBots },
  { label: 'Bulk Trader', to: '/bulk_trader', Icon: IconBulkTrader },
  { label: 'Analysis Tool', to: '/analysis_tool', Icon: IconAnalysis },
  { label: 'Charts', to: '/charts', Icon: IconCharts },
  { label: 'Reports', to: '/reports', Icon: IconReports },
  { label: 'Manual Trader', to: '/manual_trader', Icon: IconManualTrader },
  { label: 'Copy Trading', to: '/copy_trading', Icon: IconCopyTrading },
];

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'real' | 'demo' | null>(null);
  const location = useLocation();

  const { price: livePrice, connected: liveConnected } = useTicks('1HZ100V');
  const { authorized, user, switchAccount } = useAuthWs();

  const tab: 'real' | 'demo' =
    activeTab ?? (user?.isVirtual ? 'demo' : 'real');

  const tabAccount = user?.accounts.find((a) => a.account_type === tab);

  const pillBalance =
    user && (tab === 'demo') === user.isVirtual
      ? user.balance
      : tabAccount?.balance ?? 0;

  const pillCurrency = tabAccount?.currency || user?.currency || 'USD';

  const handleLogout = () => {
    clearAccessToken();
    window.location.href = '/';
  };

  const handleTabClick = (t: 'real' | 'demo') => {
    setActiveTab(t);
    const acct = user?.accounts.find((a) => a.account_type === t);
    if (acct && acct.account_id !== user?.activeAccountId) {
      switchAccount(acct.account_id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-3 sm:px-6 h-14 gap-2">
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <NavLink
              to="/"
              className="text-lg sm:text-xl font-bold whitespace-nowrap shrink-0"
            >
              Stinger<span className="text-brand-teal">FX</span>
            </NavLink>

            <nav className="hidden xl:flex items-center gap-0.5 text-[13px]">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
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

          <div className="flex items-center gap-2 shrink-0">
            {/* Live V100 ticker */}
            <div
              className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full text-xs"
              title="Volatility 100 (1s) Index — live"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  liveConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`}
              />
              <span className="text-white/70 font-medium">V100</span>
              <span className="text-white font-mono font-semibold tabular-nums">
                {livePrice !== null ? livePrice.toFixed(2) : '—'}
              </span>
            </div>

            {authorized && user ? (
              <div className="relative">
                {/* ============ PILL ============ */}
                <button
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-xs sm:text-sm transition"
                >
                  {/* Flag image — same as DerivAnalyser */}
                  <span className="text-base leading-none">🇺🇸</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {fmtMoney(pillBalance)} {pillCurrency}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3.5 h-3.5 transition-transform ${
                      accountOpen ? 'rotate-180' : ''
                    }`}
                    fill="currentColor"
                  >
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>

                {/* ============ DROPDOWN ============ */}
                {accountOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[999]"
                      onClick={() => setAccountOpen(false)}
                    />
                    <div className="absolute right-0 top-[calc(100%+8px)] bg-white text-navy rounded-xl shadow-2xl w-[340px] z-[1000] overflow-hidden">
                      {/* Real / Demo tabs */}
                      <div className="flex border-b border-gray-200">
                        {(['real', 'demo'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => handleTabClick(t)}
                            className={`flex-1 py-3 text-sm font-medium transition ${
                              tab === t
                                ? 'border-b-2 border-red-500 text-navy font-semibold'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {t === 'real' ? 'Real' : 'Demo'}
                          </button>
                        ))}
                      </div>

                      {/* Collapsible "Deriv accounts" section */}
                      <div>
                        <button
                          onClick={() => setAccountsExpanded((x) => !x)}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <span>Deriv accounts</span>
                          <svg
                            viewBox="0 0 24 24"
                            className={`w-4 h-4 transition-transform ${
                              accountsExpanded ? 'rotate-180' : ''
                            }`}
                            fill="currentColor"
                          >
                            <path d="M7 10l5 5 5-5z" />
                          </svg>
                        </button>

                        {accountsExpanded && (
                          <div className="px-3 pb-3">
                            {tabAccount ? (
                              <div
                                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition ${
                                  tabAccount.account_id ===
                                  user.activeAccountId
                                    ? 'bg-gray-100'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {/* US flag emoji — matches DerivAnalyser */}
                                  <span className="text-xl leading-none">
                                    🇺🇸
                                  </span>
                                  <div>
                                    <div className="text-sm font-semibold text-navy">
                                      {tabAccount.currency}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono">
                                      {tabAccount.loginid ||
                                        tabAccount.account_id}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm font-mono font-semibold text-navy">
                                  {fmtMoney(
                                    tabAccount.account_id ===
                                      user.activeAccountId
                                      ? user.balance
                                      : tabAccount.balance
                                  )}{' '}
                                  {tabAccount.currency}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-xs text-gray-400 py-4">
                                No {tab} account on this profile.
                              </div>
                            )}

                            {tab === 'demo' && tabAccount && (
                              <button
                                onClick={() =>
                                  alert(
                                    'To reset your demo balance, please visit your Deriv dashboard.'
                                  )
                                }
                                className="w-full mt-2 border border-gray-300 hover:bg-gray-50 rounded-lg py-2 text-xs font-medium text-gray-600"
                              >
                                Reset balance
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Logout */}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 border-t border-gray-100 font-medium flex items-center justify-between"
                      >
                        <span>Logout</span>
                        <span className="text-gray-400">→</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}

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

        {mobileOpen && (
          <nav className="xl:hidden border-t border-white/10 bg-navy max-h-[80vh] overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
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

            {authorized && user ? (
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/60">Balance</div>
                  <div className="text-sm font-mono font-semibold">
                    {fmtMoney(user.balance)} {user.currency}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm px-4 py-2 border border-red-400 text-red-300 rounded-full font-semibold"
                >
                  Logout
                </button>
              </div>
            ) : (
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
            )}
          </nav>
        )}
      </header>

      <Outlet />
    </div>
  );
}