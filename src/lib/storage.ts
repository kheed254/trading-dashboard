/* ---------- Types ---------- */
export type SavedBlock = {
  id: string;
  type: 'trade_params' | 'purchase' | 'sell' | 'restart';
  open: boolean;
  market?: string;
  tradeType?: string;
  contractType?: string;
  digitBarrier?: number;
  candleInterval?: string;
  restartBuySell?: boolean;
  restartLastTrade?: boolean;
  runOnceValues?: Record<string, string | number>;
  durationType?: string;
  durationValue?: number;
  stakeType?: string;
  direction?: 'Rise' | 'Fall' | 'Even' | 'Odd' | 'Over' | 'Under' | 'Matches' | 'Differs' | 'Higher' | 'Lower' | 'Touch' | 'No Touch';
};

export type SavedBot = {
  blocks: SavedBlock[];
  savedAt: number;
};

export type StoredBot = {
  id: string;
  name: string;
  blocks: SavedBlock[];
  savedAt: number;
};

const STORAGE_KEY = 'stingerfx_bot_v1';
const MULTI_BOTS_KEY = 'stingerfx_bots_library_v1';

/* ================================================================
   LEGACY — single "current" bot (used by Bot Builder auto-save)
   ================================================================ */
export function saveBot(blocks: SavedBlock[]): void {
  try {
    const payload: SavedBot = { blocks, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[StingerFX] saveBot failed:', err);
  }
}

export function loadBot(): SavedBot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedBot;
    if (!parsed || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch (err) {
    console.warn('[StingerFX] loadBot failed:', err);
    return null;
  }
}

/* ================================================================
   MULTI-BOT LIBRARY
   ================================================================ */

export function getSavedBots(): StoredBot[] {
  try {
    const raw = localStorage.getItem(MULTI_BOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredBot[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.savedAt - a.savedAt);
  } catch (err) {
    console.warn('[StingerFX] getSavedBots failed:', err);
    return [];
  }
}

export function saveNamedBot(name: string, blocks: SavedBlock[]): StoredBot {
  const bots = getSavedBots();
  const newBot: StoredBot = {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `Untitled Bot ${bots.length + 1}`,
    blocks,
    savedAt: Date.now(),
  };
  bots.unshift(newBot);
  const capped = bots.slice(0, 50);
  try {
    localStorage.setItem(MULTI_BOTS_KEY, JSON.stringify(capped));
  } catch (err) {
    console.warn('[StingerFX] saveNamedBot failed:', err);
  }
  return newBot;
}

export function updateSavedBot(id: string, patch: Partial<StoredBot>): void {
  const bots = getSavedBots();
  const idx = bots.findIndex((b) => b.id === id);
  if (idx < 0) return;
  bots[idx] = { ...bots[idx], ...patch, savedAt: Date.now() };
  try {
    localStorage.setItem(MULTI_BOTS_KEY, JSON.stringify(bots));
  } catch (err) {
    console.warn('[StingerFX] updateSavedBot failed:', err);
  }
}

export function deleteSavedBot(id: string): void {
  const bots = getSavedBots().filter((b) => b.id !== id);
  try {
    localStorage.setItem(MULTI_BOTS_KEY, JSON.stringify(bots));
  } catch (err) {
    console.warn('[StingerFX] deleteSavedBot failed:', err);
  }
}

export function duplicateSavedBot(id: string): StoredBot | null {
  const bots = getSavedBots();
  const original = bots.find((b) => b.id === id);
  if (!original) return null;

  const copy: StoredBot = {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${original.name} (Copy)`,
    blocks: JSON.parse(JSON.stringify(original.blocks)),
    savedAt: Date.now(),
  };

  bots.unshift(copy);
  try {
    localStorage.setItem(MULTI_BOTS_KEY, JSON.stringify(bots.slice(0, 50)));
  } catch (err) {
    console.warn('[StingerFX] duplicateSavedBot failed:', err);
    return null;
  }
  return copy;
}

export function deriveBotName(blocks: SavedBlock[]): string {
  const tp = blocks.find((b) => b.type === 'trade_params');
  if (!tp) return 'Untitled Bot';
  const market = tp.market?.replace(' Index', '') ?? 'Bot';
  const tradeType = tp.tradeType?.split(' › ').pop() ?? '';
  return `${market} ${tradeType}`.trim();
}

export function summarizeBot(blocks: SavedBlock[]): { market: string; tradeType: string; contractType: string } {
  const tp = blocks.find((b) => b.type === 'trade_params');
  return {
    market: tp?.market ?? '—',
    tradeType: tp?.tradeType ?? '—',
    contractType: tp?.contractType ?? '—',
  };
}

/* ---------- Format relative time ---------- */
export function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}