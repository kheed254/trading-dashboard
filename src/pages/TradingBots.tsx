import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSavedBots,
  deleteSavedBot,
  duplicateSavedBot,
  saveNamedBot,
  summarizeBot,
  formatAgo,
  type StoredBot,
} from '../lib/storage';
import { parseDerivXml } from '../lib/xmlParser';
import { PREMADE_BOTS, premadeBotToBlocks, type PremadeBot } from '../data/premadeBots';

type ImportWarning = {
  botName: string;
  hasAdvancedBlocks: boolean;
  advancedBlockTypes: string[];
  warnings: string[];
};

type SubTab = 'free' | 'speedbots' | 'calculator' | 'strategies';

export default function TradingBots() {
  const navigate = useNavigate();
  const [bots, setBots] = useState<StoredBot[]>([]);
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('free');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<ImportWarning | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBots(getSavedBots());
  }, []);

  const refresh = () => setBots(getSavedBots());

  /* ---- Filter saved bots ---- */
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

  /* ---- Load a premade bot into Bot Builder ---- */
  const handleLoadPremade = (bot: PremadeBot) => {
    const blocks = premadeBotToBlocks(bot);
    try {
      const payload = { blocks, savedAt: Date.now() };
      localStorage.setItem('stingerfx_bot_v1', JSON.stringify(payload));
    } catch {}
    navigate('/bot_builder');
  };

  /* ---- Load a saved bot into Bot Builder ---- */
  const handleLoad = (bot: StoredBot) => {
    try {
      const payload = { blocks: bot.blocks, savedAt: Date.now() };
      localStorage.setItem('stingerfx_bot_v1', JSON.stringify(payload));
    } catch {}
    navigate('/bot_builder');
  };

  const handleDuplicate = (id: string) => {
    duplicateSavedBot(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteSavedBot(id);
    setConfirmDelete(null);
    refresh();
  };

  /* ---- Import XML ---- */
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      alert('Please select an .xml file.');
      return;
    }

    try {
      const text = await file.text();
      const result = parseDerivXml(text);
      saveNamedBot(result.botName, result.blocks);
      refresh();

      if (result.hasAdvancedBlocks) {
        setImportWarning({
          botName: result.botName,
          hasAdvancedBlocks: result.hasAdvancedBlocks,
          advancedBlockTypes: result.advancedBlockTypes,
          warnings: result.warnings,
        });
      }
    } catch (err) {
      console.error('[TradingBots] Import failed:', err);
      alert(`Could not parse the XML file.\n\n${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const lastSavedAt = bots.length > 0 ? bots[0].savedAt : null;

  /* ---- Sub-tab labels ---- */
  const subTabs: { id: SubTab; label: string; icon?: string }[] = [
    { id: 'free', label: 'Free Bots' },
    { id: 'speedbots', label: 'SpeedBots', icon: '🚀' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'strategies', label: 'Strategies' },
  ];

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ============ SUB-TABS ============ */}
        <div className="flex gap-2 mb-6 overflow-x-auto tab-scroll">
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition border flex items-center gap-1.5 ${
                subTab === t.id
                  ? 'bg-white border-blue-600 text-blue-600 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.icon && <span>{t.icon}</span>}
              {t.label}
            </button>
          ))}
        </div>

        {/* ============ SUB-TAB CONTENT ============ */}
        {subTab === 'free' && (
          <>
            {/* Premade bots grid — POLISH #4 APPLIED */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {PREMADE_BOTS.map((bot) => (
                <div
                  key={bot.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition flex flex-col"
                >
                  {/* Icon + name + PREMIUM badge on one row */}
                  <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl flex-shrink-0">{bot.icon}</span>
                      <h3 className="text-base font-bold text-navy truncate">{bot.name}</h3>
                    </div>
                    {bot.isPremium && (
                      <span className="flex-shrink-0 bg-yellow-400 text-navy text-[9px] font-bold px-2 py-1 rounded mt-0.5">
                        PREMIUM
                      </span>
                    )}
                  </div>

                  {/* Stars */}
                  <div className="px-4 mb-2 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={i < bot.rating ? 'text-yellow-400' : 'text-gray-200'}
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <p className="px-4 pb-4 text-xs text-gray-500 leading-relaxed flex-1">
                    {bot.description}
                  </p>

                  {/* Load button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => handleLoadPremade(bot)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-lg transition"
                    >
                      LOAD PREMIUM BOT
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ===== Saved Bots section ===== */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-navy">My Saved Bots</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {bots.length} saved strateg{bots.length === 1 ? 'y' : 'ies'}
                    {lastSavedAt && ` · last saved ${formatAgo(lastSavedAt)}`}
                  </p>
                </div>
                <button
                  onClick={handleImportClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition flex items-center gap-1.5"
                >
                  📥 Import XML
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,application/xml,text/xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {bots.length > 0 && (
                <input
                  type="text"
                  placeholder="🔍  Search saved bots…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white outline-none focus:border-blue-500 mb-4"
                />
              )}

              {bots.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-3">🤖</div>
                  <h3 className="text-base font-bold text-navy mb-1">No saved bots yet</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    Build a bot in the Bot Builder, or import an XML file from Deriv.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => navigate('/bot_builder')}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
                    >
                      Open Bot Builder
                    </button>
                    <button
                      onClick={handleImportClick}
                      className="border border-blue-600 hover:bg-blue-50 text-blue-600 text-sm font-semibold px-5 py-2.5 rounded-lg transition"
                    >
                      📥 Import XML
                    </button>
                  </div>
                </div>
              )}

              {bots.length > 0 && filtered.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="text-sm text-gray-500">
                    No bots match "<span className="font-semibold text-navy">{search}</span>"
                  </div>
                </div>
              )}

              {filtered.length > 0 && (
                <div className="space-y-3">
                  {filtered.map((bot) => {
                    const summary = summarizeBot(bot.blocks);
                    const isImported = bot.name.toLowerCase().startsWith('imported') || bot.name.includes('Imported');
                    return (
                      <div
                        key={bot.id}
                        className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-navy text-base truncate flex items-center gap-2">
                              {bot.name}
                              {isImported && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Imported
                                </span>
                              )}
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
            </div>
          </>
        )}

        {/* ============ OTHER SUB-TABS (placeholder) ============ */}
        {subTab !== 'free' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🚧</div>
            <div className="font-semibold text-navy mb-1 capitalize">{subTab}</div>
            <div className="text-sm text-gray-500">Coming soon</div>
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
            <h3 className="text-lg font-bold text-navy text-center mb-2">Delete this bot?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This action cannot be undone.
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

      {/* ============ IMPORT WARNING MODAL ============ */}
      {importWarning && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={() => setImportWarning(null)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-3xl mb-3 text-center">⚠️</div>
            <h3 className="text-lg font-bold text-navy text-center mb-2">
              Imported with warnings
            </h3>
            <div className="text-sm text-gray-600 mb-4">
              <div className="font-semibold mb-2">✓ "{importWarning.botName}" was saved.</div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong className="block mb-1">This bot uses advanced blocks</strong>
                The original XML contains custom logic ({importWarning.advancedBlockTypes.length} advanced block types).
                Only the core parameters were imported: Market, Trade Type, Contract Type, Stake, Duration, Take Profit, Stop Loss.
              </div>
            </div>
            <button
              onClick={() => setImportWarning(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style>{`
        .tab-scroll::-webkit-scrollbar { display: none; }
        .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}