import { useAuthWs } from '../lib/auth-ws-context';

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Cashier() {
  const { authorized, user, statement, requestStatement } = useAuthWs();

  const isReal = !user?.isVirtual;
  const balance = user?.balance ?? 0;
  const currency = user?.currency || 'USD';
  const loginid = user?.loginid || '';

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-semibold text-navy mb-1">💳 Cashier</h1>
      <p className="text-sm text-gray-500 mb-6">
        Deposits and withdrawals are handled securely by Deriv's own cashier.
        StingerFX never touches your funds.
      </p>

      {!authorized ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center max-w-md">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-navy mb-2">
            Log in to access the Cashier
          </h2>
          <p className="text-sm text-gray-500">
            Connect your Deriv account to see your balance and make deposits
            or withdrawals.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-[#0b1c3f] to-[#0b3d91] rounded-2xl p-6 text-white mb-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">
                  Account
                </div>
                <div className="text-sm font-mono font-semibold mt-0.5">
                  {loginid || '—'}
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                  isReal
                    ? 'bg-green-500/20 text-green-300 border border-green-400/40'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                }`}
              >
                {isReal ? 'REAL' : 'DEMO'}
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">
              Balance
            </div>
            <div className="text-3xl sm:text-4xl font-bold font-mono mt-1">
              {fmtMoney(balance)} {currency}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <a
              href="https://app.deriv.com/cashier/deposit"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl p-6 text-center transition shadow-sm"
            >
              <div className="text-3xl mb-2">⬆</div>
              <div className="text-base font-bold">Deposit</div>
              <div className="text-xs text-white/80 mt-1">
                Opens Deriv's secure cashier
              </div>
            </a>

            <a
              href="https://app.deriv.com/cashier/withdrawal"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white hover:bg-gray-50 border border-gray-200 text-navy rounded-xl p-6 text-center transition shadow-sm"
            >
              <div className="text-3xl mb-2">⬇</div>
              <div className="text-base font-bold">Withdraw</div>
              <div className="text-xs text-gray-500 mt-1">
                Opens Deriv's secure cashier
              </div>
            </a>
          </div>

          {!isReal && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-4 py-3 mb-6">
              ⓘ You're on a demo account. Demo balances are virtual — there's
              nothing to deposit or withdraw. Switch to your Real account to
              use the cashier.
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-navy">
                Recent Transactions
              </span>
              <button
                onClick={() => requestStatement(20)}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              >
                ↻ Refresh
              </button>
            </div>

            {statement.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-10">
                No recent transactions.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {statement.map((tx, i) => {
                  const isCredit = tx.amount >= 0;
                  return (
                    <div
                      key={tx.transaction_id || i}
                      className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-navy capitalize">
                          {tx.action_type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {tx.transaction_time
                            ? new Date(tx.transaction_time * 1000).toLocaleString()
                            : ''}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-mono font-bold whitespace-nowrap ${
                          isCredit ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isCredit ? '+' : ''}
                        {fmtMoney(tx.amount)} {tx.currency}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
            ⚠ Deposits and withdrawals happen on Deriv's own platform for
            licensing and compliance reasons — this keeps your funds protected
            under Deriv's regulation.
          </p>
        </>
      )}
    </main>
  );
}