/* ---------- Tiny localStorage helper for the bot builder ---------- */

const STORAGE_KEY = 'derivanalyser:bot:v1';

export type SavedBlock = {
  id: string;
  type: 'trade_params' | 'purchase' | 'sell' | 'restart';
  open: boolean;
  market?: string;
  tradeType?: string;
  contractType?: string;
  candleInterval?: string;
  direction?: 'Rise' | 'Fall';
};

export type SavedBot = {
  version: 1;
  savedAt: number;
  blocks: SavedBlock[];
};

/** Save the current blocks list to localStorage. */
export function saveBot(blocks: SavedBlock[]) {
  try {
    const payload: SavedBot = {
      version: 1,
      savedAt: Date.now(),
      blocks,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage might be full or disabled — ignore silently */
  }
}

/** Load the previously saved blocks list. Returns null if nothing saved. */
export function loadBot(): SavedBot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedBot;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.blocks)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Clear the saved bot. */
export function clearSavedBot() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Format a timestamp for the UI, e.g. "saved 2 min ago". */
export function formatAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'saved just now';
  if (sec < 60) return `saved ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `saved ${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `saved ${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `saved ${days}d ago`;
}