import { useEffect, useState } from 'react';
import { useAuthWs } from '../lib/auth-ws-context';

type Copier = {
  id: string;
  token: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  loginId?: string;
  addedAt: number;
  enabled: boolean;
  lastErrorMsg?: string;
};

const STORAGE_KEY = 'copy_trading_copiers';

export default function CopyTrading() {
  const { authorized } = useAuthWs();
  const [token, setToken] = useState('');
  const [accountType, setAccountType] = useState<'real' | 'demo'>('real');
  const [copiers, setCopiers] = useState<Copier[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopyTradingActive, setIsCopyTradingActive] = useState(false);

  /* ---- Load from localStorage on mount ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCopiers(JSON.parse(raw));
      const active = localStorage.getItem('iscopyTrading');
      if (active === 'true') setIsCopyTradingActive(true);
    } catch {}
  }, []);

  /* ---- Persist to localStorage ---- */
  const saveCopiers = (next: Copier[]) => {
    setCopiers(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleAdd = () => {
    const trimmed = token.trim();
    if (!trimmed) {
      alert('Please paste a Deriv v2 API token.');
      return;
    }
    if (copiers.some((c) => c.token === trimmed)) {
      alert('This token has already been added.');
      return;
    }

    setIsAdding(true);

    // Phase 1 — just store the token; no validation yet
    const next: Copier[] = [
      ...copiers,
      {
        id: `${Date.now()}`,
        token: trimmed,
        status: 'disconnected',
        addedAt: Date.now(),
        enabled: true,
      },
    ];

    setTimeout(() => {
      saveCopiers(next);
      setToken('');
      setIsAdding(false);
      alert(`Follower account added (${accountType}).\n\nValidation will be wired up in the next update.`);
    }, 500);
  };

  const handleRemove = (id: string) => {
    if (!confirm('Remove this follower account?')) return;
    saveCopiers(copiers.filter((c) => c.id !== id));
  };

  const handleToggleEnabled = (id: string) => {
    saveCopiers(
      copiers.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSyncing(false);
    alert(`Synced ${copiers.length} follower(s).\n\nReal sync will be wired up in the next update.`);
  };

  const handleStartStop = () => {
    const next = !isCopyTradingActive;
    setIsCopyTradingActive(next);
    try {
      localStorage.setItem('iscopyTrading', next ? 'true' : 'false');
    } catch {}
  };

  const statusColor = (s: Copier['status']) => {
    switch (s) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <main className="min-h-screen bg-[#0a1a35] pb-32">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* ============ ADD FOLLOWER ROW ============ */}
        <div className="bg-[#0f2447] border border-white/10 rounded-xl p-3 mb-4">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter follower's Deriv v2 API token (PAT, trade scope)"
            className="w-full bg-[#0a1a35] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 mb-3"
          />
          <div className="flex items-center gap-2">
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as 'real' | 'demo')}
              className="bg-[#0a1a35] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none cursor-pointer"
            >
              <option value="real">Real</option>
              <option value="demo">Demo</option>
            </select>

            <button
              onClick={handleAdd}
              disabled={isAdding}
              className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-md transition ${
                isAdding ? 'opacity-60' : ''
              }`}
            >
              {isAdding ? 'Adding…' : 'Add'}
            </button>

            <button
              onClick={handleSync}
              disabled={isSyncing || copiers.length === 0}
              className={`px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold transition flex items-center gap-1.5 ${
                isSyncing || copiers.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              Sync
              <span className={isSyncing ? 'animate-spin' : ''}>↻</span>
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleStartStop}
              className={`flex-1 font-semibold py-2.5 rounded-md transition text-white ${
                isCopyTradingActive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isCopyTradingActive ? 'Stop Copy Trading' : 'Start Copy Trading'}
            </button>
            <button
              onClick={() => alert('Advanced settings coming soon')}
              className="w-10 h-10 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* ============ COPILOT COUNT ============ */}
        <div className="bg-[#0f2447] border border-white/10 rounded-xl px-4 py-3 mb-4">
          <div className="text-white text-sm font-medium">
            Total Clients added: <span className="font-bold">{copiers.length}</span>
          </div>
        </div>

        {/* ============ COPIER LIST ============ */}
        {copiers.length > 0 && (
          <div className="space-y-2">
            {copiers.map((c) => (
              <div
                key={c.id}
                className="bg-[#0f2447] border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor(c.status)}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-mono truncate">
                    {c.loginId || c.token.slice(0, 12) + '…'}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {c.status} · Added {new Date(c.addedAt).toLocaleDateString()}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleEnabled(c.id)}
                  className={`text-xs px-3 py-1 rounded font-medium transition ${
                    c.enabled
                      ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                  }`}
                >
                  {c.enabled ? 'Enabled' : 'Disabled'}
                </button>

                <button
                  onClick={() => handleRemove(c.id)}
                  className="text-red-400 hover:text-red-300 text-lg leading-none px-2"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ============ EMPTY STATE ============ */}
        {copiers.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-12">
            <div className="text-4xl mb-3">👥</div>
            <div>No followers added yet.</div>
            <div className="text-xs mt-1">Paste a Deriv v2 API token above to get started.</div>
          </div>
        )}

        {/* ============ NOT LOGGED IN WARNING ============ */}
        {!authorized && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
            <div className="text-yellow-400 text-xs font-medium">
              ⚠ Log in to your Deriv account before starting copy trading.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}