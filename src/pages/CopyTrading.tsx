import { useState } from 'react';

type Client = {
  id: string;
  token: string;
  account: 'Real' | 'Demo';
  added: string;
};

export default function CopyTrading() {
  const [token, setToken] = useState('');
  const [account, setAccount] = useState<'Real' | 'Demo'>('Real');
  const [clients, setClients] = useState<Client[]>([]);
  const [rotLinked, setRotLinked] = useState(false);
  const [copying, setCopying] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const addClient = () => {
    if (!token.trim()) {
      alert('Paste a Deriv v2 API token first.');
      return;
    }
    const c: Client = {
      id: `c-${Date.now()}`,
      token: token.slice(0, 8) + '…' + token.slice(-4),
      account,
      added: new Date().toLocaleTimeString(),
    };
    setClients((prev) => [...prev, c]);
    setToken('');
  };

  const syncClients = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 800);
  };

  const startDemoToReal = () => {
    setRotLinked(true);
    alert(
      'Demo → Real copy trading activated.\nNote: this is a UI preview — real linking requires a live account.'
    );
  };

  const toggleCopy = () => {
    if (clients.length === 0) {
      alert('Add at least one client first.');
      return;
    }
    setCopying((c) => !c);
  };

  return (
    <main className="bg-[#0a1a3c] min-h-[calc(100vh-56px)] text-white">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={startDemoToReal}
            className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-md transition"
          >
            Start Demo to Real Copy Trading
          </button>
          <button className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-md flex items-center gap-1 transition">
            <span className="w-3 h-3 rounded-sm bg-white/30" />
            Tutorial
          </button>
        </div>

        {/* ROT box */}
        <div className="bg-[#132a52] border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">
              ROT — {rotLinked ? 'linked' : 'not linked yet'}
            </span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  rotLinked ? 'bg-green-400' : 'bg-green-500/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Add follower panel */}
        <div className="bg-[#132a52] border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter follower's Deriv v2 API token (PAT, trade scope)"
              className="flex-1 bg-[#0a1a3c] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-blue-400"
            />
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value as 'Real' | 'Demo')}
              className="bg-[#0a1a3c] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white outline-none cursor-pointer"
            >
              <option value="Real">Real</option>
              <option value="Demo">Demo</option>
            </select>
            <button
              onClick={addClient}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition"
            >
              Add
            </button>
            <button
              onClick={syncClients}
              className="bg-[#0a1a3c] border border-white/10 hover:border-white/30 text-white text-sm font-semibold px-4 py-2.5 rounded-md flex items-center justify-center gap-2 transition"
            >
              Sync
              <span
                className={`inline-block ${
                  syncing ? 'animate-spin' : ''
                }`}
              >
                ↻
              </span>
            </button>
          </div>

          {/* Start Copy Trading row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleCopy}
              className={`${
                copying
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              } text-white text-sm font-semibold px-4 py-2 rounded-md transition`}
            >
              {copying ? 'Stop Copy Trading' : 'Start Copy Trading'}
            </button>
            <button className="bg-blue-500 hover:bg-blue-600 text-white text-sm w-9 h-9 rounded-md flex items-center justify-center transition">
              ▣
            </button>
          </div>
        </div>

        {/* Clients count */}
        <div className="bg-[#132a52] border border-white/10 rounded-lg px-4 py-3 text-sm">
          Total Clients added:{' '}
          <span className="font-semibold">{clients.length}</span>
        </div>

        {/* Client cards */}
        {clients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clients.map((c) => (
              <div
                key={c.id}
                className="bg-[#132a52] border border-white/10 rounded-lg p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm text-white truncate">
                    {c.token}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {c.account} · added {c.added}
                  </div>
                </div>
                <button
                  onClick={() =>
                    setClients((prev) =>
                      prev.filter((x) => x.id !== c.id)
                    )
                  }
                  className="text-red-400 hover:text-red-300 text-xs shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty space holder */}
        <div className="h-40" />

        {/* AI floating button */}
        <button className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
          AI
        </button>
      </div>
    </main>
  );
}