import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSavedBots,
  deleteSavedBot,
  duplicateSavedBot,
  summarizeBot,
  formatAgo,
  type StoredBot,
} from '../lib/storage';

export default function TradingBots() {
  const navigate = useNavigate();
  const [bots, setBots] = useState<StoredBot[]>([]);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  /* ---- Load bots on mount ---- */
  useEffect(() => {
    setBots(getSavedBots());
  }, []);

  /* ---- Refresh list from storage ---- */
  const refresh = () => setBots(getSavedBots());

  /* ---- Filter by search ---- */
  const filtered = useMemo(() => {
    if (!search.trim()) return bots;
    const q = search.toLowerCase();
    return bots.filter((b) => {
      const summary = summarizeBot(b.blocks);
      return (
        b.name.toLowerCase().includes(q) ||
        summary.market.toLowerCase().includes(q) ||
        summary.tradeType.toLowerCase().includes(q)
      );
    });
  }, [bots, search]);

  /* ---- Load a bot into the Bot Builder ---- */
  const handleLoad = (bot: StoredBot) => {
    // Save to the "current" bot slot so BotBuilder picks it up
    try {
      const payload = { blocks: bot.blocks, savedAt: Date.now() };
      localStorage.setItem('stingerfx_bot_v1', JSON.stringify(payload));
    } catch {}

    // Navigate to Bot Builder
    navigate('/bot_builder');
  };

  /* ---- Duplicate ---- */
  const handleDuplicate = (id: string) => {
    const copy = duplicateSavedBot(id);
    if (copy) refresh();
  };

  /* ---- Delete ---- */
  const handleDelete = (id: string) => {
    deleteSavedBot(id);
    setConfirmDelete(null);
    refresh();
  };

  /* ---- Last saved at ---- */
  const lastSavedAt = bots.length > 0 ? bots[0].savedAt : null;

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ============ HEADER ============ */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy mb-1">Trading Bots</h1>
          <p className="text-sm text-gray-500">
            {bots.length} saved strateg{bots.length === 1 ? 'y' : 'ies'}
            {lastSavedAt && ` · last saved ${formatAgo(lastSavedAt)}`}
          </p>
        </div>

        {/* ============ SEARCH ============ */}
        {bots.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍  Search bots by name, market, or trade type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* ============ EMPTY STATE ============ */}
        {bots.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-lg font-bold text-navy mb-2">No saved bots yet</h2>
            <p className="text-sm text-gray-500 mb-6">
              Build your first bot in the Bot Builder and it will appear here.
            </p>
            <button
              onClick={() => navigate('/bot_builder')}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition"
            >
              Open Bot Builder
            </button>
          </div>
        )}

        {/* ============ SEARCH EMPTY ============ */}
        {bots.length > 0 && filtered.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-sm text-gray-500">
              No bots match "<span className="font-semibold text-navy">{search}</span>"
            </div>
          </div>
        )}

        {/* ============ BOT CARDS ============ */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((bot) => {
              const summary = summarizeBot(bot.blocks);
              return (
                <div
                  key={bot.id}
                  className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-navy text-base truncate">
                        {bot.name}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Saved {formatAgo(bot.savedAt)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                        {bot.blocks.length} blocks
                      </span>
                    </div>
                  </div>

                  {/* Config summary */}
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-20 shrink-0">Market:</span>
                      <span className="font-medium text-navy truncate">{summary.market}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-20 shrink-0">Trade Type:</span>
                      <span className="font-medium text-navy truncate">{summary.tradeType}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-20 shrink-0">Contract:</span>
                      <span className="font-medium text-navy truncate">{summary.contractType}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                    <button
                      onClick={() => handleLoad(bot)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition"
                    >
                      Load into Builder
                    </button>

                    <button
                      onClick={() => handleDuplicate(bot.id)}
                      className="px-3 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition"
                      title="Duplicate bot"
                    >
                      📋
                    </button>

                    <button
                      onClick={() => setConfirmDelete(bot.id)}
                      className="px-3 py-2.5 border border-red-300 hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg transition"
                      title="Delete bot"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============ FOOTER STATS ============ */}
        {bots.length > 0 && (
          <div className="mt-6 text-center text-[11px] text-gray-400">
            Showing {filtered.length} of {bots.length} bot{bots.length === 1 ? '' : 's'}
            {search && ` matching "${search}"`}
          </div>
        )}
      </div>

      {/* ============ DELETE CONFIRMATION MODAL ============ */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-3xl mb-3 text-center">🗑</div>
            <h3 className="text-lg font-bold text-navy text-center mb-2">
              Delete this bot?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This action cannot be undone. The bot will be permanently removed from your library.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}