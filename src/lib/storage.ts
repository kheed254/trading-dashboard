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
  // FIX: Allow all direction types used by the new bot builder
  direction?: 'Rise' | 'Fall' | 'Even' | 'Odd' | 'Over' | 'Under' | 'Matches' | 'Differs';
};

export type SavedBot = {
  blocks: SavedBlock[];
  savedAt: number;
};

const STORAGE_KEY = 'stingerfx_bot_v1';

/* ---------- Save ---------- */
export function saveBot(blocks: SavedBlock[]): void {
  try {
    const payload: SavedBot = { blocks, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[StingerFX] saveBot failed:', err);
  }
}

/* ---------- Load ---------- */
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