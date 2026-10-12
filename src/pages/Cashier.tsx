import { useEffect } from 'react';
import { useAuthWs } from '../lib/auth-ws-context';

export default function Cashier() {
  const { authorized, user, statement, requestStatement } = useAuthWs();

  /* ---- Refresh statement on mount ---- */
  useEffect(() => {
    if (authorized) {
      requestStatement(20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const fmtMoney = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  /* ---- Open Deriv cashier ---- */
  const openDerivUrl = (path: string) => {
    const url = `https://app.deriv.com${path}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDeposit = () => openDerivUrl('/cashier/deposit');
  const handleWithdraw = () => openDerivUrl('/cashier/withdraw');
  const handleTransfer = () => openDerivUrl('/cashier/account-transfer');
  const handleP2P = () => openDerivUrl('/cashier/p2p');

  /* ---- Not logged in state ---- */
  if (!authorized || !user) {
    return (
      <main className="min-h-screen bg-gray-50 pb-32">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-lg font-bold text-navy mb-2">Log in to view Cashier</h2>
            <p className="text-sm text-gray-500 mb-6">
              You need to be logged into a Deriv account to deposit, withdraw, or transfer funds.
            </p>
            <a
              href="/dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ============ BALANCE CARD (POLISH #3: with Refresh) ============ */}
        <div className="bg-gradient-to-br from-[#0b1c3f] via-[#12295a] to-[#0b3d91] text-white rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/70 uppercase tracking-wider font-medium">
              Available Balance
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => requestStatement(20)}
                className="text-[10px] text-white/60 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-white/10 transition"
                title="Refresh balance"
              >
                <span>↻</span>
                <span>Refresh</span>
              </button>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                user.isVirtual ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
              }`}>
                {user.isVirtual ? 'DEMO' : 'REAL'}
              </span>
            </div>
          </div>
          <div className="text-4xl font-bold font-mono tabular-nums mb-1">
            {fmtMoney(user.balance)}
            <span className="text-lg text-white/70 ml-2">{user.currency}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/60 mt-3">
            <div>
              <span className="text-white/40">Account: </span>
              <span className="font-mono">{user.loginid}</span>
            </div>
            <div>
              <span className="text-white/40">Type: </span>
              <span>{user.isVirtual ? 'Virtual' : 'Real'}</span>
            </div>
          </div>
        </div>

        {/* ============ ACTION BUTTONS ============ */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={handleDeposit}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition shadow-md"
          >
            <span className="text-2xl">💰</span>
            <span className="font-semibold text-sm">Deposit</span>
          </button>

          <button
            onClick={handleWithdraw}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition shadow-md"
          >
            <span className="text-2xl">🏦</span>
            <span className="font-semibold text-sm">Withdraw</span>
          </button>

          <button
            onClick={handleTransfer}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition shadow-md"
          >
            <span className="text-2xl">🔄</span>
            <span className="font-semibold text-sm">Transfer</span>
          </button>

          <button
            onClick={handleP2P}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition shadow-md"
          >
            <span className="text-2xl">🤝</span>
            <span className="font-semibold text-sm">P2P Cashier</span>
          </button>
        </div>

        {/* ============ INFO ============ */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <div className="text-xs text-blue-800 leading-relaxed">
            <strong className="block mb-1">🔗 Powered by Deriv</strong>
            Deposit, withdraw, and transfer are handled securely through Deriv's official cashier. Clicking any button opens Deriv's cashier in a new tab.
          </div>
        </div>

        {/* ============ RECENT TRANSACTIONS ============ */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-navy">Recent Transactions</h2>
            <button
              onClick={() => requestStatement(20)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Refresh ↻
            </button>
          </div>

          {statement.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-12">
              <div className="text-3xl mb-2">📋</div>
              <div>No transactions yet</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {statement.slice(0, 10).map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div
                    key={tx.transaction_id}
                    className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
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
          )}

          {statement.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
              <a
                href="/reports"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View all transactions →
              </a>
            </div>
          )}
        </div>

        {/* ============ RISK DISCLAIMER ============ */}
        <div className="mt-6 flex items-center justify-center">
          <button
            onClick={() => alert('Trading derivatives involves significant risk. Only trade with money you can afford to lose.')}
            className="bg-yellow-400 hover:bg-yellow-500 text-navy text-[11px] font-bold px-4 py-2 rounded shadow-md transition"
          >
            ⚠️ Risk Disclaimer
          </button>
        </div>
      </div>
    </main>
  );
}