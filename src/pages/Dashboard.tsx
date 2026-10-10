import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SignalCard from '../components/SignalCard';
import { useMultiTicks } from '../lib/deriv';
import { useAuthWs } from '../lib/auth-ws';

/* ---------- Signals data (kept from your original) ---------- */
const signals = [
  {
    id: 1,
    symbol: '1HZ30V' as const,
    market: 'Volatility 30 (1s) Index',
    badge: 'Over 4',
    badgeColor: 'teal' as const,
    confidence: 54,
    stats: [
      { label: 'Even', value: '47.3%' },
      { label: 'Odd', value: '52.7%' },
      { label: 'Over 4', value: '53.9%' },
      { label: 'Under 5', value: '46.1%' },
    ],
    cta: 'Load Over 4 Signal',
    ctaColor: 'teal' as const,
  },
  {
    id: 2,
    symbol: '1HZ25V' as const,
    market: 'Volatility 25 (1s) Index',
    badge: 'Odd',
    badgeColor: 'gray' as const,
    confidence: 53,
    stats: [
      { label: 'Even', value: '47.5%' },
      { label: 'Odd', value: '52.5%' },
      { label: 'Over 4', value: '49.3%' },
      { label: 'Under 5', value: '50.7%' },
    ],
    cta: 'Load Odd Signal',
    ctaColor: 'red' as const,
  },
  {
    id: 3,
    symbol: '1HZ75V' as const,
    market: 'Volatility 75 (1s) Index',
    badge: 'Fall',
    badgeColor: 'gray' as const,
    confidence: 53,
    stats: [
      { label: 'Rise', value: '48.2%' },
      { label: 'Fall', value: '51.8%' },
      { label: 'Over 4', value: '50.1%' },
      { label: 'Under 5', value: '49.9%' },
    ],
    cta: 'Load Fall Signal',
    ctaColor: 'red' as const,
  },
  {
    id: 4,
    symbol: '1HZ10V' as const,
    market: 'Volatility 10 (1s) Index',
    badge: 'Even',
    badgeColor: 'gray' as const,
    confidence: 52,
    stats: [
      { label: 'Even', value: '52.1%' },
      { label: 'Odd', value: '47.9%' },
      { label: 'Over 4', value: '50.4%' },
      { label: 'Under 5', value: '49.6%' },
    ],
    cta: 'Load Even Signal',
    ctaColor: 'teal' as const,
  },
];

/* ---------- Quick Action Buttons ---------- */
const QUICK_ACTIONS = [
  { label: 'Manual Trader', to: '/manual_trader', icon: '📈', color: 'from-teal-500 to-teal-600' },
  { label: 'Bulk Trader', to: '/bulk_trader', icon: '🎯', color: 'from-blue-500 to-blue-600' },
  { label: 'Bot Builder', to: '/bot_builder', icon: '🤖', color: 'from-purple-500 to-purple-600' },
  { label: 'Trading Bots', to: '/trading_bots', icon: '📊', color: 'from-amber-500 to-amber-600' },
  { label: 'Charts', to: '/charts', icon: '📉', color: 'from-pink-500 to-pink-600' },
  { label: 'Cashier', to: '/cashier', icon: '💳', color: 'from-indigo-500 to-indigo-600' },
];

export default function Dashboard() {
  const { authorized, user, error: authError, statement, requestStatement } = useAuthWs();

  const { ticks, connected } = useMultiTicks([
    '1HZ30V',
    '1HZ25V',
    '1HZ75V',
    '1HZ10V',
  ]);

  /* Debug log */
  useEffect(() => {
    if (authorized && user) {
      console.log(
        '[StingerFX] Logged in as',
        user.loginid,
        '— balance:',
        user.balance,
        user.currency,
        user.isVirtual ? '(demo)' : '(real)'
      );
    }
    if (authError) {
      console.warn('[StingerFX] Auth error:', authError);
    }
  }, [authorized, user, authError]);

  /* Request statement on mount if authorized */
  useEffect(() => {
    if (authorized) {
      requestStatement(10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  /* Format money */
  const fmtMoney = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Format relative time */
  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* ============ TOP: ACCOUNT SUMMARY ============ */}
      <section className="bg-gradient-to-br from-[#0b1c3f] via-[#12295a] to-[#0b3d91] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Greeting */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">
              Welcome back{user?.loginid ? `, ${user.loginid}` : ''} 👋
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Here's your trading overview
            </p>
          </div>

          {/* Account summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Balance card */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/60 uppercase tracking-wider font-medium">
                  Account Balance
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  user?.isVirtual 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-green-500 text-white'
                }`}>
                  {user?.isVirtual ? 'DEMO' : 'REAL'}
                </span>
              </div>
              <div className="text-3xl md:text-4xl font-bold font-mono tabular-nums">
                {user ? fmtMoney(user.balance) : '—'}
                <span className="text-lg text-white/70 ml-2">{user?.currency || 'USD'}</span>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>Connected to Deriv via WebSocket</span>
              </div>
            </div>

            {/* Account info card */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5">
              <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-2">
                Account
              </div>
              <div className="text-sm font-semibold truncate">
                {user?.loginid || 'Not logged in'}
              </div>
              <div className="text-xs text-white/60 mt-1">
                {user?.accounts.length || 0} accounts linked
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${authorized ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-white/70">
                  {authorized ? 'Authenticated' : 'Not authenticated'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="mt-6">
            <div className="text-xs text-white/60 uppercase tracking-wider font-medium mb-3">
              Quick Actions
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={`bg-gradient-to-br ${action.color} rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 hover:scale-105 transition shadow-lg`}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-[10px] md:text-xs font-semibold text-white text-center leading-tight">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ MIDDLE: LIVE SIGNALS ============ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <h2 className="text-xl font-semibold text-navy">
              Live Trading Signals
            </h2>
            <span className="text-sm text-gray-400">
              ({signals.length})
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {connected ? '● live' : '○ offline'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {signals.map((s) => {
            const tick = ticks[s.symbol];
            const livePrice = tick?.price ?? null;
            const history = tick?.history ?? [];

            let liveConfidence = s.confidence;
            if (history.length >= 5) {
              let ups = 0;
              for (let i = 1; i < history.length; i++) {
                if (history[i] > history[i - 1]) ups++;
              }
              liveConfidence = Math.round((ups / (history.length - 1)) * 100);
            }

            return (
              <SignalCard
                key={s.id}
                {...s}
                confidence={liveConfidence}
                livePrice={livePrice}
              />
            );
          })}
        </div>
      </main>

      {/* ============ BOTTOM: RECENT ACTIVITY ============ */}
      {authorized && statement.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-navy">Recent Activity</h2>
              <Link
                to="/reports"
                className="text-xs text-teal-600 hover:underline font-medium"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {statement.slice(0, 5).map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.transaction_id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {isPositive ? '↓' : '↑'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-navy capitalize truncate">
                          {tx.action_type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {fmtTime(tx.transaction_time)}
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-bold font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{fmtMoney(tx.amount)} {tx.currency}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}