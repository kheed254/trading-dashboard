import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { startDerivLogin, clearAccessToken } from '../lib/auth';
import { useTicks } from '../lib/deriv';
import { useAuthWs } from '../lib/auth-ws';
import { useBotStatus } from '../lib/bot-status';

/* ---------- Icons ---------- */
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
const IconCashier = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M3 6h18v3H3V6zm0 5h18v8H3v-8zm3 3v2h4v-2H6z" />
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

const DemoBadge = ({ size = 28 }: { size?: number }) => (
  <span
    className="rounded-full bg-[#8fb0b8] flex items-center justify-center flex-shrink-0"
    style={{ width: size, height: size }}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size * 0.6, height: size * 0.6 }}
    >
      <path d="M7 5 L7 19" />
      <path d="M7 5 L14 5 Q20 5 20 12 Q20 19 14 19 L7 19" />
      <path d="M11 8 L11 16" />
      <path d="M11 10 L15 10" />
      <path d="M11 14 L15 14" />
    </svg>
  </span>
);

const navItems = [
  { label: 'Dashboard', to: '/dashboard', Icon: IconDashboard },
  { label: 'Bot Builder', to: '/bot_builder', Icon: IconBotBuilder },
  { label: 'Trading Bots', to: '/trading_bots', Icon: IconTradingBots },
  { label: 'Bulk Trader', to: '/bulk_trader', Icon: IconBulkTrader },
  { label: 'Analysis Tool', to: '/analysis_tool', Icon: IconAnalysis },
  { label: 'Charts', to: '/charts', Icon: IconCharts },
  { label: 'Reports', to: '/reports', Icon: IconReports },
  { label: 'Cashier', to: '/cashier', Icon: IconCashier },
  { label: 'Manual Trader', to: '/manual_trader', Icon: IconManualTrader },
  { label: 'Copy Trading', to: '/copy_trading', Icon: IconCopyTrading },
];

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Layout() {
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'real' | 'demo' | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const { price: livePrice, connected: liveConnected } = useTicks('1HZ100V');
  const { authorized, user, switchAccount } = useAuthWs();
  const { status: botStatus } = useBotStatus();

  const tab: 'real' | 'demo' = activeTab ?? (user?.isVirtual ? 'demo' : 'real');
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

  const handleDockRun = () => {
    if (location.pathname === '/bot_builder') {
      // Already on Bot Builder — dispatch the run/stop event directly
      window.dispatchEvent(new CustomEvent('sfx-toggle-run'));
    } else {
      // Navigate to Bot Builder; user taps Run there
      navigate('/bot_builder');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-navy text-white sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-3 sm:px-6 h-14 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <NavLink to="/" className="text-lg sm:text-xl font-bold whitespace-nowrap shrink-0">
              Stinger<span className="text-brand-teal">FX</span>
            </NavLink>
            <div
              className="hidden lg:flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full text-xs"
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
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {authorized && user ? (
              <div className="relative">
                <button
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-2 bg-white hover:bg-gray-50 px-2 py-1 rounded-full text-sm transition shadow-sm border border-gray-100"
                >
                  {tab === 'real' ? (
                    <span className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                      <img src="https://flagcdn.com/w80/us.png" alt="USD" className="w-full h-full object-cover" />
                    </span>
                  ) : (
                    <DemoBadge size={28} />
                  )}
                  <span className="font-mono font-bold text-brand-teal tabular-nums text-xs sm:text-sm">
                    {fmtMoney(pillBalance)} {pillCurrency}
                  </span>
                  <svg viewBox="0 0 24 24" className={`w-4 h-4 text-navy transition-transform ${accountOpen ? 'rotate-180' : ''}`} fill="currentColor">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>

                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-[45]" onClick={() => setAccountOpen(false)} />
                    <div className="absolute right-0 top-[calc(100%+8px)] bg-white text-navy rounded-xl shadow-2xl w-[300px] sm:w-[340px] z-[50] overflow-hidden">
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

                      <div>
                        <button
                          onClick={() => setAccountsExpanded((x) => !x)}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <span>Deriv account{tab === 'demo' ? '' : 's'}</span>
                          <svg viewBox="0 0 24 24" className={`w-4 h-4 transition-transform ${accountsExpanded ? 'rotate-180' : ''}`} fill="currentColor">
                            <path d="M7 10l5 5 5-5z" />
                          </svg>
                        </button>

                        {accountsExpanded && (
                          <div className="px-3 pb-3">
                            {tabAccount ? (
                              <div className={`w-full flex items-center justify-between px-3 py-3 rounded-lg ${tabAccount.account_id === user.activeAccountId ? 'bg-gray-100' : ''}`}>
                                <div className="flex items-center gap-2.5">
                                  {tabAccount.account_type === 'real' ? (
                                    <span className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                                      <img src="https://flagcdn.com/w80/us.png" alt="USD" className="w-full h-full object-cover" />
                                    </span>
                                  ) : (
                                    <DemoBadge size={32} />
                                  )}
                                  <div>
                                    <div className="text-sm font-semibold text-navy">
                                      {tabAccount.account_type === 'real' ? tabAccount.currency : 'Demo'}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono">
                                      {tabAccount.loginid || tabAccount.account_id}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm font-mono font-semibold text-navy">
                                  {fmtMoney(tabAccount.account_id === user.activeAccountId ? user.balance : tabAccount.balance)} {tabAccount.currency}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-xs text-gray-400 py-4">
                                No {tab} account on this profile.
                              </div>
                            )}

                            {tab === 'demo' && tabAccount && (
                              <button
                                onClick={() => alert('Reset from your Deriv dashboard.')}
                                className="w-full mt-2 border border-gray-300 hover:bg-gray-50 rounded-lg py-2 text-xs font-medium text-gray-600"
                              >
                                Reset balance
                              </button>
                            )}
                          </div>
                        )}
                      </div>

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
              <div className="flex items-center gap-2">
                <button
                  onClick={startDerivLogin}
                  className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 border border-white/40 rounded-full hover:bg-white/10 whitespace-nowrap"
                >
                  Log in
                </button>
                <button
                  onClick={startDerivLogin}
                  className="hidden sm:block text-xs sm:text-sm px-3 sm:px-4 py-1.5 bg-brand-pink text-navy rounded-full font-semibold hover:opacity-90 whitespace-nowrap"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>

        {/* FIXED: Navigation bar is now visible on ALL screens and horizontally scrollable */}
        <nav className="bg-navy border-t border-white/5 pointer-events-auto overflow-x-auto tab-scroll">
          <div className="flex items-center gap-0.5 text-[13px] px-2 min-w-max">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `px-3 py-3 whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
                    isActive
                      ? 'border-b-2 border-red-500 text-white font-medium'
                      : 'text-white/80 hover:text-brand-teal'
                  }`
                }
              >
                <item.Icon />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <style>{`
          .tab-scroll::-webkit-scrollbar { display: none; }
          .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </header>

      <div className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </div>

      {/* ===== BOTTOM DOCK (mobile) — always visible ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0b1c3f] text-white border-t border-white/10 md:hidden z-20">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={handleDockRun}
            className={`${
              botStatus.running
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-teal-500 hover:bg-teal-600'
            } text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-2 shrink-0 transition`}
          >
            <span className="text-xs">{botStatus.running ? '■' : '▶'}</span>
            {botStatus.running ? 'Stop' : 'Run'}
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-white/60 mb-0.5 truncate">
              {botStatus.statusText}
            </div>
            <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{ width: `${botStatus.progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={() =>
              alert(
                botStatus.running
                  ? 'Bot is running. Tap Stop to pause.'
                  : 'Bot is idle. Tap Run to start.'
              )
            }
            className="w-7 h-7 rounded-full border border-white/40 flex items-center justify-center text-white/70 text-xs shrink-0"
          >
            i
          </button>
        </div>
      </div>
    </div>
  );
}